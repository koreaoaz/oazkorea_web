import { supabase } from "@/lib/supabaseClient"
import { sanitizeFileName } from "../utils/sanitizeFileName"

export async function uploadImage(
  bucket: string,
  file: File,
): Promise<string> {
  const filename = sanitizeFileName(file.name)

  const { error } = await supabase.storage
    .from(bucket)
    .upload(filename, file)

  if (error) throw error
  return filename
}

export function getPublicImageUrl(bucket: string, filename: string) {
  return supabase.storage.from(bucket).getPublicUrl(filename).data.publicUrl
}

export async function removeImage(bucket: string, filename: string) {
  return supabase.storage.from(bucket).remove([filename])
}
