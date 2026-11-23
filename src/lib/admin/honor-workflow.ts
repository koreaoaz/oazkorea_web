import {adminConfiguration,UUID_PATTERN} from './protocol'
export type HonorWorkflowCommand={action:'list'|'create'|'save'|'delete'|'trash'|'restore';requestId?:string;version?:number;id?:number;revision?:number;name?:string;note?:string;displayName?:string;generation?:string;affiliation?:string;introduction?:string;position?:number;confirmed?:boolean;trashId?:string}
export type HonorActor={role:string;slot:string;aal:string}
export type HonorWorkflowPort={verify:()=>Promise<boolean>;session:()=>Promise<HonorActor|null>;execute:(command:HonorWorkflowCommand)=>Promise<{data?:unknown;code?:string}>}
export function normalizeHonorName(value:unknown){
 if(typeof value!=='string'||/[\p{Cc}\p{Cf}]/u.test(value))return null
 const n=value.normalize('NFC').trim().replace(/\s+/gu,' ')
 return n.length>=1&&n.length<=100&&/^[\p{L}\p{M}\p{N} .·'’\-]+$/u.test(n)&&/[\p{L}\p{N}]/u.test(n)?n:null
}
const integer=(n:unknown)=>Number.isSafeInteger(n)&&Number(n)>=0
export function parseHonorWorkflow(value:unknown):HonorWorkflowCommand|null{
 if(!value||typeof value!=='object'||Array.isArray(value))return null
 const c={...value} as Record<string,unknown>,base=['action','requestId'],details=['generation','affiliation','introduction','position'],fields:Record<string,string[]>={list:[],trash:[],create:['version','name','note'],save:['version','id','revision','displayName',...details],delete:['version','id','revision','confirmed'],restore:['version','trashId','revision','confirmed']}
 if(typeof c.action!=='string'||!Object.hasOwn(fields,c.action)||typeof c.requestId!=='string'||!UUID_PATTERN.test(c.requestId)||Object.keys(c).some(k=>![...base,...fields[c.action as string]].includes(k)))return null
 if(!['list','requests','trash'].includes(c.action)&&!integer(c.version))return null
 if('confirmed' in c&&typeof c.confirmed!=='boolean')return null
 if(c.action==='create'){const name=normalizeHonorName(c.name);if(!name)return null;c.name=name}
 if(c.action==='save'||'displayName' in c){const name=normalizeHonorName(c.displayName);if(!name)return null;c.displayName=name}
 if(['save','approve','revoke','request-review'].includes(String(c.action))&&(!integer(c.id)||!integer(c.revision)))return null
 for(const [key,max] of [['note',2000],['generation',20],['affiliation',160],['introduction',2000]] as const){if(key in c&&(typeof c[key]!=='string'||c[key].length>max||((key==='introduction'||key==='note')?/[\p{Cf}<>\x00-\x08\x0b\x0c\x0e-\x1f]/u:/[\p{Cc}\p{Cf}<>]/u).test(c[key])))return null}
 if('position' in c&&(!integer(c.position)||Number(c.position)>999999))return null
 if(c.action==='delete'&&(!integer(c.id)||!integer(c.revision)||c.confirmed!==true))return null
 if(c.action==='restore'&&(typeof c.trashId!=='string'||!UUID_PATTERN.test(c.trashId)||!integer(c.revision)||c.confirmed!==true))return null
 return c as HonorWorkflowCommand
}
export async function handleHonorWorkflow(request:Request,env:Readonly<Record<string,string|undefined>>,factory:(token:string)=>HonorWorkflowPort){
 const reply=(status:number,error:unknown)=>Response.json(error,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}})
 const config=adminConfiguration(env);if(!config)return reply(503,{error:'HONOR_NOT_READY'})
 if(request.headers.get('origin')!==config.origin)return reply(403,{error:'ORIGIN_DENIED'})
 const token=request.headers.get('authorization')?.match(/^Bearer ([A-Za-z0-9._-]{20,8192})$/)?.[1]
 if(!token)return reply(401,{error:'AUTH_REQUIRED'})
 if(!request.headers.get('content-type')?.startsWith('application/json'))return reply(415,{error:'JSON_REQUIRED'})
 try{
  const reader=request.body?.getReader();if(!reader)return reply(400,{error:'INVALID_INPUT'})
  let text='',bytes=0;const decoder=new TextDecoder()
  for(;;){const {value,done}=await reader.read();if(done)break;bytes+=value.length;if(bytes>16384){await reader.cancel();return reply(413,{error:'INPUT_TOO_LARGE'})}text+=decoder.decode(value,{stream:true})}
  let input;try{input=JSON.parse(text+decoder.decode())}catch{return reply(400,{error:'INVALID_INPUT'})}
  const command=parseHonorWorkflow(input);if(!command)return reply(400,{error:'INVALID_INPUT'})
  const port=factory(token);if(!await port.verify())return reply(401,{error:'AUTH_EXPIRED'})
  const actor=await port.session(),superAdmin=actor?.role==='SUPER_ADMIN'&&actor.aal==='aal2'
  // Explicit ordinary-admin delegation is checked by the DB on every command.
  if(!superAdmin&&actor?.role!=='ADMIN')return reply(403,{error:'HONOR_FORBIDDEN'})
  const r=await port.execute(command)
  if(r.code)return reply(r.code==='42501'?403:['PT409','40001','23505'].includes(r.code)?409:['22023','22P02','23514','23502'].includes(r.code)?400:503,{error:r.code==='23505'?'HONOR_DUPLICATE':r.code==='42501'?'HONOR_FORBIDDEN':['PT409','40001'].includes(r.code)?'HONOR_CONFLICT':'HONOR_UNAVAILABLE'})
  if(!r.data||typeof r.data!=='object'||Array.isArray(r.data))return reply(503,{error:'HONOR_UNAVAILABLE'})
  return reply(200,{result:r.data})
 }catch{return reply(503,{error:'HONOR_UNAVAILABLE'})}
}
