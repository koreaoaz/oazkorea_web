import {adminConfiguration,UUID_PATTERN} from './protocol'
const tables=['editor_0_noti','editor_1_projects','editor_2_studies','editor_3_study_timetable','editor_4_schedules','editor_6_events']
export type TrashReviewCommand={action:'list'|'detail';table:string;trashId?:string}
export type TrashActor={role:string;slot:string;aal:string;scopes:string[];promotion?:{manualEdit:boolean}}
export type TrashReviewPort={verify:()=>Promise<boolean>;session:()=>Promise<TrashActor|null>;execute:(command:TrashReviewCommand)=>Promise<{data?:unknown;code?:string}>}
export type TrashRecord={id:string;table:string;record_id:number;title:string;isPromotion:boolean;deleted_at:string;retain_until:string;revision:number;restorable:boolean;restored_at:string|null;body?:string;publicationDate?:string|null;attachments?:unknown}
export function parseTrashReview(value:unknown):TrashReviewCommand|null{
 if(!value||typeof value!=='object'||Array.isArray(value))return null
 const c=value as Record<string,unknown>
 if(!['list','detail'].includes(String(c.action))||typeof c.table!=='string'||!tables.includes(c.table)||Object.keys(c).some(k=>!['action','table',...(c.action==='detail'?['trashId']:[])].includes(k)))return null
 if(c.action==='detail'&&(typeof c.trashId!=='string'||!UUID_PATTERN.test(c.trashId)))return null
 return c as TrashReviewCommand
}
export async function handleTrashReview(request:Request,env:Readonly<Record<string,string|undefined>>,factory:(token:string)=>TrashReviewPort){
 const reply=(status:number,data:unknown)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}})
 const config=adminConfiguration(env);if(!config)return reply(503,{error:'TRASH_NOT_READY'})
 if(request.headers.get('origin')!==config.origin)return reply(403,{error:'ORIGIN_DENIED'})
 const token=request.headers.get('authorization')?.match(/^Bearer ([A-Za-z0-9._-]{20,8192})$/)?.[1]
 if(!token)return reply(401,{error:'AUTH_REQUIRED'})
 if(!request.headers.get('content-type')?.startsWith('application/json'))return reply(415,{error:'JSON_REQUIRED'})
 try{
  const reader=request.body?.getReader();if(!reader)return reply(400,{error:'INVALID_INPUT'})
  let text='',bytes=0;const decoder=new TextDecoder()
  for(;;){const {value,done}=await reader.read();if(done)break;bytes+=value.length;if(bytes>4096){await reader.cancel();return reply(413,{error:'INPUT_TOO_LARGE'})}text+=decoder.decode(value,{stream:true})}
  let value;try{value=JSON.parse(text+decoder.decode())}catch{return reply(400,{error:'INVALID_INPUT'})}
  const command=parseTrashReview(value);if(!command)return reply(400,{error:'INVALID_INPUT'})
  const port=factory(token);if(!await port.verify())return reply(401,{error:'AUTH_EXPIRED'})
  const actor=await port.session(),superAdmin=actor?.role==='SUPER_ADMIN'&&actor.slot==='admin1'&&actor.aal==='aal2'
  if(!actor||(!superAdmin&&!(actor.role==='ADMIN'&&/^admin[2-5]$/.test(actor.slot)&&(actor.scopes.includes(command.table)||command.table==='editor_0_noti'&&actor.promotion?.manualEdit))))return reply(403,{error:'TRASH_FORBIDDEN'})
  const result=await port.execute(command)
  if(result.code)return reply(result.code==='42501'?403:['22023','22P02'].includes(result.code)?400:503,{error:'TRASH_UNAVAILABLE'})
  if(!result.data||typeof result.data!=='object')return reply(503,{error:'TRASH_UNAVAILABLE'})
  return reply(200,{result:result.data})
 }catch{return reply(503,{error:'TRASH_UNAVAILABLE'})}
}
