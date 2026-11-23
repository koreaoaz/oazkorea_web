import {gmailAutofill} from '@/lib/gmail-autofill-server'
export const runtime='nodejs'
export const dynamic='force-dynamic'
export async function POST(request:Request){return gmailAutofill(request)}
