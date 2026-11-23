export type VisitorSnapshot = { today: string; count: number | null }
export const EMPTY_VISITOR: VisitorSnapshot = { today: "", count: null }
export const getServerVisitorSnapshot = () => EMPTY_VISITOR

type Method = "GET" | "POST"
type Dependencies = {
  request?: (method: Method) => Promise<unknown>
  today?: () => string
  read?: () => string | null
  write?: (date: string) => void
}

// 진행 중인 같은 날짜의 기록 요청만 공유한다. 완료 결과를 하루 종일 캐시하거나 집계 정책을 바꾸지 않는다.
const pendingVisits = new Map<string, Promise<number>>()
const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value)
function countFrom(value: unknown): number | null {
  if (value === null || typeof value !== "object") return null
  if ("count" in value && finite(value.count)) return value.count
  if ("visitor" in value && finite(value.visitor)) return value.visitor
  return null
}

export function createVisitorResource(dependencies: Dependencies = {}) {
  const request = dependencies.request ?? (async (method: Method): Promise<unknown> => {
    // Header is ignored by legacy route. New RPC can deduplicate an ambiguous
    // retry across resource remounts without changing the existing visit policy.
    let requestId: string | undefined
    if (method === "POST" && typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      const date = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" })
      const key = `oazVisitRequest:${date}`
      try {
        requestId = localStorage.getItem(key) ?? undefined
        if (!requestId || !/^[0-9a-f-]{36}$/i.test(requestId)) {
          requestId = crypto.randomUUID(); localStorage.setItem(key, requestId)
        }
      } catch { requestId = crypto.randomUUID() }
    }
    const response = await fetch("/api/visitor", method === "POST" ? { method, ...(requestId ? { headers: { "Idempotency-Key": requestId } } : {}) } : undefined)
    if (!response.ok) throw new Error("방문자 정보를 불러오지 못했습니다.")
    return response.json()
  })
  const today = dependencies.today ?? (() => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" }))
  const read = dependencies.read ?? (() => localStorage.getItem("lastVisitDate"))
  const write = dependencies.write ?? ((date: string) => localStorage.setItem("lastVisitDate", date))
  let snapshot = EMPTY_VISITOR
  let started = false
  const listeners = new Set<() => void>()
  const notify = () => listeners.forEach((listener) => listener())

  async function getCount(): Promise<number> {
    try { return countFrom(await request("GET")) ?? 0 } catch { return 0 }
  }
  async function visit(date: string): Promise<number> {
    let lastVisited: string | null = null
    try { lastVisited = read() } catch { /* 저장소가 막혀도 집계 요청의 결과는 표시한다. */ }
    if (lastVisited === date) return getCount()
    const pending = pendingVisits.get(date)
    if (pending) return pending
    const task = (async () => {
      try {
        const count = countFrom(await request("POST"))
        if (count !== null) {
          try { write(date) } catch { /* 저장 실패 때문에 POST를 재시도하지 않는다. */ }
          return count
        }
      } catch { /* POST 실패는 GET으로만 대체한다. */ }
      return getCount()
    })()
    pendingVisits.set(date, task)
    void task.then(() => { if (pendingVisits.get(date) === task) pendingVisits.delete(date) })
    return task
  }

  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {
      listeners.add(listener)
      if (!started) {
        started = true
        const date = today()
        snapshot = { today: date, count: null }
        notify()
        void visit(date).then((count) => { snapshot = { today: date, count }; notify() })
      }
      return () => { listeners.delete(listener) }
    },
  }
}
