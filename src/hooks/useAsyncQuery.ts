"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { Dispatch, SetStateAction } from "react"

type Query<T> = (signal: AbortSignal) => Promise<T>
type Snapshot<T> = { key: string; query: Query<T>; revision: number; data: T; error: string | null }
function isUpdater<T>(update: SetStateAction<T>): update is (previous: T) => T {
  return typeof update === "function"
}

// 요청 키/재조회 번호로 로딩을 파생한다. effect는 외부 요청과 응답/cleanup만 담당한다.
export function useAsyncQuery<T>(key: string, query: Query<T>, initialData: T, failureMessage: string | ((error: unknown) => string), retainOnError = true) {
  const [initial] = useState(() => initialData)
  const [revision, setRevision] = useState(0)
  const [snapshot, setSnapshot] = useState<Snapshot<T> | null>(null)
  const activeQuery = useRef<{ key: string; query: Query<T> } | null>(null)

  useEffect(() => {
    activeQuery.current = { key, query }
    const controller = new AbortController()
    let active = true
    async function execute() {
      try {
        const data = await query(controller.signal)
        if (active) setSnapshot({ key, query, revision, data, error: null })
      } catch (error: unknown) {
        if (active) setSnapshot((previous) => ({
          key, query, revision, data: retainOnError && previous?.key === key ? previous.data : initial,
          error: typeof failureMessage === 'function' ? failureMessage(error) : failureMessage,
        }))
      }
    }
    void execute()
    return () => { active = false; activeQuery.current = null; controller.abort() }
  }, [key, revision, query, initial, failureMessage, retainOnError])

  const reload = useCallback(() => setRevision((value) => value + 1), [])
  const setData: Dispatch<SetStateAction<T>> = useCallback((update) => {
    // 이전 보드의 비동기 등록 callback이 현재 보드의 상태를 교체하지 못하게 한다.
    if (activeQuery.current?.key !== key || activeQuery.current.query !== query) return
    setSnapshot((previous) => {
      const previousData = previous?.key === key ? previous.data : initial
      const data = isUpdater(update)
        ? update(previousData)
        : update
      return { key, query: previous?.key === key ? previous.query : query, revision: previous?.key === key ? previous.revision : -1, data, error: null }
    })
  }, [key, initial, query])

  const current = snapshot?.key === key && snapshot.query === query && snapshot.revision === revision
  return {
    data: snapshot?.key === key ? snapshot.data : initial,
    loading: !current, error: current ? snapshot.error : null, reload, setData,
  }
}
