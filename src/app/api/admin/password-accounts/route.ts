import 'server-only'
import {randomBytes} from 'node:crypto'
import {credentialRpc,credentialsAuth,credentialsConfiguration} from '@/lib/admin/credentials-server'
import {rolePasswordEnabled} from '@/lib/admin/role-password-policy'
import {boundedJSON} from '@/lib/admin/password-session-server'
import {passwordAllowed} from '@/lib/admin/credentials-policy'
export const dynamic='force-dynamic'
export async function POST(request:Request){
 const reply=(status:number,result:unknown)=>Response.json(result,{status,headers:{'Cache-Control':'no-store'}})
 if(!rolePasswordEnabled()||!credentialsConfiguration())return reply(503,{error:'POLICY_NOT_READY'})
 if(request.headers.get('origin')!==credentialsConfiguration()!.origin)return reply(403,{error:'ORIGIN_DENIED'})
 const token=request.headers.get('authorization')?.match(/^Bearer ([A-Za-z0-9._-]{20,8192})$/)?.[1]
 if(!token)return reply(401,{error:'AUTH_REQUIRED'})
 try{
  const b=await boundedJSON(request)
  if(Object.keys(b).some(k=>!['action','requestId','slot','username','displayName','scopes','password','currentPassword'].includes(k)))return reply(400,{error:'INVALID_INPUT'})
  const {password,currentPassword,...command}=b
  const auth=credentialsAuth(),user=await auth.auth.getUser(token)
  if(user.error||!user.data.user)return reply(401,{error:'AUTH_REQUIRED'})
  if(b.action==='password'){
   if(!passwordAllowed(password)||password===currentPassword)return reply(400,{error:'PASSWORD_RULE'})
   if(typeof currentPassword!=='string'||currentPassword.length>256)return reply(400,{error:'CURRENT_PASSWORD_REQUIRED'})
   // The same durable username throttle also bounds current-password guesses.
   const identity=await credentialRpc('password_identity',{},token);if(!identity)throw Error('42501')
   const lookup=await credentialRpc('password_service',{action:'resolve',username:identity.username})
   if(lookup?.limited)return reply(429,{error:'RETRY_LATER'})
   const proof=credentialsAuth(),p=await proof.auth.signInWithPassword({email:user.data.user.email!,password:currentPassword})
   if(p.error||p.data.user?.id!==user.data.user.id)return reply(403,{error:'REAUTHENTICATION_REQUIRED'})
   await proof.auth.signOut({scope:'local'})
  }else if(password!==undefined||currentPassword!==undefined)return reply(400,{error:'INVALID_INPUT'})
  const prepared=await credentialRpc('password_manage',command,token)
  if(!['create','reset','password'].includes(b.action))return reply(200,{result:prepared})
  if(prepared.status!=='prepared')return reply(409,{error:'OPERATION_ALREADY_COMPLETED'})
  const task=await credentialRpc('password_service',{action:'claim',taskId:prepared.taskId})
  const provider=credentialsAuth(true)
  const temporaryPassword=b.action==='password'?undefined:randomBytes(24).toString('base64url')
  let userId=task.userId
  if(b.action==='create'){
   const created=await provider.auth.admin.createUser({email:task.email,password:temporaryPassword!,email_confirm:true,ban_duration:'876000h',app_metadata:{oaz_password_operation:prepared.taskId}})
   // email_confirm is admission of a nondeliverable internal identifier, never email ownership.
   // A partial create is kept banned; never search/overwrite another Auth user on retry.
   if(created.error||!created.data.user)return reply(409,{error:'CREATE_RECONCILIATION_REQUIRED',taskId:prepared.taskId})
   userId=created.data.user.id
  }else{
   const updated=await provider.auth.admin.updateUserById(userId,{password:password??temporaryPassword})
   if(updated.error)return reply(409,{error:'PASSWORD_RECONCILIATION_REQUIRED',taskId:prepared.taskId})
  }
  const result=await credentialRpc('password_service',{action:'complete',taskId:prepared.taskId,lease:task.lease,userId})
  if(b.action==='create'){
   const enabled=await provider.auth.admin.updateUserById(userId,{ban_duration:'none'})
   if(enabled.error)return reply(409,{error:'ENABLE_RECONCILIATION_REQUIRED',taskId:prepared.taskId})
  }
  return reply(200,{result,...(temporaryPassword?{temporaryPassword}:{})})
 }catch(error){
  const code=error instanceof Error?error.message:''
  return reply(code==='42501'?403:['PT409','23505'].includes(code)?409:code==='22023'?400:503,{error:code==='42501'?'RECENT_MFA_AND_PERMISSION_REQUIRED':['PT409','23505'].includes(code)?'ACCOUNT_CONFLICT':'ACCOUNT_REQUEST_FAILED'})
 }
}
