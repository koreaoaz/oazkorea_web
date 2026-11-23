import 'server-only'
import {randomBytes} from 'node:crypto'
import {credentialsAuth,credentialsConfiguration} from '@/lib/admin/credentials-server'
import {isDesktopLocalProfile,reviewedMainRuntime} from '@/lib/security-profile'
import {passwordAllowed} from '@/lib/admin/credentials-policy'
export const dynamic='force-dynamic'
async function rpc(name:string,command:unknown,token:string){
 const c=credentialsConfiguration()!
 const r=await fetch(c.rpc+name,{method:'POST',cache:'no-store',redirect:'error',headers:{'Content-Type':'application/json','x-oaz-server-gate':c.gate,Authorization:'Bearer '+token},body:JSON.stringify({command})})
 if(!r.ok)throw Error(r.status===403?'DENIED':r.status===409?'CONFLICT':'UNAVAILABLE')
 return r.json()
}
export async function POST(request:Request){
 const reply=(status:number,data:unknown)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}})
 const production=reviewedMainRuntime(process.env);
 if(!isDesktopLocalProfile(process.env)&&!production)return reply(503,{error:'LOCAL_INVITATIONS_NOT_READY'})
 if(production&&process.env.OAZ_ACCOUNTS_RECOVERY_DELIVERY!=='smtp-tokenhash-v1')return reply(503,{error:'INVITATION_DELIVERY_NOT_READY'})
 const c=credentialsConfiguration();if(!c)return reply(503,{error:'ACCOUNTS_NOT_READY'});if(request.headers.get('origin')!==c.origin)return reply(403,{error:'ORIGIN_DENIED'})
 const token=request.headers.get('authorization')?.match(/^Bearer ([A-Za-z0-9._-]{20,8192})$/)?.[1];if(!token)return reply(401,{error:'AUTH_REQUIRED'})
 if(!request.headers.get('content-type')?.startsWith('application/json'))return reply(415,{error:'JSON_REQUIRED'})
 try{
  const reader=request.body?.getReader();if(!reader)return reply(400,{error:'INVALID_INPUT'})
  let text='',size=0;const decoder=new TextDecoder('utf-8',{fatal:true});while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>8192){await reader.cancel();return reply(413,{error:'TOO_LARGE'})}text+=decoder.decode(value,{stream:true})}
  const b=JSON.parse(text+decoder.decode());if(!b||Array.isArray(b)||typeof b!=='object')return reply(400,{error:'INVALID_INPUT'})
  const user=await credentialsAuth().auth.getUser(token);if(user.error||!user.data.user)return reply(401,{error:'AUTH_REQUIRED'})
  if(b.action==='accept'){
   if(Object.keys(b).some(k=>!['action','id','password'].includes(k))||!passwordAllowed(b.password))return reply(400,{error:'INVALID_INPUT'})
   const t=await rpc('invitation_accept',{id:b.id},token)
   const changed=await credentialsAuth(true).auth.admin.updateUserById(t.userId,{password:b.password});if(changed.error)return reply(503,{error:'PASSWORD_REVIEW_REQUIRED'})
   await rpc('invitation_service',{action:'accepted',id:b.id},c.rpcService)
   return reply(200,{status:'accepted'})
  }
  if(!['list','prepare','resend','cancel'].includes(b.action))return reply(400,{error:'INVALID_INPUT'})
  const t=await rpc('invitation_manage',b,token)
  if(b.action==='list')return reply(200,{invitations:t})
  if(b.action==='cancel')return reply(200,{status:t.status})
  if(b.action==='prepare'&&t.status==='pending'&&t.delivered_at)return reply(200,{status:'pending',id:t.id,slot:t.slot})
  if(!['prepared','pending'].includes(t.status))return reply(409,{error:'INVITATION_STATE_CONFLICT'})
  let current=t
  if(t.status==='prepared'){
   const admin=credentialsAuth(true).auth.admin
   const result=await admin.createUser({email:t.email,password:randomBytes(36).toString('base64url'),email_confirm:true,ban_duration:'876000h',app_metadata:{oaz_invitation:t.id}})
   let id=result.data?.user?.id
   if(result.error&&!production){const list=await admin.listUsers({page:1,perPage:1000});const matches=list.data?.users.filter(u=>u.email===t.email&&u.app_metadata.oaz_invitation===t.id);if(matches?.length===1)id=matches[0].id}
   if(!id)return reply(409,{error:'IDENTITY_REVIEW_REQUIRED'})
   current=await rpc('invitation_service',{action:'register',id:t.id,userId:id},c.rpcService)
  }
  const unban=await credentialsAuth(true).auth.admin.updateUserById(current.user_id,{ban_duration:'none'});if(unban.error)return reply(503,{error:'INVITATION_REVIEW_REQUIRED'})
  const sent=await credentialsAuth().auth.resetPasswordForEmail(current.email,{redirectTo:c.origin+'/admin/invite?id='+encodeURIComponent(current.id)})
  if(sent.error)return reply(503,{error:'DELIVERY_NOT_CONFIRMED'})
  await rpc('invitation_service',{action:'sent',id:current.id},c.rpcService)
  return reply(200,{status:'pending',id:current.id,slot:current.slot})
 }catch(error){const code=error instanceof Error?error.message:'';return reply(code==='DENIED'?403:code==='CONFLICT'?409:503,{error:code==='DENIED'?'RECENT_MFA_AND_PERMISSION_REQUIRED':'INVITATION_REVIEW_REQUIRED'})}
}
