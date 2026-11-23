import 'server-only'
import {rolePasswordEnabled} from '@/lib/admin/role-password-policy'
import {passwordIdentity,sessionResponse} from '@/lib/admin/password-session-server'
import {createLoginLimiter,handleUsernameLogin} from '@/lib/admin/username-login'
import {credentialRegistryReady,localLoginRegistry,usernamePort} from '@/lib/admin/username-server'
import {credentialsConfiguration} from '@/lib/admin/credentials-server'
export const dynamic='force-dynamic'
const consume=createLoginLimiter()
export async function POST(request:Request){
 const registry=await credentialRegistryReady()?new Map():await localLoginRegistry()
 if(!registry)return Response.json({error:'LOGIN_NOT_READY'},{status:503,headers:{'Cache-Control':'no-store'}})
 const response=await handleUsernameLogin(request,credentialsConfiguration()?.origin??null,usernamePort(registry),consume)
 if(!rolePasswordEnabled()||!response.ok)return response
 try{const body=await response.json();const identity=await passwordIdentity(body.session.access_token);if(!identity)throw Error();return sessionResponse(body.session,identity)}catch{return Response.json({error:'LOGIN_NOT_VERIFIED'},{status:401,headers:{'Cache-Control':'no-store'}})}
}
