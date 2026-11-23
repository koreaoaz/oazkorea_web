import 'server-only'
import {enrollmentConfiguration,enrollmentAuth,enrollmentRpc} from '@/lib/admin/enrollment-server'
export const dynamic='force-dynamic'
export async function POST(request:Request){
 const reply=(status:number,body:unknown)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}})
 const c=enrollmentConfiguration();if(!c)return reply(503,{error:'ENROLLMENT_NOT_READY'})
 if(request.headers.get('origin')!==c.origin)return reply(403,{error:'ORIGIN_DENIED'})
 const token=request.headers.get('authorization')?.match(/^Bearer ([A-Za-z0-9._-]{20,8192})$/)?.[1]
 if(!token)return reply(401,{error:'AUTH_REQUIRED'})
 if(!request.headers.get('content-type')?.startsWith('application/json'))return reply(415,{error:'JSON_REQUIRED'})
 try{
  const reader=request.body?.getReader();if(!reader)return reply(400,{error:'INVALID_REQUEST'})
  let text='',size=0;const decoder=new TextDecoder('utf-8',{fatal:true})
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>512){await reader.cancel();return reply(413,{error:'TOO_LARGE'})}text+=decoder.decode(value,{stream:true})}
  const body=JSON.parse(text+decoder.decode())
  if(!body||Array.isArray(body)||Object.keys(body).some(k=>k!=='action')||!['status','activate'].includes(body.action))return reply(400,{error:'INVALID_REQUEST'})
  const {data,error}=await enrollmentAuth().auth.getUser(token);if(error||!data.user)return reply(401,{error:'AUTH_REQUIRED'})
  const result=await enrollmentRpc(body.action,undefined,token)
  if(result?.userId!==data.user.id)return reply(403,{error:'IDENTITY_MISMATCH'})
  return reply(200,{state:result.state,slot:result.slot,mfaRequired:result.mfaRequired})
 }catch{return reply(403,{error:'ENROLLMENT_NOT_VERIFIED'})}
}
