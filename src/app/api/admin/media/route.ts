import {handleMediaUpload} from '@/lib/admin/media-upload'
import {mediaPort} from '@/lib/admin/media-server'
export const dynamic='force-dynamic'
export const runtime='nodejs'
export async function POST(request:Request){return handleMediaUpload(request,process.env,mediaPort)}
