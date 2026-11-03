import { supabase } from "@/lib/supabaseClient"
import { privateEditorTable, privacyList, publicDonorWrite, denyPrivateMutation } from '@/lib/privacy/client';

export type EditorPost = { id: number; [field: string]: unknown }

export async function fetchPosts(table: string) {
  if (privateEditorTable(table)) return await privacyList(table) as EditorPost[]
  const { data, error } = await supabase
    .from(table)
    .select("*")
    .order("id", { ascending: true })

  if (error) {
    console.error("게시물 조회 실패")
    return []
  }

  return (data ?? []) as EditorPost[]
}

export async function deletePost(table: string, id: number) {
  if (table === 'editor_5_donators') { await publicDonorWrite('delete', id, {}); return { error: null } }
  if (privateEditorTable(table)) denyPrivateMutation()
  return supabase.from(table).delete().eq("id", id)
}

export async function insertPost(table: string, payload: Record<string, unknown>) {
  if (table === 'editor_5_donators') return publicDonorWrite('create', null, payload)
  if (privateEditorTable(table)) denyPrivateMutation()
  const { data, error } = await supabase
    .from(table)
    .insert(payload)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function updatePost(
  table: string,
  id: number,
  payload: Record<string, unknown>
) {
  if (table === 'editor_5_donators') return publicDonorWrite('update', id, payload)
  if (privateEditorTable(table)) denyPrivateMutation()
  const { data, error } = await supabase
    .from(table)
    .update(payload)
    .eq("id", id)
    .select()
    .single()

  if (error) throw error
  return data
}
