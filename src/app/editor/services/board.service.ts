import { privateEditorTable, privateReadOnly, privacyList, publicDonorWrite, denyPrivateMutation } from '@/lib/privacy/client'
import { supabase } from "@/lib/supabaseClient"
import type { EditorRelation, EditorRow, EditorTable, EditorUpdate } from "@/types/editor"

// ID 필터는 모든 테이블의 공통 컬럼만 표현하고, SELECT 결과는 아래에서 실제 Row<T>로 지정한다.
type IdFilteredRelation<T extends EditorTable> = Omit<EditorRelation<T>, "Row"> & {
  Row: Pick<EditorRow, "id">
}

// Private Editor paths never fall back to broad direct table SELECT.
export function newEditorEnabled() {
  try { return process.env.NEXT_PUBLIC_OAZ_ADMIN_EDITOR_V2 === "true" } catch { return false }
}
export async function fetchPosts<T extends EditorTable>(table: T): Promise<EditorRow<T>[]> {
  if (privateEditorTable(table)) return await privacyList(table) as unknown as EditorRow<T>[]
  if (newEditorEnabled()) return (await (await import("@/lib/admin/editorBridge")).bridgeList(table)) as unknown as EditorRow<T>[]
  const { data, error } = await supabase
    .from<T, EditorRelation<T>>(table)
    .select<"*", EditorRow<T>>("*")
    .order("id", { ascending: true })

  if (error) {
    throw error
  }

  return data ?? []
}

export async function deletePost(table: string, id: number, expectedRevision?: number) {
  if (privateReadOnly(table)) denyPrivateMutation()
  if (table === 'editor_5_donators') { await publicDonorWrite('delete', id, {}); return { error: null, count: 1 } }
  if (newEditorEnabled()) return (await import("@/lib/admin/editorBridge")).bridgeWrite("content.delete", table, id, {}, expectedRevision)
  // Count affected rows without requesting a representation/extra SELECT columns.
  const result = await supabase.from(table).delete({ count: "exact" }).eq("id", id)
  if (result.error) throw result.error
  if (result.count === 0) throw new Error("삭제 대상이 없거나 삭제 권한을 확인할 수 없습니다.")
  if (result.count !== 1) throw new Error("삭제 결과를 확인하지 못했습니다. 목록을 새로고침해 확인해 주세요.")
  return result
}

// 기존 Form의 전송 값에는 스키마 충돌이 남아 있다. 검증된 EditorInsert로 단정하지 않는다.
// unknown은 검증 전 전달 경계이며, 스키마 검사나 운영 저장 성공을 보장하지 않는다.
export async function insertPost(table: EditorTable, payload: unknown) {
  if (privateReadOnly(table)) denyPrivateMutation()
  if (table === 'editor_5_donators') return publicDonorWrite('create', null, payload)
  if (newEditorEnabled()) return (await import("@/lib/admin/editorBridge")).bridgeWrite("content.create", table, null, payload)
  const { data, error } = await supabase
    .from(table)
    .insert(payload)
    .select()
    .single()

  if (error) throw error
  if (!data) throw new Error("저장 결과를 확인하지 못했습니다.")
  return data
}

export async function updatePost<T extends EditorTable>(
  table: T,
  id: number,
  payload: EditorUpdate<NoInfer<T>>,
  expectedRevision?: number
) {
  if (privateReadOnly(table)) denyPrivateMutation()
  if (table === 'editor_5_donators') return publicDonorWrite('update', id, payload)
  if (newEditorEnabled()) return (await import("@/lib/admin/editorBridge")).bridgeWrite("content.update", table, id, payload, expectedRevision)
  const { data, error } = await supabase
    .from<T, IdFilteredRelation<T>>(table)
    .update(payload)
    .eq("id", id)
    .select<"*", EditorRow<T>>()
    .single()

  if (error) throw error
  if (!data) throw new Error("수정 결과를 확인하지 못했습니다.")
  return data
}
