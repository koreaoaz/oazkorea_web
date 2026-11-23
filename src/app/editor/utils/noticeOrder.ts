import type { NoticeRow } from "@/types/editor"

// ID의 유일성을 가정하지 않고, 선택한 행 객체들의 개수와 구성이 같은지 확인한다.
export function mergeNoticeOrder(
  posts: readonly NoticeRow[],
  reordered: readonly (NoticeRow | undefined)[],
  matchesFilter: (post: NoticeRow) => boolean,
): NoticeRow[] | null {
  const selected = posts.filter(matchesFilter)
  if (selected.length !== reordered.length) return null

  const remaining = new Map<NoticeRow, number>()
  for (const post of selected) remaining.set(post, (remaining.get(post) ?? 0) + 1)
  for (const post of reordered) {
    if (post === undefined) return null
    const count = remaining.get(post)
    if (count === undefined || count === 0) return null
    remaining.set(post, count - 1)
  }

  const queue = [...reordered]
  const result: NoticeRow[] = []
  for (const post of posts) {
    if (!matchesFilter(post)) {
      result.push(post)
      continue
    }
    const next = queue.shift()
    if (next === undefined) return null
    result.push(next)
  }
  return queue.length === 0 ? result : null
}
