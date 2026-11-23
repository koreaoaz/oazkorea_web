import {adminConfiguration} from './protocol'
import {localProfile,reviewedMainRuntime} from '../security-profile'
export const IMAGE_LIMIT=5*1024*1024
export const MEDIA_BUCKETS:Readonly<Record<string,string>>={'editor_0_noti':'notice-images','editor_1_projects':'project_img','editor_2_studies':'study-images','editor_6_events':'card_news'}
export type MediaPort={
 identity:()=>Promise<{id:string;role:string;scopes:string[]}|null>
 normalize:(bytes:Uint8Array)=>Promise<Uint8Array>
 reserve:(actor:string,bucket:string,path:string,size:number,raw?:boolean)=>Promise<boolean>
 upload:(bucket:string,path:string,bytes:Uint8Array)=>Promise<boolean>
 finish:(path:string)=>Promise<boolean>
}
export async function handleMediaUpload(request:Request,env:Readonly<Record<string,string|undefined>>,factory:(token:string)=>MediaPort){
 const reply=(status:number,error:string)=>Response.json({error},{status,headers:{'Cache-Control':'no-store'}})
 const config=adminConfiguration(env)
 const main=reviewedMainRuntime(env),limit=main?4*1024*1024:IMAGE_LIMIT
 const profile=localProfile(env),pair=[profile.web,profile.api]
 if(!config||!main&&(env.OAZ_LOCAL_ADMIN_DEV!=='true'||config.origin!==pair[0]||env.NEXT_PUBLIC_SUPABASE_URL!==pair[1]))return reply(503,'LOCAL_MEDIA_NOT_READY')
 if((main||env.OAZ_FINAL_INTEGRATION==='true')&&request.headers.get('x-oaz-public-rights')!=='approved-image')return reply(400,'PUBLIC_RIGHTS_REQUIRED')
 if(request.headers.get('origin')!==config.origin)return reply(403,'ORIGIN_DENIED')
 const token=request.headers.get('authorization')?.match(/^Bearer ([A-Za-z0-9._-]{20,8192})$/)?.[1]
 if(!token)return reply(401,'AUTH_REQUIRED')
 const table=request.headers.get('x-oaz-table')??'',bucket=MEDIA_BUCKETS[table]
 if(!bucket)return reply(400,'UNSUPPORTED_CONTENT')
 try{
  const port=factory(token),actor=await port.identity()
  if(!actor)return reply(401,'AUTH_EXPIRED')
  if(actor.role!=='SUPER_ADMIN'&&!actor.scopes.includes(table))return reply(403,'CONTENT_SCOPE_DENIED')
  const mime=request.headers.get('content-type')??''
  if(!['image/png','image/jpeg','image/webp'].includes(mime))return reply(415,'IMAGE_TYPE_UNSUPPORTED')
  if(Number(request.headers.get('content-length'))>limit)return reply(413,'IMAGE_TOO_LARGE')
  const reader=request.body?.getReader();if(!reader)return reply(400,'IMAGE_REQUIRED')
  const chunks:Uint8Array[]=[];let size=0
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>limit){await reader.cancel();return reply(413,'IMAGE_TOO_LARGE')}chunks.push(value)}
  if(!size)return reply(400,'IMAGE_REQUIRED')
  const input=new Uint8Array(size);let offset=0;for(const part of chunks){input.set(part,offset);offset+=part.length}
  let bytes:Uint8Array
  try{bytes=await port.normalize(input)}catch{return reply(400,'INVALID_IMAGE')}
  if(!bytes.length||bytes.length>limit)return reply(413,'IMAGE_TOO_LARGE')
  const path=`managed/${crypto.randomUUID()}.webp`
  if(!await port.reserve(actor.id,bucket,path,bytes.length))return reply(403,'CURRENT_CONTENT_SCOPE_DENIED')
  if(!await port.upload(bucket,path,bytes))return reply(503,'UPLOAD_UNCONFIRMED')
  if(!await port.finish(path))return reply(403,'UPLOAD_REVIEW_REQUIRED')
  return Response.json({bucket,path},{status:201,headers:{'Cache-Control':'no-store'}})
 }catch{return reply(503,'MEDIA_UNAVAILABLE')}
}
