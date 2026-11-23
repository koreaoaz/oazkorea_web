import {handleGmailReview} from '@/lib/gmail-review-server'
export const runtime='nodejs'
export const dynamic='force-dynamic'
export async function POST(request:Request){return handleGmailReview(request)}
