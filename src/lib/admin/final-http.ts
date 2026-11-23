import {parseFinalCommand,type FinalCommand} from './final-contract'
import {isFinalLocalProfile,reviewedMainRuntime} from '../security-profile'
type Port={verify:(token:string)=>Promise<string|null>;execute:(command:FinalCommand)=>Promise<{data:unknown;code?:string}>}
export async function handleFinalRequest(req:Request,env:Record<string,string|undefined>,factory:(token:string)=>Port){
 const reply=(status:number,body:unknown)=>Response.json(body,{status,headers:{'Cache-Control':'no-store','Vary':'Authorization, Origin','X-Content-Type-Options':'nosniff'}})
 const local=isFinalLocalProfile(env)
 if(!local&&!reviewedMainRuntime(env))return reply(503,{error:'FINAL_INTEGRATION_NOT_READY'})
 if(req.method!=='POST')return reply(405,{error:'METHOD_NOT_ALLOWED'})
 if(req.headers.get('origin')!==env.OAZ_ADMIN_ORIGIN)return reply(403,{error:'ORIGIN_DENIED'})
 const token=req.headers.get('authorization')?.match(/^Bearer ([A-Za-z0-9._-]{20,8192})$/)?.[1];if(!token)return reply(401,{error:'AUTH_REQUIRED'})
 if(!req.headers.get('content-type')?.startsWith('application/json'))return reply(415,{error:'JSON_REQUIRED'})
 try{
  const reader=req.body?.getReader();if(!reader)return reply(400,{error:'INVALID_COMMAND'})
  let size=0,text='';const decoder=new TextDecoder()
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>65536){await reader.cancel();return reply(413,{error:'TOO_LARGE'})}text+=decoder.decode(value,{stream:true})}
  let value;try{value=JSON.parse(text+decoder.decode())}catch{return reply(400,{error:'INVALID_COMMAND'})}
  const command=parseFinalCommand(value);if(!command)return reply(400,{error:'INVALID_COMMAND'})
  const revokeOwn=command.action==='sessions.revoke'
  if(!local&&!revokeOwn&&(command.table!=='editor_0_noti'||!['translation.list','translation.get','translation.save'].includes(command.action)))return reply(503,{error:'FINAL_INTEGRATION_NOT_READY'})
  const port=factory(token);const verifiedId=await port.verify(token)
  if(!verifiedId)return reply(401,{error:'AUTH_EXPIRED'})
  if(!local&&revokeOwn&&command.userId!==verifiedId)return reply(403,{error:'OWN_SESSION_REQUIRED'})
  const result=await port.execute(command)
  if(result.code){const status=result.code==='42501'?403:['PT409','40001','23505'].includes(result.code)?409:['22023','22P02','22007','22008','23514'].includes(result.code)?400:503;return reply(status,{error:status===403?'FORBIDDEN':status===409?'CONFLICT':'FINAL_REQUEST_FAILED'})}
  return reply(200,{result:result.data})
 }catch{return reply(503,{error:'FINAL_UNAVAILABLE'})}
}
