import {serverClient} from '@/lib/admin/server-client'
import {adminPort} from '@/lib/admin/server'
import {adminConfiguration} from '@/lib/admin/protocol'
export const dynamic='force-dynamic'
export async function POST(request:Request){
 const reply=(status:number,body:unknown)=>Response.json(body,{status,headers:{'Cache-Control':'no-store','Vary':'Authorization, Origin','X-Content-Type-Options':'nosniff'}})
 const config=adminConfiguration(process.env)
 if(!config)return reply(503,{error:'NOT_READY'})
 if(request.headers.get('origin')!==config.origin)return reply(403,{error:'ORIGIN_DENIED'})
 const token=request.headers.get('authorization')?.match(/^Bearer ([A-Za-z0-9._-]{20,8192})$/)?.[1]
 if(!token)return reply(401,{error:'AUTH_REQUIRED'})
 if(!request.headers.get('content-type')?.startsWith('application/json'))return reply(415,{error:'JSON_REQUIRED'})
 try{
  const reader=request.body?.getReader();if(!reader)return reply(400,{error:'INVALID_INPUT'});let text='',size=0;const decoder=new TextDecoder()
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>4096){await reader.cancel();return reply(413,{error:'TOO_LARGE'})}text+=decoder.decode(value,{stream:true})}
  let command;try{command=JSON.parse(text+decoder.decode())}catch{return reply(400,{error:'INVALID_INPUT'})}if(!command||typeof command!=='object'||Array.isArray(command)||!['stats','activity'].includes(command.action)||Object.keys(command).some(k=>!['action','from','to','actor','table','kind','page','pageSize'].includes(k)))return reply(400,{error:'INVALID_INPUT'})
  if(!await adminPort(token).verify(token))return reply(401,{error:'AUTH_EXPIRED'})
  const client=serverClient(token)
  const {data,error}=await client.rpc('oaz_admin_insights_v1',{command})
  if(error||!data)return reply(error?.code==='42501'?403:['22023','22007','22008','22P02'].includes(error?.code??'')?400:503,{error:'INSIGHTS_UNAVAILABLE'})
  return reply(200,{result:data})
 }catch{return reply(503,{error:'INSIGHTS_UNAVAILABLE'})}
}
