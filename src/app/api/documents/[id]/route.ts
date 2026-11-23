import {attachmentDownload} from '@/lib/admin/attachments-server'
export const runtime='nodejs'
export const dynamic='force-dynamic'
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){return attachmentDownload(request,(await params).id)}
