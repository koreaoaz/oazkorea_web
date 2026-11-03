import { supabase } from "@/lib/supabaseClient"
import { privateEditorTable } from '@/lib/privacy/policy';

export async function persistOrder<T extends { id: number }>(
  table: string,
  items: T[],
) {
  if (privateEditorTable(table)) throw new Error('개인정보의 ID와 순서는 변경할 수 없습니다.')
  for (let i = 0; i < items.length; i++) {
    const { error } = await supabase
      .from(table)
      .update({ id: i + 1 })
      .eq("id", items[i].id)

    if (error) throw error
  }
}
