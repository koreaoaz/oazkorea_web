import {gmailPublication} from '@/lib/gmail-publication-server'
export const runtime='nodejs'
export const dynamic='force-dynamic'
export async function POST(request:Request){return gmailPublication(request)}
