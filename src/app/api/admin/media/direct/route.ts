import {directMedia} from '@/lib/admin/direct-media'
export const dynamic='force-dynamic'
export const runtime='nodejs'
export const maxDuration=60
export async function POST(request:Request){return directMedia(request)}
