import 'server-only'
import {credentialRpc,credentialsAuth,credentialsConfiguration} from '@/lib/admin/credentials-server'
import {passwordAllowed} from '@/lib/admin/credentials-policy'
import {isDesktopLocalProfile,reviewedMainRuntime} from '@/lib/security-profile'
export const dynamic='force-dynamic'
export async function POST(request:Request){
 const reply=(status:number,result:unknown)=>Response.json(result,{status,headers:{'Cache-Control':'no-store'}})
 const config=credentialsConfiguration();if(!config)return reply(503,{error:'ACCOUNTS_NOT_READY'})
 if(request.headers.get('origin')!==config.origin)return reply(403,{error:'ORIGIN_DENIED'})
 const token=request.headers.get('authorization')?.match(/^Bearer ([A-Za-z0-9._-]{20,8192})$/)?.[1]
 if(!token)return reply(401,{error:'AUTH_REQUIRED'})
 if(!request.headers.get('content-type')?.startsWith('application/json'))return reply(415,{error:'JSON_REQUIRED'})
 try{
  const reader=request.body?.getReader();if(!reader)return reply(400,{error:'INVALID_INPUT'})
  let text='',length=0;const decoder=new TextDecoder('utf-8',{fatal:true})
  while(true){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>8192){await reader.cancel();return reply(413,{error:'TOO_LARGE'})}text+=decoder.decode(value,{stream:true})}
  const b=JSON.parse(text+decoder.decode())
  if(!b||Array.isArray(b)||typeof b!=='object'||Object.keys(b).some(k=>!['action','requestId','slot','revision','username','password','currentPassword','taskId'].includes(k)))return reply(400,{error:'INVALID_INPUT'})
  const auth=credentialsAuth();const user=await auth.auth.getUser(token);if(user.error||!user.data.user)return reply(401,{error:'AUTH_REQUIRED'})
  const {password,currentPassword,...command}=b
  if(['password','reset.finish'].includes(b.action)&&!passwordAllowed(password))return reply(400,{error:'PASSWORD_RULE'})
  if(b.action==='password'){
   if(typeof currentPassword!=='string'||currentPassword.length>256)return reply(400,{error:'CURRENT_PASSWORD_REQUIRED'})
   const proof=credentialsAuth();const p=await proof.auth.signInWithPassword({email:user.data.user.email!,password:currentPassword})
   if(p.error||p.data.user?.id!==user.data.user.id)return reply(403,{error:'REAUTHENTICATION_REQUIRED'})
   await proof.auth.signOut({scope:'local'})
  }
  if(b.action==='reset.finish'){
   const task=await credentialRpc('accounts_manage',{action:'reset.claim',taskId:b.taskId},token)
   // Local GoTrue invalidates the recovery session on password update. Revoke
   // globally while the target JWT still identifies a live session.
   const revokeFirst=isDesktopLocalProfile(process.env)
   if(revokeFirst){const revoked=await credentialsAuth(true).auth.admin.signOut(token,'global');if(revoked.error)return reply(503,{error:'SESSION_REVOCATION_NOT_CONFIRMED'})}
   // Official Auth applies its own MFA/password checks; no direct auth.users update.
   const updated=await credentialsAuth(true).auth.admin.updateUserById(task.userId,{password})
   if(updated.error)return reply(409,{error:'PASSWORD_REVIEW_REQUIRED'})
   const result=await credentialRpc('accounts_service',{action:'task.complete',taskId:b.taskId,lease:task.lease})
   // DB 회수는 이미 완료됐다. Auth refresh 세션도 전부 회수하며 실패를 성공으로 숨기지 않는다.
   if(!revokeFirst){const revoked=await credentialsAuth(true).auth.admin.signOut(token,'global')
   if(revoked.error)return reply(503,{error:'PASSWORD_CHANGED_SESSION_REVIEW_REQUIRED'})}
   return reply(200,{result})
  }
  if(b.action==='reset'&&reviewedMainRuntime(process.env)&&process.env.OAZ_ACCOUNTS_RECOVERY_DELIVERY!=='smtp-tokenhash-v1')return reply(503,{error:'RECOVERY_DELIVERY_NOT_CONFIGURED'})
  const prepared=await credentialRpc('accounts_manage',command,token)
  if(!['reset','password'].includes(b.action)||prepared.status!=='prepared')return reply(200,{result:prepared})
  const task=await credentialRpc('accounts_service',{action:'task.claim',taskId:prepared.taskId})
  if(b.action==='reset'){
   if(process.env.OAZ_ACCOUNTS_RECOVERY_DELIVERY==='smtp-tokenhash-v1'){
    // 운영에서는 승인된 메일 템플릿/SMTP/redirect 검증 후에만 켠다.
    // 토큰을 응답으로 반환하지 않으며 Auth가 직접 이메일을 발송한다.
    const sent=await credentialsAuth().auth.resetPasswordForEmail(task.email,{redirectTo:config.origin+'/admin/password-reset?task='+encodeURIComponent(prepared.taskId)})
    if(sent.error)return reply(503,{error:'RECOVERY_DELIVERY_NOT_CONFIRMED'})
    return reply(200,{result:{status:'recovery-email-requested',taskId:prepared.taskId}})
   }
   const generated=await credentialsAuth(true).auth.admin.generateLink({type:'recovery',email:task.email})
   if(generated.error||!generated.data.properties.hashed_token)return reply(409,{error:'RESET_LINK_REVIEW_REQUIRED'})
   return reply(200,{result:{status:'link-issued',taskId:prepared.taskId,
    recoveryLink:config.origin+'/admin/password-reset?task='+prepared.taskId+'#token='+encodeURIComponent(generated.data.properties.hashed_token)}})
  }
  const revokeFirst=isDesktopLocalProfile(process.env)
  if(revokeFirst){const revoked=await credentialsAuth(true).auth.admin.signOut(token,'global');if(revoked.error)return reply(503,{error:'SESSION_REVOCATION_NOT_CONFIRMED'})}
  const updated=await credentialsAuth(true).auth.admin.updateUserById(task.userId,{password})
  if(updated.error)return reply(409,{error:'PASSWORD_REVIEW_REQUIRED'})
  const result=await credentialRpc('accounts_service',{action:'task.complete',taskId:prepared.taskId,lease:task.lease})
  if(!revokeFirst){const revoked=await credentialsAuth(true).auth.admin.signOut(token,'global')
  if(revoked.error)return reply(503,{error:'PASSWORD_CHANGED_SESSION_REVIEW_REQUIRED'})}
  return reply(200,{result})
 }catch(error){
  const code=error instanceof Error?error.message:''
  return reply(code==='42501'?403:['PT409','23505'].includes(code)?409:code==='22023'?400:503,
   {error:code==='42501'?'RECENT_MFA_AND_PERMISSION_REQUIRED':['PT409','23505'].includes(code)?'ACCOUNT_CONFLICT':'ACCOUNT_REQUEST_FAILED'})
 }
}
