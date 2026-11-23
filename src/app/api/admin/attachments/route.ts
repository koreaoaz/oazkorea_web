import {attachmentRequest} from '@/lib/admin/attachments-server'
export const runtime='nodejs'
export const dynamic='force-dynamic'
export async function POST(request:Request){return attachmentRequest(request)}
