import { supabase } from "@/lib/supabaseClient"

export async function persistOrder<T extends { id: number }>(
  table: string,
  items: T[],
) {
  for (let i = 0; i < items.length; i++) {
    const { error } = await supabase
      .from(table)
      .update({ id: i + 1 })
      .eq("id", items[i].id)

    if (error) throw error
  }
}
