'use client'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { publicVisitPath, validStats, type TrafficStats } from '@/lib/traffic'
import { confirmVisit, setTrackingAllowed, trackingAllowed, visitForDay } from '@/lib/browser-visit'

type TrafficView = { stats: TrafficStats | null; failed: boolean; allowed: boolean; toggle: () => void }
const Traffic = createContext<TrafficView>({ stats: null, failed: false, allowed: false, toggle: () => {} })
export const useTraffic = () => useContext(Traffic)

export function TrafficProvider({ children }: { children: ReactNode }) {
  const path = usePathname()
  const [stats, setStats] = useState<TrafficStats | null>(null)
  const [failed, setFailed] = useState(false)
  const [allowed, setAllowed] = useState(false)
  const [revision, setRevision] = useState(0)

  useEffect(() => {
    if (!publicVisitPath(path)) return
    const controller = new AbortController()
    const options = { signal: controller.signal, credentials: 'omit', cache: 'no-store' } as const
    let timer: ReturnType<typeof setTimeout>
    let running = false
    const visible = () => !controller.signal.aborted && document.visibilityState === 'visible' && location.pathname === path
    async function refresh() {
      if (running || !visible()) return
      running = true
      let next = 60000
      let readSucceeded = false
      try {
        setAllowed(trackingAllowed())
        const read = await fetch('/api/traffic', options)
        if (!read.ok) throw Error()
        let value: unknown = await read.json()
        if (!validStats(value)) throw Error()
        readSucceeded = true
        next = value.refreshMs + 100
        if (visible()) {
          setStats(value)
          setFailed(false)
          if (trackingAllowed()) {
            const day = value.day
            const visit = await visitForDay(day).catch(() => null)
            if (visit && !visit.confirmed && visit.day === day && visible() && trackingAllowed()) {
              const write = await fetch('/api/traffic', { ...options, method: 'POST', referrerPolicy: 'same-origin', body: 'visit', headers: { 'Idempotency-Key': visit.id, 'X-OaZ-Visit-Day': day } })
              if (write.status === 409) next = 250
              else if (write.status === 429) next = 60000
              else if (write.ok && write.status !== 204) {
                value = await write.json()
                if (!validStats(value)) throw Error()
                await confirmVisit(visit)
                if (visible()) setStats(value)
              } else if (!write.ok) throw Error()
            }
          }
        }
      } catch {
        if (visible() && !readSucceeded) { setFailed(true); setStats(null) }
        next = 60000
      } finally {
        running = false
        clearTimeout(timer)
        if (!controller.signal.aborted) timer = setTimeout(refresh, next)
      }
    }
    function preferenceChanged(event: StorageEvent) {
      if (event.key === 'oaz-visit-opt-out' || event.key === null) setRevision(v => v + 1)
    }
    void refresh()
    document.addEventListener('visibilitychange', refresh)
    window.addEventListener('storage', preferenceChanged)
    return () => {
      controller.abort()
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', refresh)
      window.removeEventListener('storage', preferenceChanged)
    }
  }, [path, revision])
  function toggle() {
    try { setTrackingAllowed(!trackingAllowed()) } catch { /* Browser blocks storage. */ }
    setAllowed(trackingAllowed())
    setRevision(v => v + 1)
  }
  return <Traffic.Provider value={{ stats, failed, allowed, toggle }}>{children}</Traffic.Provider>
}
