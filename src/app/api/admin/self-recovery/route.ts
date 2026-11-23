import 'server-only'
import {createHash,randomBytes,randomUUID} from 'node:crypto'
import {cookies} from 'next/headers'
import {NextResponse} from 'next/server'
import {credentialRpc,credentialsAuth,credentialsConfiguration} from '@/lib/admin/credentials-server'
import {rolePasswordEnabled} from '@/lib/admin/role-password-policy'
import {boundedJSON,clearPasswordCookies} from '@/lib/admin/password-session-server'
import {passwordAllowed} from '@/lib/admin/credentials-policy'
export const dynamic='force-dynamic'
const grantCookie='oaz_recovery_grant',refreshCookie='oaz_recovery_refresh',path='/api/admin/self-recovery'
const digest=(value:string)=>createHash('sha256').update(value).digest('hex')
export async function POST(request:Request){
 const config=credentialsConfiguration()
 const reply=(status:number,body:unknown)=>NextResponse.json(body,{status,headers:{'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}})
 if(!rolePasswordEnabled()||!config)return reply(503,{error:'RECOVERY_NOT_READY'})
 if(request.headers.get('origin')!==config.origin)return reply(403,{error:'ORIGIN_DENIED'})
 const email=config.local?process.env.OAZ_SYNTHETIC_RECOVERY_EMAIL:'koreaoaz@gmail.com'
 if(!email||(config.local&&!/^[a-z0-9.]+@example\.invalid$/.test(email)))return reply(503,{error:'RECOVERY_NOT_READY'})
 const bind=(response:NextResponse,refresh:string,grant?:string)=>{
  const options={httpOnly:true,secure:config.origin.startsWith('https:'),sameSite:'strict' as const,path,maxAge:600}
  response.cookies.set(refreshCookie,refresh,options)
  if(grant)response.cookies.set(grantCookie,grant,options)
  return response
 }
 try{
  const b=await boundedJSON(request,4096)
  const keys:Record<string,string[]>={request:['action'],verify:['action','token'],challenge:['action','code'],finish:['action','password']}
  if(typeof b.action!=='string'||!keys[b.action]||Object.keys(b).some(k=>!keys[b.action].includes(k)))return reply(400,{error:'INVALID_INPUT'})
  if(b.action==='request'){
   if(process.env.OAZ_SUPERADMIN_RECOVERY_DELIVERY!=='smtp-tokenhash-v1')return reply(503,{error:'RECOVERY_DELIVERY_NOT_READY'})
   const target=await credentialRpc('super_recovery_service',{action:'request',email})
   if(target?.email===email){
    const sent=await credentialsAuth().auth.resetPasswordForEmail(email,{redirectTo:config.origin+'/admin/recover'})
    if(sent.error)return reply(503,{error:'RECOVERY_DELIVERY_NOT_CONFIRMED'})
   }
   return reply(200,{ok:true,message:'등록된 최고관리자 주소로 요청을 처리했습니다. 메일이 없으면 잠시 후 담당자에게 문의하세요.'})
  }
  const auth=credentialsAuth()
  if(b.action==='verify'){
   if(typeof b.token!=='string'||!/^[a-f0-9]{40,128}$/.test(b.token))throw Error()
   const verified=await auth.auth.verifyOtp({type:'recovery',token_hash:b.token})
   const session=verified.data.session,user=verified.data.user
   if(verified.error||!session||user?.email!==email)throw Error()
   const claims=JSON.parse(Buffer.from(session.access_token.split('.')[1],'base64url').toString())
   const grant=randomBytes(32).toString('hex')
   const issued=await credentialRpc('super_recovery_service',{action:'issue',email,userId:user.id,sessionId:claims.session_id,digest:digest(grant)})
   if(!issued?.ok){await auth.auth.signOut({scope:'local'});throw Error()}
   return bind(reply(200,{stage:'totp'}),session.refresh_token,grant)
  }
  const jar=await cookies(),grant=jar.get(grantCookie)?.value,refresh=jar.get(refreshCookie)?.value
  if(!grant||!/^[a-f0-9]{64}$/.test(grant)||!refresh)throw Error()
  const refreshed=await auth.auth.refreshSession({refresh_token:refresh})
  let session=refreshed.data.session
  if(refreshed.error||!session||refreshed.data.user?.email!==email)throw Error()
  if(b.action==='challenge'){
   if(typeof b.code!=='string'||!/^\d{6}$/.test(b.code))return bind(reply(400,{error:'TOTP_REQUIRED'}),session.refresh_token)
   const factors=await auth.auth.mfa.listFactors()
   const factor=factors.data?.totp.find(x=>x.status==='verified')
   if(factors.error||!factor)return bind(reply(403,{error:'OWNER_RECOVERY_REQUIRED'}),session.refresh_token)
   const verified=await auth.auth.mfa.challengeAndVerify({factorId:factor.id,code:b.code})
   if(verified.error)return bind(reply(403,{error:'TOTP_REJECTED'}),session.refresh_token)
   session=(await auth.auth.getSession()).data.session
   if(!session)throw Error()
   return bind(reply(200,{stage:'password'}),session.refresh_token)
  }
  if(!passwordAllowed(b.password))return bind(reply(400,{error:'PASSWORD_RULE'}),session.refresh_token)
  const prepared=await credentialRpc('super_recovery_claim',{digest:digest(grant),requestId:randomUUID()},session.access_token)
  const task=await credentialRpc('password_service',{action:'claim',taskId:prepared.taskId})
  if(task.userId!==session.user.id||task.slot!=='admin1'||task.action!=='password')throw Error()
  const provider=credentialsAuth(true)
  const revoked=await provider.auth.admin.signOut(session.access_token,'global')
  if(revoked.error)return reply(409,{error:'OWNER_RECONCILIATION_REQUIRED'})
  const updated=await provider.auth.admin.updateUserById(task.userId,{password:b.password})
  if(updated.error)return reply(409,{error:'OWNER_RECONCILIATION_REQUIRED'})
  await credentialRpc('password_service',{action:'complete',taskId:prepared.taskId,lease:task.lease,userId:task.userId})
  const response=clearPasswordCookies()
  for(const name of [grantCookie,refreshCookie])response.cookies.set(name,'',{path,httpOnly:true,secure:config.origin.startsWith('https:'),sameSite:'strict',maxAge:0})
  return response
 }catch{return reply(403,{error:'RECOVERY_DENIED'})}
}
