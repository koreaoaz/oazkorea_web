
import {imageURL} from '@/lib/image-delivery'
import { supabase } from "@/lib/supabaseClient"
import { sanitizeFileName } from "../utils/sanitizeFileName"
import { adminEditorEnabled } from '@/lib/admin/protocol'

type UploadAttempt = { path: string; status: "pending" | "uploaded" | "unconfirmed" }
type FileUploads = { pending?: Promise<string>; uploaded?: string; attempts: UploadAttempt[] }
const uploads = new WeakMap<File, Map<string, FileUploads>>()
const uploadBuckets = new Set(["project_img", "study-images", "card_news"])

// In-memory review receipts only. Never automatically delete an unconfirmed upload.
export function getUploadAttempts(bucket: string, file: File): readonly UploadAttempt[] {
  return (uploads.get(file)?.get(bucket)?.attempts ?? []).map(attempt => ({ ...attempt }))
}

export async function uploadImage(
  bucket: string,
  file: File,
): Promise<string> {
  if (!uploadBuckets.has(bucket)) throw new Error("허용되지 않은 이미지 버킷입니다.")
  if(adminEditorEnabled()){
    if(file.size>5*1024*1024)throw new Error('이미지는 5MiB 이하여야 합니다.')
    if(!['image/png','image/jpeg','image/webp'].includes(file.type))throw new Error('PNG, JPEG, WebP 파일만 사용할 수 있습니다.')
  }
  let buckets = uploads.get(file)
  if (!buckets) { buckets = new Map(); uploads.set(file, buckets) }
  let state = buckets.get(bucket)
  if (!state) { state = { attempts: [] }; buckets.set(bucket, state) }
  if (state.uploaded) return state.uploaded
  if (state.pending) return state.pending
  const current = state
  const filename = sanitizeFileName(file.name)
  const attempt: UploadAttempt = { path: filename, status: "pending" }
  current.attempts.push(attempt)
  const task = Promise.resolve().then(async () => {
    try {
      if (adminEditorEnabled()) {
        const {data}=await supabase.auth.getSession()
        if(!data.session)throw new Error('관리자 로그인이 필요합니다.')
        const table:Record<string,string>={project_img:'editor_1_projects','study-images':'editor_2_studies',card_news:'editor_6_events'}
        const response=await fetch('/api/admin/media',{method:'POST',headers:{Authorization:`Bearer ${data.session.access_token}`,'Content-Type':file.type,'x-oaz-table':table[bucket]},body:file})
        if(!response.ok)throw new Error('이미지 업로드를 확인하지 못했습니다.')
        const result=await response.json()
        if(typeof result.path!=='string'||!/^managed\/[0-9a-f-]{36}\.webp$/.test(result.path)||result.bucket!==bucket)throw new Error('이미지 응답을 확인하지 못했습니다.')
        attempt.path=result.path;attempt.status='uploaded';current.uploaded=result.path
        return result.path
      }
      const { error } = await supabase.storage.from(bucket).upload(filename, file, { upsert: false })
      if (error) throw error
      attempt.status = "uploaded"
      current.uploaded = filename
      return filename
    } catch {
      attempt.status = "unconfirmed"
      const error = new Error("이미지 업로드 결과를 확인하지 못했습니다.")
      error.name = "UploadUnconfirmedError"
      throw error
    } finally { current.pending = undefined }
  })
  current.pending = task
  return task
}

export function getPublicImageUrl(bucket: string, filename: string) {
  return imageURL(bucket,filename,supabase.storage.from(bucket).getPublicUrl(filename).data.publicUrl)
}

export async function removeImage(bucket: string, filename: string) {
  return supabase.storage.from(bucket).remove([filename])
}
