type Visit = { day: string; id: string; confirmed: boolean }
const preferenceKey = 'oaz-visit-opt-out'
export function trackingAllowed() {
  try {
    return navigator.doNotTrack !== '1' && !(navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl && localStorage.getItem(preferenceKey) !== '1'
  } catch { return false }
}
export function setTrackingAllowed(allow: boolean) {
  localStorage.setItem(preferenceKey, allow ? '0' : '1')
  if (!allow) void updateVisit(() => null).catch(() => {})
}
// All tabs share this single record. The read/modify/write runs in one serialized transaction.
function updateVisit(change: (old?: Visit) => Visit | null): Promise<Visit | null> {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open('oaz-visit-day', 1)
    open.onupgradeneeded = () => open.result.createObjectStore('current')
    open.onerror = () => reject(open.error)
    open.onsuccess = () => {
      const db = open.result
      const tx = db.transaction('current', 'readwrite')
      const store = tx.objectStore('current')
      const read = store.get('day')
      let result: Visit | null = null
      read.onsuccess = () => {
        result = change(read.result)
        if (result) store.put(result, 'day')
        else store.delete('day')
      }
      tx.oncomplete = () => { db.close(); resolve(result) }
      tx.onabort = () => { db.close(); reject(tx.error) }
    }
  })
}
export function visitForDay(day: string) {
  return updateVisit(old => old && old.day >= day ? old : { day, id: crypto.randomUUID(), confirmed: false })
}
export function confirmVisit(visit: Visit) {
  return updateVisit(old => old?.day === visit.day && old.id === visit.id ? { ...old, confirmed: true } : old ?? null)
}
