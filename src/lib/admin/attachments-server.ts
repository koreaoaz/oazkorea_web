import 'server-only'
import {serverClient} from './server-client'
import {managedMediaEnabled,mediaByteLimit,mediaUploaderKey} from './media-credentials'
import {createHash} from 'node:crypto'
import {reviewedMainRuntime} from '../security-profile'
import {normalizePublicPDF} from './pdf-normalize'
const bucket='oaz-public-documents-staging',uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const enabled=()=>managedMediaEnabled(process.env);
const client=serverClient;
const userStorage=()=>process.env.OAZ_GATEWAY_TRANSPORT==='data-api-v1'&&Boolean(reviewedMainRuntime(process.env));
const uploader=async(token?:string)=>userStorage()?client(token):client(await mediaUploaderKey());
const reply=(status:number,error:string)=>Response.json({error},{status,headers:{'Cache-Control':'no-store'}});
async function bounded(request:Request,max:number){const reader=request.body?.getReader();if(!reader)throw Error('INVALID_INPUT');let size=0;const chunks:Uint8Array[]=[];while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>max){await reader.cancel();throw Error('TOO_LARGE')}chunks.push(value)}return Buffer.concat(chunks)}
export async function attachmentRequest(request:Request){
 const limit=mediaByteLimit(process.env);
 if(!enabled())return reply(503,'DOCUMENTS_NOT_CONFIGURED');
 if(request.method!=='POST')return reply(405,'METHOD_NOT_ALLOWED');
 if(request.headers.get('origin')!==process.env.OAZ_ADMIN_ORIGIN)return reply(403,'ORIGIN_DENIED');
 const token=request.headers.get('authorization')?.match(/^Bearer ([A-Za-z0-9._-]{20,8192})$/)?.[1];if(!token)return reply(401,'AUTH_REQUIRED');
 try{
  const c=client(token);const user=await c.auth.getUser(token);if(user.error||!user.data.user)return reply(401,'AUTH_EXPIRED');
  const session=await c.rpc('oaz_admin_command_v2',{command:{action:'session',version:0,requestId:crypto.randomUUID()}});
  if(session.error||!session.data)return reply(403,'FORBIDDEN');
  if(session.data.role==='SUPER_ADMIN'&&session.data.aal!=='aal2')return reply(403,'MFA_REQUIRED');
  const mime=request.headers.get('content-type')??'';
  if(mime==='application/pdf'){
   const table=request.headers.get('x-oaz-table')??'',recordId=Number(request.headers.get('x-oaz-record-id')),title=decodeURIComponent(request.headers.get('x-oaz-title')??'');
   if(!['editor_0_noti','editor_1_projects','editor_2_studies','editor_6_events'].includes(table)||!/^\d+$/.test(request.headers.get('x-oaz-record-id')??'')||!Number.isSafeInteger(recordId)||title.length<1||title.length>100)return reply(400,'INVALID_DOCUMENT');
   if(session.data.role!=='SUPER_ADMIN'&&!session.data.scopes?.includes(table)&&!(table==='editor_0_noti'&&session.data.promotion?.manualEdit))return reply(403,'FORBIDDEN');
   if(request.headers.get('x-oaz-public-rights')!=='general-public-document')return reply(400,'PUBLIC_RIGHTS_REQUIRED');
   if(Number(request.headers.get('content-length'))>limit)return reply(413,'TOO_LARGE');
   const bytes=await normalizePublicPDF(await bounded(request,limit)),sha256=createHash('sha256').update(bytes).digest('hex');
   if(!bytes.length||bytes.length>limit)return reply(413,'TOO_LARGE');
   const reserved=await c.rpc('oaz_attachment_command_v1',{command:{action:'reserve',requestId:crypto.randomUUID(),table,recordId,title,sha256,byteCount:bytes.length,purpose:'general-public-document',rightsConfirmed:true}});
   if(reserved.error)return reply(reserved.error.code==='42501'?403:400,'DOCUMENT_RESERVE_DENIED');
   if(userStorage()){const permit=await c.rpc('oaz_storage_gateway_v1',{command:{action:'permit',kind:'pdf',id:reserved.data.id}});if(permit.error||permit.data!==true)return reply(403,'DOCUMENT_PERMIT_DENIED')}
   const privileged=await uploader(token);const stored=await privileged.storage.from(bucket).upload(reserved.data.path,bytes,{contentType:'application/pdf',upsert:false});if(stored.error)return reply(503,'PRIVATE_UPLOAD_UNCONFIRMED');
   const finished=await privileged.rpc(userStorage()?'oaz_storage_gateway_v1':'oaz_attachment_finish_v1',userStorage()?{command:{action:'finish',kind:'pdf',id:reserved.data.id}}:{document_id:reserved.data.id});if(finished.error||finished.data!==true)return reply(403,'DOCUMENT_FINISH_DENIED');
   return Response.json({id:reserved.data.id,status:'pending'},{status:201,headers:{'Cache-Control':'no-store'}});
  }
  if(!mime.startsWith('application/json'))return reply(415,'TYPE_UNSUPPORTED');
  let command:Record<string,unknown>;try{command=JSON.parse((await bounded(request,8192)).toString('utf8'))}catch{return reply(400,'INVALID_COMMAND')}
  if(!command||typeof command!=='object'||Array.isArray(command)||!['list','approve','revoke'].includes(String(command.action))||Object.keys(command).some(k=>!['action','requestId','table','recordId','id','revision','rightsConfirmed'].includes(k)))return reply(400,'INVALID_COMMAND');
  const result=await c.rpc('oaz_attachment_command_v1',{command});if(result.error)return reply(result.error.code==='42501'?403:result.error.code==='PT409'?409:400,'DOCUMENT_REQUEST_DENIED');
  return Response.json({result:result.data},{headers:{'Cache-Control':'no-store'}});
 }catch(e){return reply(e instanceof Error&&e.message==='TOO_LARGE'?413:400,'DOCUMENT_REVIEW_FAILED')}
}
export async function attachmentDownload(request:Request,id:string){
 const limit=mediaByteLimit(process.env);
 if(!enabled())return reply(503,'DOCUMENTS_NOT_CONFIGURED');if(!uuid.test(id))return reply(404,'NOT_FOUND');
 const preview=new URL(request.url).searchParams.get('preview')==='1';
 const token=request.headers.get('authorization')?.match(/^Bearer ([A-Za-z0-9._-]{20,8192})$/)?.[1];
 if(preview&&!token)return reply(401,'AUTH_REQUIRED');
 try{
  const c=client(preview?token:undefined);if(preview){const u=await c.auth.getUser(token);if(u.error||!u.data.user)return reply(401,'AUTH_EXPIRED')}
  const allowed=await c.rpc('oaz_attachment_access_v1',{document_id:id,preview});if(allowed.error||!allowed.data)return reply(404,'NOT_FOUND');
  const storage=await uploader(preview?token:undefined),download=await storage.storage.from(bucket).download(allowed.data.path);if(download.error||!download.data||download.data.size>limit)return reply(503,'DOCUMENT_UNAVAILABLE');
  const bytes=new Uint8Array(await download.data.arrayBuffer());if(bytes.length!==allowed.data.byteCount||createHash('sha256').update(bytes).digest('hex')!==allowed.data.sha256)return reply(503,'DOCUMENT_INTEGRITY_FAILED');
  // Recheck approval after the storage read; never hand out a durable signed Storage URL.
  const again=await c.rpc('oaz_attachment_access_v1',{document_id:id,preview});if(again.error||!again.data)return reply(404,'NOT_FOUND');
  return new Response(bytes,{headers:{'Content-Type':'application/pdf','Content-Disposition':`attachment; filename="oaz-document-${id}.pdf"`,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"sandbox; default-src 'none'; frame-ancestors 'none'"}});
 }catch{return reply(503,'DOCUMENT_UNAVAILABLE')}
}
