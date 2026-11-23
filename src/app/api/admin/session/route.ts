import {rolePasswordEnabled} from '@/lib/admin/role-password-policy'
import {DELETE as deletePasswordSession} from '../auth-session/route'
import { adminConfiguration } from '@/lib/admin/protocol'
import { ADMIN_COOKIE, verifiedAdminPage } from '@/lib/admin/server'
export const dynamic='force-dynamic'
export async function POST(request:Request) {
  const config=adminConfiguration(process.env)
  if (!config || request.headers.get('origin')!==config.origin) return Response.json({error:'ADMIN_NOT_READY'},{status:403})
  const token=request.headers.get('authorization')?.match(/^Bearer ([A-Za-z0-9._-]{20,8192})$/)?.[1]
  if (!token || !await verifiedAdminPage(token)) return Response.json({error:'AUTH_REQUIRED'},{status:401,headers:{'Cache-Control':'no-store'}})
  // Short-lived access token cookie only; never store the refresh token.
  return Response.json({ok:true},{headers:{'Cache-Control':'no-store','Set-Cookie':`${ADMIN_COOKIE}=${token}; Path=/admin; HttpOnly; SameSite=Strict; Max-Age=600${config.origin.startsWith('https:')?'; Secure':''}`}})
}
export async function DELETE(request:Request) {
  if(rolePasswordEnabled())return deletePasswordSession(request)
  const config=adminConfiguration(process.env)
  if (!config || request.headers.get('origin')!==config.origin) return Response.json({error:'ORIGIN_DENIED'},{status:403})
  return Response.json({ok:true},{headers:{'Cache-Control':'no-store','Set-Cookie':`${ADMIN_COOKIE}=; Path=/admin; HttpOnly; SameSite=Strict; Max-Age=0${config.origin.startsWith('https:')?'; Secure':''}`}})
}
