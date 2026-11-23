import {adminConfiguration, UUID_PATTERN} from './protocol'
export const SITE_TABLES=['editor_0_noti','editor_1_projects','editor_2_studies','editor_3_study_timetable','editor_4_schedules','editor_6_events'] as const
export const ABOUT_FIELDS={name:'학회 이름',lead:'첫 문장',greeting:'인사말',belief:'소개',founded:'창립 안내',direction:'방향성',activities:'활동 내용',support:'지원 안내',image:'대표 이미지 경로'} as const
export type AboutContent=Record<keyof typeof ABOUT_FIELDS,string>
export type SiteCommand={action:'access'|'visibility.get'|'visibility.set'|'about.get'|'about.save'|'permission.set';requestId:string;table?:string;id?:number;revision?:number;public?:boolean;content?:AboutContent;slot?:string;allowed?:boolean}
const integer=(v:unknown)=>Number.isSafeInteger(v)&&Number(v)>=0
export function parseSiteCommand(input:unknown):SiteCommand|null{
 if(!input||typeof input!=='object'||Array.isArray(input))return null
 const c=input as Record<string,unknown>
 const fields:Record<string,string[]>={access:[],'visibility.get':['table','id'],'visibility.set':['table','id','revision','public'],'about.get':[],'about.save':['revision','content'],'permission.set':['slot','allowed']}
 if(typeof c.action!=='string'||!Object.hasOwn(fields,c.action)||typeof c.requestId!=='string'||!UUID_PATTERN.test(c.requestId))return null
 if(Object.keys(c).some(k=>!['action','requestId',...fields[c.action as string]].includes(k))||fields[c.action].some(k=>!(k in c)))return null
 if(c.action.startsWith('visibility.')&&(!SITE_TABLES.includes(c.table as typeof SITE_TABLES[number])||!integer(c.id)||Number(c.id)<1))return null
 if('revision' in c&&!integer(c.revision))return null
 if('public' in c&&typeof c.public!=='boolean')return null
 if(c.action==='permission.set'&&(typeof c.slot!=='string'||!/^admin[1-9][0-9]{0,6}$/.test(c.slot)||typeof c.allowed!=='boolean'))return null
 if(c.action==='about.save'){
  if(!c.content||typeof c.content!=='object'||Array.isArray(c.content))return null
  const body=c.content as Record<string,unknown>
  if(Object.keys(body).length!==9||Object.keys(ABOUT_FIELDS).some(k=>typeof body[k]!=='string'||!body[k].trim()||body[k].length>2000||/[<>\p{Cc}\p{Cf}]/u.test(body[k])))return null
  const path=String(body.image)
  if(path!=='/campus.png'&&(!/^\/api\/images\/(notice-images|study-images|project_img|card_news)\/[A-Za-z0-9_./-]+$/.test(path)||path.includes('..')))return null
 }
 return c as SiteCommand
}
export async function handleSiteManagement(request:Request,env:Readonly<Record<string,string|undefined>>,port:(token:string)=>{verify:()=>Promise<boolean>;execute:(c:SiteCommand)=>Promise<unknown>}){
 const reply=(status:number,body:unknown)=>Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}})
 const config=adminConfiguration(env);if(!config)return reply(503,{error:'SITE_NOT_READY'})
 if(request.headers.get('origin')!==config.origin)return reply(403,{error:'ORIGIN_DENIED'})
 const token=request.headers.get('authorization')?.match(/^Bearer ([A-Za-z0-9._-]{20,8192})$/)?.[1]
 if(!token)return reply(401,{error:'AUTH_REQUIRED'})
 if(!request.headers.get('content-type')?.startsWith('application/json'))return reply(415,{error:'JSON_REQUIRED'})
 try{
  const reader=request.body?.getReader();if(!reader)return reply(400,{error:'INVALID_INPUT'})
  let text='',bytes=0;const decoder=new TextDecoder()
  for(;;){const {value,done}=await reader.read();if(done)break;bytes+=value.length;if(bytes>65536){await reader.cancel();return reply(413,{error:'INPUT_TOO_LARGE'})}text+=decoder.decode(value,{stream:true})}
  let input;try{input=JSON.parse(text+decoder.decode())}catch{return reply(400,{error:'INVALID_INPUT'})}
  const command=parseSiteCommand(input);if(!command)return reply(400,{error:'INVALID_INPUT'})
  const p=port(token);if(!await p.verify())return reply(401,{error:'AUTH_EXPIRED'})
  return reply(200,{result:await p.execute(command)})
 }catch(e){const code=e instanceof Error?e.message:'';return reply(code==='42501'?403:['PT409','40001','23505'].includes(code)?409:['22023','22P02','23514','23502','P0002'].includes(code)?400:503,{error:code==='42501'?'SITE_FORBIDDEN':['PT409','40001'].includes(code)?'SITE_CONFLICT':'SITE_UNAVAILABLE'})}
}
