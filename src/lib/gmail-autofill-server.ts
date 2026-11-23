import 'server-only'
import {readFile,writeFile,mkdir,lstat} from 'node:fs/promises'
import {join} from 'node:path'
import {createHash,randomUUID} from 'node:crypto'
import {adminPort} from './admin/server'
import {serverClient} from './admin/server-client'
import {isFinalLocalProfile,localProfile} from './security-profile'
import {acceptanceRpc} from './acceptance-rpc'
import {gmailAccessToken} from './gmail-oauth-server'
import {gmailReadonly} from './gmail-readonly'
import {gmailMime} from './gmail-mime'
import {analyzeMail} from './mail-autofill-analysis'
import {safeAutoCopy,type AutoCopy} from './mail-autofill'
import {normalizePublicPDF} from './admin/pdf-normalize'
import type {PublicMail} from './promotion-intake'
const digest=(s:string|Uint8Array)=>createHash('sha256').update(s).digest('hex'),uuid=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i
type PDF={fingerprint:string;name:string;status:'ready'|'blocked';source:string;reason?:string}
type Analysis={copy:AutoCopy;mimeHash:string;warnings:string[];proof:Record<string,unknown>;pdfs:PDF[];translationStatus:'blocked_provider'}
async function bounded(request:Request,limit:number){const reader=request.body?.getReader();if(!reader)throw Error('INVALID_COMMAND');const parts:Uint8Array[]=[];let size=0;while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>limit){await reader.cancel();throw Error('TOO_LARGE')}parts.push(value)}return Buffer.concat(parts)}
async function plainFile(file:string,limit:number){const info=await lstat(file);if(!info.isFile()||info.isSymbolicLink()||info.size>limit)throw Error('PRIVATE_PATH');return readFile(file)}
async function directory(path:string){await mkdir(path,{recursive:true,mode:0o700});const s=await lstat(path);if(!s.isDirectory()||s.isSymbolicLink())throw Error('PRIVATE_PATH');return path}
async function writeOnce(path:string,value:string|Uint8Array){try{await writeFile(path,value,{flag:'wx',mode:0o600})}catch(e){if((e as NodeJS.ErrnoException).code!=='EEXIST')throw e;await plainFile(path,8*1024*1024)}}
const locks=new Map<string,Promise<unknown>>()
async function single<T>(key:string,task:()=>Promise<T>):Promise<T>{const old=locks.get(key);if(old)await old.catch(()=>{});const p=task();locks.set(key,p);try{return await p}finally{if(locks.get(key)===p)locks.delete(key)}}
export async function gmailAutofill(request:Request,env:NodeJS.ProcessEnv=process.env){
 const reply=(status:number,data:unknown)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','Vary':'Authorization, Origin','X-Content-Type-Options':'nosniff'}})
 if(env.OAZ_FINAL_ACCEPTANCE!=='true'||!isFinalLocalProfile(env)||!env.OAZ_GMAIL_APPROVED_LABEL)return reply(503,{error:'LOCAL_REVIEW_UNAVAILABLE'})
 if(request.method!=='POST'||request.headers.get('origin')!==localProfile(env).web)return reply(403,{error:'ORIGIN_DENIED'})
 const token=request.headers.get('authorization')?.match(/^Bearer ([A-Za-z0-9._-]{20,8192})$/)?.[1];if(!token)return reply(401,{error:'AUTH_REQUIRED'})
 try{
  const port=adminPort(token);if(!await port.verify(token))return reply(401,{error:'AUTH_EXPIRED'})
  const session=await port.execute({action:'session',requestId:randomUUID(),version:0}),s=session.data as {role?:string;slot?:string;version:number}|null
  if(session.code||s?.role!=='SUPER_ADMIN'||s?.slot!=='admin1')return reply(403,{error:'SUPER_ADMIN_AAL2_REQUIRED'})
  if((await port.execute({action:'admins.list',requestId:randomUUID(),version:s.version})).code)return reply(403,{error:'SUPER_ADMIN_AAL2_REQUIRED'})
  const pdfUpload=request.headers.get('content-type')==='application/pdf'
  if(!pdfUpload&&!request.headers.get('content-type')?.startsWith('application/json'))return reply(415,{error:'TYPE_UNSUPPORTED'})
  const c:Record<string,unknown>=pdfUpload?{action:'upload',key:request.headers.get('x-oaz-review-key')}:JSON.parse((await bounded(request,180000)).toString('utf8'))
  if(!c||Array.isArray(c)||typeof c.key!=='string'||!/^[a-f0-9]{64}$/.test(c.key)||!['get','save','publish','upload','pdf.download'].includes(String(c.action))||Object.keys(c).some(k=>!['action','key','copy','revision','requestId','confirmed','pdfs','fingerprint'].includes(k)))return reply(400,{error:'INVALID_COMMAND'})
  const key=c.key,root=join(process.cwd(),localProfile(env).privatePath),sourceFolder=join(root,'gmail-review')
  if((await lstat(root)).isSymbolicLink()||(await lstat(sourceFolder)).isSymbolicLink())throw Error('PRIVATE_PATH')
  const record=JSON.parse((await plainFile(join(sourceFolder,key+'.json'),200000)).toString('utf8')) as {label:string;mail:PublicMail}
  if(record.label!==env.OAZ_GMAIL_APPROVED_LABEL||digest(JSON.stringify([record.label,record.mail]))!==key)throw Error('SOURCE_CHANGED')
  const folder=await directory(join(root,'gmail-autofill')),sourceDir=await directory(join(folder,key)),rpc=(command:Record<string,unknown>)=>acceptanceRpc('mail_review',{command:{...command,key}},token)
  // A real source/label check on every action, including pending document downloads.
  const access=await gmailAccessToken(env),live=await gmailReadonly(access,record.label).read!(record.mail.id)
  if(!live||digest(JSON.stringify([record.label,live]))!==key)throw Error('SOURCE_CHANGED')
  const mime=await gmailMime(access,record.label,record.mail.id),cache=join(sourceDir,'analysis-v2.json')
  const analysis=await single(key,async()=>{
   try{const found=JSON.parse((await plainFile(cache,400000)).toString('utf8')) as Analysis;if(found.mimeHash!==mime.fingerprint)throw Error('SOURCE_CHANGED');return found}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e}
   const result=await analyzeMail(mime.subject,mime.document,mime.receivedAt,mime.attachment)
   for(const pdf of result.pdfs)if(pdf.bytes)await writeOnce(join(sourceDir,pdf.fingerprint+'.pdf'),pdf.bytes)
   const data:Analysis={copy:result.copy,mimeHash:mime.fingerprint,warnings:result.warnings,proof:{...result.provenance,blocked:result.warnings.some(w=>['SENSITIVE_CONTENT_REVIEW','MIME_CHARSET_UNSUPPORTED'].includes(w))},pdfs:result.pdfs.map(p=>({fingerprint:p.fingerprint,name:p.name,status:p.status,source:p.source,...(p.reason?{reason:p.reason}:{})})),translationStatus:'blocked_provider'}
   await writeOnce(cache,JSON.stringify(data));return data
  })
  if(c.action==='pdf.download'){
   if(typeof c.fingerprint!=='string'||!/^[a-f0-9]{64}$/.test(c.fingerprint))throw Error('INVALID_COMMAND')
   const bytes=await plainFile(join(sourceDir,c.fingerprint+'.pdf'),5242880);if(digest(bytes)!==c.fingerprint)throw Error('DOCUMENT_INTEGRITY_FAILED')
   return new Response(bytes,{headers:{'Content-Type':'application/pdf','Content-Disposition':'attachment; filename="oaz-private-review.pdf"','Cache-Control':'no-store','Content-Security-Policy':"sandbox; default-src 'none'; frame-ancestors 'none'",'X-Content-Type-Options':'nosniff'}})
  }
  if(pdfUpload){
   const name=decodeURIComponent(request.headers.get('x-oaz-title')??'').trim()
   if(!name||name.length>100||/[<>\r\n]|강의|과제|회원|회계|lecture|assignment|confidential|[\w.+-]+@/i.test(name))throw Error('PUBLIC_DOCUMENT_REVIEW_REQUIRED')
   const bytes=await normalizePublicPDF(await bounded(request,5242880)),fingerprint=digest(bytes)
   await writeOnce(join(sourceDir,fingerprint+'.pdf'),bytes)
   await writeOnce(join(sourceDir,fingerprint+'.json'),JSON.stringify({fingerprint,name,status:'ready',source:'manual'}))
   return reply(201,{pdf:{fingerprint,name,status:'ready',source:'manual'}})
  }
  const current=await rpc({action:'auto.get'})
  if(c.action==='get'){
   // Existing manually edited copies take precedence over automatic extraction, always.
   const legacyCopy:AutoCopy|null=current?{title:current.title,summary:current.summary,body:current.body,deadline:current.closesOn??'',links:current.applicationURL?[{name:'공식 안내',url:current.applicationURL}]:[]}:null
   return reply(200,{copy:current?.autoCopy??legacyCopy??analysis.copy,revision:current?.revision??0,postId:current?.postId??null,manualPreserved:!!current&&!current.autoCopy,warnings:analysis.warnings,blocked:analysis.proof.blocked===true,pdfs:analysis.pdfs,translationStatus:analysis.translationStatus})
  }
  if(!safeAutoCopy(c.copy)||!Number.isSafeInteger(c.revision)||Number(c.revision)<0||typeof c.requestId!=='string'||!uuid.test(c.requestId))return reply(400,{error:'INVALID_PUBLIC_COPY'})
  if(analysis.proof.blocked===true)return reply(409,{error:'SENSITIVE_SOURCE_REVIEW_REQUIRED'})
  if(current?.postId!==null&&current?.postId!==undefined)return reply(200,{result:{postId:current.postId,revision:current.revision,status:'already_published'},href:'/about/notice/'+current.postId})
  if(c.action==='publish'&&(c.confirmed!==true||!Array.isArray(c.pdfs)||c.pdfs.length>10||c.pdfs.some(id=>typeof id!=='string'||!/^[a-f0-9]{64}$/.test(id))||new Set(c.pdfs).size!==c.pdfs.length))return reply(400,{error:'PUBLICATION_REVIEW_REQUIRED'})
  const copy=c.copy,combined=[copy.body,...(copy.links.length?[copy.links.map(l=>l.name+': '+l.url).join('\n')]:[])].join('\n\n')
  // Deterministic save/publish request IDs preserve retries without hiding conflicting edits.
  const childRequest=(action:string)=>{const h=digest(c.requestId+':'+action);return `${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`}
  const result=await rpc({action:'auto.save',requestId:childRequest('save'),revision:c.revision,messageId:record.mail.id,threadId:record.mail.threadId,sourceHash:key,receivedAt:record.mail.receivedAt,start:0,end:Math.min(record.mail.text.length,30000),confirmed:true,title:copy.title,summary:copy.summary,body:combined,applicationURL:'',opensOn:null,closesOn:copy.deadline.slice(0,10)||null,englishTitle:current?.englishTitle??'',englishBody:current?.englishBody??'',englishConfirmed:false,autoCopy:copy,mimeHash:analysis.mimeHash,proof:analysis.proof})
  await writeOnce(join(sourceFolder,'manual-'+digest(record.mail.id)+'.json'),JSON.stringify({sourceKey:key,status:'manual-review',messageHash:digest(record.mail.id)}))
  if(c.action==='save')return reply(200,{result})
  const pdfIds:string[]=[],storage=serverClient((await plainFile(join(root,'media-uploader.key'),32768)).toString('ascii').trim())
  for(const fingerprint of c.pdfs as string[]){
   let candidate=analysis.pdfs.find(p=>p.fingerprint===fingerprint)
   if(!candidate){try{candidate=JSON.parse((await plainFile(join(sourceDir,fingerprint+'.json'),4096)).toString('utf8'))}catch{throw Error('PUBLIC_DOCUMENT_REVIEW_REQUIRED')}}
   if(!candidate||candidate.status!=='ready')throw Error('PUBLIC_DOCUMENT_REVIEW_REQUIRED')
   const bytes=await plainFile(join(sourceDir,fingerprint+'.pdf'),5242880);if(digest(bytes)!==fingerprint)throw Error('DOCUMENT_INTEGRITY_FAILED')
   await normalizePublicPDF(bytes)
   const reserve=await rpc({action:'auto.pdf.reserve',documentTitle:candidate.name,sha256:fingerprint,byteCount:bytes.length,requestId:childRequest('pdf:'+fingerprint)})
   const uploaded=await storage.storage.from('oaz-public-documents-staging').upload(reserve.path,bytes,{contentType:'application/pdf',upsert:false})
   if(uploaded.error){const prior=await storage.storage.from('oaz-public-documents-staging').download(reserve.path);if(prior.error||!prior.data||prior.data.size!==bytes.length||digest(Buffer.from(await prior.data.arrayBuffer()))!==fingerprint)throw Error('PRIVATE_UPLOAD_UNCONFIRMED')}
   const finished=await storage.rpc('oaz_attachment_finish_v1',{document_id:reserve.id});if(finished.error||finished.data!==true)throw Error('PRIVATE_UPLOAD_UNCONFIRMED');pdfIds.push(reserve.id)
  }
  // Re-check remote evidence and current permissions immediately before publication.
  const latest=await gmailReadonly(access,record.label).read!(record.mail.id),latestMime=await gmailMime(access,record.label,record.mail.id)
  if(!latest||digest(JSON.stringify([record.label,latest]))!==key||latestMime.fingerprint!==analysis.mimeHash)throw Error('SOURCE_CHANGED')
  const published=await rpc({action:'auto.publish',requestId:childRequest('publish'),revision:result.revision,confirmed:true,pdfIds,rightsConfirmed:true})
  const meta=await serverClient().rpc('oaz_public_content_meta_v1',{tbl:'editor_0_noti',rid:published.postId})
  if(!meta.error&&meta.data?.sourceHash){const publicFolder=await directory(join(root,'mail-public-copy'));await writeOnce(join(publicFolder,String(published.postId)+'.json'),JSON.stringify({sourceHash:meta.data.sourceHash,copy,translationStatus:'blocked_provider'}))}
  return reply(200,{result:published,href:'/about/notice/'+published.postId})
 }catch(e){const code=e instanceof Error?e.message:'';const known=['SOURCE_CHANGED','SENSITIVE_SOURCE_REVIEW_REQUIRED','INVALID_PUBLIC_COPY','PUBLICATION_REVIEW_REQUIRED','PRIVATE_SELECTION','GMAIL_REAUTH_REQUIRED','GMAIL_LABEL_CHANGED','DOCUMENT_CONFLICT','RETRY_CONFLICT','PUBLIC_DOCUMENT_REVIEW_REQUIRED','TOO_LARGE'];return reply(['SOURCE_CHANGED','SENSITIVE_SOURCE_REVIEW_REQUIRED','PUBLICATION_REVIEW_REQUIRED','RETRY_CONFLICT'].includes(code)?409:code==='TOO_LARGE'?413:400,{error:known.includes(code)?code:'REVIEW_REQUEST_FAILED'})}
}
