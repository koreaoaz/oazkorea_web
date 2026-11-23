import 'server-only'
import {createLoginLimiter,handleUsernameLogin} from '@/lib/admin/username-login'
import {enrollmentConfiguration,enrollmentLoginPort} from '@/lib/admin/enrollment-server'
export const dynamic='force-dynamic'
const consume=createLoginLimiter()
export async function POST(request:Request){
 const c=enrollmentConfiguration()
 if(!c)return Response.json({error:'ENROLLMENT_NOT_READY'},{status:503,headers:{'Cache-Control':'no-store'}})
 return handleUsernameLogin(request,c.origin,enrollmentLoginPort(),consume)
}
