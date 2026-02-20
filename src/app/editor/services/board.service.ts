import { supabase } from "@/lib/supabaseClient"

export async function fetchPosts(table: string) {
  const { data, error } = await supabase
    .from(table)
    .select("*")
    .order("id", { ascending: true })

  if (error) {
    console.error(error)
    return []
  }

  return data ?? []
}

export async function deletePost(table: string, id: number) {
  return supabase.from(table).delete().eq("id", id)
}

export async function insertPost(table: string, payload: any) {
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
  payload: any
) {
  const { data, error } = await supabase
    .from(table)
    .update(payload)
    .eq("id", id)
    .select()
    .single()

  if (error) throw error
  return data
}