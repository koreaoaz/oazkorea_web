import 'server-only'
import {readFile,lstat,writeFile} from 'node:fs/promises'
import {join} from 'node:path'
import {createHash} from 'node:crypto'
import {adminPort} from './admin/server'
import {serverClient} from './admin/server-client'
import {isFinalLocalProfile,localProfile} from './security-profile'
import {acceptanceRpc} from './acceptance-rpc'
import {gmailAccessToken} from './gmail-oauth-server'
import {gmailReadonly} from './gmail-readonly'
import {reviewedExcerpt} from './gmail-review'
import {safeMailCopy} from './mail-publication-contract'
import {normalizePublicPDF} from './admin/pdf-normalize'
import type {PublicMail} from './promotion-intake'
const digest=(value:string|Uint8Array)=>createHash('sha256').update(value).digest('hex')
const uuid=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i
async function bounded(request:Request,limit:number){const reader=request.body?.getReader();if(!reader)throw Error('INVALID_COMMAND');const parts:Uint8Array[]=[];let size=0;while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>limit){await reader.cancel();throw Error('TOO_LARGE')}parts.push(value)}return Buffer.concat(parts)}
async function source(key:string,env:NodeJS.ProcessEnv){
 const folder=join(process.cwd(),localProfile(env).privatePath,'gmail-review'),file=join(folder,key+'.json')
 if((await lstat(folder)).isSymbolicLink()||(await lstat(file)).isSymbolicLink())throw Error('PRIVATE_PATH')
 const record=JSON.parse(await readFile(file,'utf8')) as {label:string;mail:PublicMail}
 if(record.label!==env.OAZ_GMAIL_APPROVED_LABEL||digest(JSON.stringify([record.label,record.mail]))!==key)throw Error('SOURCE_CHANGED')
 return {record,folder}
}
export async function gmailPublication(request:Request,env:NodeJS.ProcessEnv=process.env){
 const reply=(status:number,result:unknown)=>Response.json(result,{status,headers:{'Cache-Control':'no-store','Vary':'Authorization, Origin','X-Content-Type-Options':'nosniff'}})
 if(env.OAZ_FINAL_ACCEPTANCE!=='true'||!isFinalLocalProfile(env)||!env.OAZ_GMAIL_APPROVED_LABEL)return reply(503,{error:'LOCAL_REVIEW_UNAVAILABLE'})
 if(request.method!=='POST'||request.headers.get('origin')!==localProfile(env).web)return reply(403,{error:'ORIGIN_DENIED'})
 const token=request.headers.get('authorization')?.match(/^Bearer ([A-Za-z0-9._-]{20,8192})$/)?.[1];if(!token)return reply(401,{error:'AUTH_REQUIRED'})
 try{
  const port=adminPort(token);if(!await port.verify(token))return reply(401,{error:'AUTH_EXPIRED'})
  const session=await port.execute({action:'session',requestId:crypto.randomUUID(),version:0}),s=session.data as {role?:string;slot?:string;version:number}|null
  if(session.code||s?.role!=='SUPER_ADMIN'||s?.slot!=='admin1')return reply(403,{error:'SUPER_ADMIN_AAL2_REQUIRED'})
  const gate=await port.execute({action:'admins.list',requestId:crypto.randomUUID(),version:s.version});if(gate.code)return reply(403,{error:'SUPER_ADMIN_AAL2_REQUIRED'})
  const rpc=(command:Record<string,unknown>)=>acceptanceRpc('mail_review',{command},token)
  if(request.headers.get('content-type')==='application/pdf'){
   const key=request.headers.get('x-oaz-review-key')??'',title=decodeURIComponent(request.headers.get('x-oaz-title')??'')
   if(!/^[a-f0-9]{64}$/.test(key)||!title.trim()||title.length>100||request.headers.get('x-oaz-public-rights')!=='general-public-document')return reply(400,{error:'PUBLIC_DOCUMENT_REVIEW_REQUIRED'})
   await source(key,env)
   const bytes=await normalizePublicPDF(await bounded(request,5*1024*1024)),hash=digest(bytes)
   const reserved=await rpc({action:'pdf.reserve',key,documentTitle:title,sha256:hash,byteCount:bytes.length,rightsConfirmed:true,requestId:crypto.randomUUID()})
   const storage=serverClient((await readFile(join(process.cwd(),localProfile(env).privatePath,'media-uploader.key'),'ascii')).trim())
   const uploaded=await storage.storage.from('oaz-public-documents-staging').upload(reserved.path,bytes,{contentType:'application/pdf',upsert:false});if(uploaded.error)throw Error('PRIVATE_UPLOAD_UNCONFIRMED')
   const finish=await storage.rpc('oaz_attachment_finish_v1',{document_id:reserved.id});if(finish.error||finish.data!==true)throw Error('PRIVATE_UPLOAD_UNCONFIRMED')
   return reply(201,{id:reserved.id,status:'pending'})
  }
  if(!request.headers.get('content-type')?.startsWith('application/json'))return reply(415,{error:'TYPE_UNSUPPORTED'})
  const c=JSON.parse((await bounded(request,180000)).toString('utf8')) as Record<string,unknown>
  if(!c||Array.isArray(c)||typeof c.key!=='string'||!/^[a-f0-9]{64}$/.test(c.key)||!['get','save','publish','pdf.list','pdf.preview'].includes(String(c.action))||Object.keys(c).some(k=>!['action','key','requestId','revision','start','end','confirmed','copy','pdfIds','rightsConfirmed','documentId'].includes(k)))return reply(400,{error:'INVALID_COMMAND'})
  const {record,folder}=await source(c.key,env)
  if(c.action==='get')return reply(200,{result:await rpc({action:'get',key:c.key}),receivedAt:record.mail.receivedAt})
  if(c.action==='pdf.list')return reply(200,{result:await rpc({action:'pdf.list',key:c.key})})
  if(c.action==='pdf.preview'){
   if(typeof c.documentId!=='string'||!uuid.test(c.documentId))return reply(400,{error:'INVALID_COMMAND'})
   const allowed=await rpc({action:'pdf.access',key:c.key,documentId:c.documentId})
   const storage=serverClient((await readFile(join(process.cwd(),localProfile(env).privatePath,'media-uploader.key'),'ascii')).trim()),file=await storage.storage.from('oaz-public-documents-staging').download(allowed.path)
   if(file.error||!file.data||file.data.size>5242880)throw Error('DOCUMENT_UNAVAILABLE')
   const bytes=Buffer.from(await file.data.arrayBuffer());if(bytes.length!==allowed.byteCount||digest(bytes)!==allowed.sha256)throw Error('DOCUMENT_INTEGRITY_FAILED')
   await rpc({action:'pdf.access',key:c.key,documentId:c.documentId})
   return new Response(bytes,{headers:{'Content-Type':'application/pdf','Content-Disposition':'attachment; filename="oaz-private-review.pdf"','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"sandbox; default-src 'none'; frame-ancestors 'none'"}})
  }
  if(typeof c.requestId!=='string'||!uuid.test(c.requestId)||!Number.isSafeInteger(c.revision)||Number(c.revision)<0||c.confirmed!==true)return reply(400,{error:'INVALID_COMMAND'})
  // Check the same source and current approved label immediately before the reviewed write.
  const live=await gmailReadonly(await gmailAccessToken(env),record.label).read!(record.mail.id)
  if(!live||digest(JSON.stringify([record.label,live]))!==c.key)return reply(409,{error:'SOURCE_CHANGED'})
  if(c.action==='save'){
   if(typeof c.start!=='number'||typeof c.end!=='number'||!safeMailCopy(c.copy))return reply(400,{error:'PRIVATE_SELECTION'})
   reviewedExcerpt(record.mail,c.start,c.end,true)
   const result=await rpc({action:'save',key:c.key,requestId:c.requestId,revision:c.revision,messageId:record.mail.id,threadId:record.mail.threadId,sourceHash:c.key,receivedAt:record.mail.receivedAt,start:c.start,end:c.end,confirmed:true,...c.copy})
   // Reserve this source from the daily batch even before approval; no duplicate automatic draft.
   const marker=join(folder,'manual-'+digest(record.mail.id)+'.json'),value=JSON.stringify({sourceKey:c.key,status:'manual-review',messageHash:digest(record.mail.id)})
   try{await writeFile(marker,value,{mode:0o600,flag:'wx'})}catch(e){
    if((e as NodeJS.ErrnoException).code!=='EEXIST')throw e
    const info=await lstat(marker)
    if(!info.isFile()||info.isSymbolicLink()||info.size>4096||await readFile(marker,'utf8')!==value)throw Error('SOURCE_CHANGED')
   }
   return reply(200,{result})
  }
  if(!Array.isArray(c.pdfIds)||c.pdfIds.length>10||c.pdfIds.some(id=>typeof id!=='string'||!uuid.test(id))||new Set(c.pdfIds).size!==c.pdfIds.length)return reply(400,{error:'INVALID_COMMAND'})
  const result=await rpc({action:'publish',key:c.key,requestId:c.requestId,revision:c.revision,confirmed:true,pdfIds:c.pdfIds,rightsConfirmed:c.rightsConfirmed===true})
  return reply(200,{result,href:'/about/notice/'+result.postId})
 }catch(e){const message=e instanceof Error?e.message:'';const known=['PRIVATE_SELECTION','INVALID_SELECTION','SOURCE_CHANGED','TOO_LARGE','GMAIL_REAUTH_REQUIRED','PUBLICATION_REVIEW_REQUIRED','EXISTING_SOURCE_REVIEW_REQUIRED','DOCUMENT_CONFLICT','RETRY_CONFLICT','PUBLIC_DOCUMENT_REVIEW_REQUIRED','SUPER_ADMIN_AAL2_REQUIRED'];return reply(message==='TOO_LARGE'?413:message==='SUPER_ADMIN_AAL2_REQUIRED'?403:['SOURCE_CHANGED','PUBLICATION_REVIEW_REQUIRED','EXISTING_SOURCE_REVIEW_REQUIRED','DOCUMENT_CONFLICT','RETRY_CONFLICT'].includes(message)?409:400,{error:known.includes(message)?message:'REVIEW_REQUEST_FAILED'})}
}
