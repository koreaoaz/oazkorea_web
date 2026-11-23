import {handleGmailCron} from '@/lib/gmail-intake-server'
export const dynamic='force-dynamic'
export async function POST(request:Request){return handleGmailCron(request)}
