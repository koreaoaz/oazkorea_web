import receipts from '@/data/news-release-bindings.json'
import {getEventImages} from '@/app/editor/utils/parsing_first'
import {mainPresentation} from './main-presentation'

export function releaseNewsIds(): number[] {
  return mainPresentation() ? Object.keys(receipts).map(Number) : []
}

// A candidate ID only narrows the anonymous query. Publication also requires an exact
// match on the visible row, including the original description and ordered image paths.
export async function matchesReleaseNews(row: {
  id: number; title: string | null; description: string | null; created_at: string; filenames: unknown
}): Promise<boolean> {
  if (!mainPresentation()) return false
  const expected = receipts[String(row.id) as keyof typeof receipts]
  if (!expected) return false
  const names = getEventImages(row.filenames).sort((a,b) => a.order-b.order).map(frame => frame.filename)
  const serialized = JSON.stringify([row.title,row.description,row.created_at,names])
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(serialized))
  return Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2,'0')).join('') === expected
}
