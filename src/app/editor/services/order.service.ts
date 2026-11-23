export const ORDERING_UNAVAILABLE_REASON = "순서 저장은 안전한 순서 컬럼이 확인될 때까지 사용할 수 없습니다. 게시물 ID는 변경하지 않습니다."

// No Supabase import: even direct/stale calls cannot rewrite IDs or partially save.
export async function persistOrder<T extends { id: number }>(_table: string, _items: T[]): Promise<void> {
  void _table; void _items
  throw new Error(ORDERING_UNAVAILABLE_REASON)
}
