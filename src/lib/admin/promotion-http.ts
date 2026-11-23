import {adminConfiguration} from './protocol'
import {localProfile} from '../security-profile'
import {parsePromotionCommand,type PromotionCommand} from './promotion-contract'
export type PromotionPort={verify:(token:string)=>Promise<boolean>;execute:(command:PromotionCommand)=>Promise<{data:unknown;code?:string}>}
export async function handlePromotionRequest(request:Request,env:Readonly<Record<string,string|undefined>>,factory:(token:string)=>PromotionPort){
 const reply=(status:number,body:unknown)=>Response.json(body,{status,headers:{'Cache-Control':'no-store','Vary':'Authorization, Origin','X-Content-Type-Options':'nosniff'}})
 const config=adminConfiguration(env),profile=localProfile(env)
 if(!config||env.OAZ_LOCAL_ADMIN_DEV!=='true'||config.origin!==profile.web||env.NEXT_PUBLIC_SUPABASE_URL!==profile.api)return reply(503,{error:'LOCAL_PROMOTION_NOT_READY'})
 if(request.method!=='POST')return reply(405,{error:'METHOD_NOT_ALLOWED'})
 if(request.headers.get('origin')!==config.origin)return reply(403,{error:'ORIGIN_DENIED'})
 const token=request.headers.get('authorization')?.match(/^Bearer ([A-Za-z0-9._-]{20,8192})$/)?.[1];if(!token)return reply(401,{error:'AUTH_REQUIRED'})
 if(!request.headers.get('content-type')?.startsWith('application/json'))return reply(415,{error:'JSON_REQUIRED'})
 try{
  const reader=request.body?.getReader();if(!reader)return reply(400,{error:'INVALID_COMMAND'});let text='',size=0;const decoder=new TextDecoder()
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>65536){await reader.cancel();return reply(413,{error:'TOO_LARGE'})}text+=decoder.decode(value,{stream:true})}
  let value;try{value=JSON.parse(text+decoder.decode())}catch{return reply(400,{error:'INVALID_COMMAND'})}
  const command=parsePromotionCommand(value);if(!command)return reply(400,{error:'INVALID_COMMAND'})
  const port=factory(token);if(!await port.verify(token))return reply(401,{error:'AUTH_EXPIRED'});const result=await port.execute(command)
  if(result.code){if(result.code==='PTM01')return reply(409,{error:'MANUAL_REVIEW_REQUIRED'});if(result.code==='PTE01')return reply(409,{error:'ENGLISH_REVIEW_REQUIRED'});const status=result.code==='42501'?403:['PT409','40001','23505'].includes(result.code)?409:['22023','22P02','22007','22008','23514'].includes(result.code)?400:503;return reply(status,{error:status===403?'FORBIDDEN':status===409?'CONFLICT':status===400?'INVALID_INPUT':'PROMOTION_UNAVAILABLE'})}
  return reply(200,{result:result.data})
 }catch{return reply(503,{error:'PROMOTION_UNAVAILABLE'})}
}
