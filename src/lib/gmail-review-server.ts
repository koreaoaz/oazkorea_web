import 'server-only'
import {readFile,writeFile,mkdir,lstat} from 'node:fs/promises'
import {join} from 'node:path'
import {createHash} from 'node:crypto'
import {adminPort} from './admin/server'
import {gmailAccessToken} from './gmail-oauth-server'
import {gmailReadonly} from './gmail-readonly'
import {isFinalLocalProfile,localProfile} from './security-profile'
import {mailReviewReasons,reviewedExcerpt} from './gmail-review'
import type {PublicMail} from './promotion-intake'
import {serverClient} from './admin/server-client'
import {saveDraftEnglish} from './promotion-english-review'
import {acceptanceRpc} from './acceptance-rpc'
const digest=(s:string)=>createHash('sha256').update(s).digest('hex')
async function directory(env:NodeJS.ProcessEnv){const root=join(process.cwd(),localProfile(env).privatePath);if((await lstat(root)).isSymbolicLink())throw Error('PRIVATE_PATH');const dir=join(root,'gmail-review');await mkdir(dir,{recursive:true,mode:0o700});if((await lstat(dir)).isSymbolicLink())throw Error('PRIVATE_PATH');return dir}
export async function handleGmailReview(request:Request,env:NodeJS.ProcessEnv=process.env){
 const reply=(status:number,body:unknown)=>Response.json(body,{status,headers:{'Cache-Control':'no-store','Vary':'Authorization, Origin','X-Content-Type-Options':'nosniff'}})
 if(!isFinalLocalProfile(env)||!env.OAZ_GMAIL_APPROVED_LABEL)return reply(503,{error:'GMAIL_AUTH_PENDING'})
 if(request.method!=='POST'||request.headers.get('origin')!==localProfile(env).web)return reply(403,{error:'ORIGIN_DENIED'})
 const token=request.headers.get('authorization')?.match(/^Bearer ([A-Za-z0-9._-]{20,8192})$/)?.[1];if(!token)return reply(401,{error:'AUTH_REQUIRED'})
 try{
  const port=adminPort(token);if(!await port.verify(token))return reply(401,{error:'AUTH_EXPIRED'})
  const session=await port.execute({action:'session',requestId:crypto.randomUUID(),version:0});const s=session.data as {role?:string;slot?:string;version?:number}|null
  if(session.code||s?.role!=='SUPER_ADMIN'||s?.slot!=='admin1'||!Number.isSafeInteger(s.version))return reply(403,{error:'SUPER_ADMIN_AAL2_REQUIRED'})
  // DB rechecks active account, session revocation and AAL2; token claims alone never authorize review.
  const gate=await port.execute({action:'admins.list',requestId:crypto.randomUUID(),version:s.version!});if(gate.code||!Array.isArray(gate.data))return reply(403,{error:'SUPER_ADMIN_AAL2_REQUIRED'})
  const reader=request.body?.getReader();if(!reader)return reply(400,{error:'INVALID_COMMAND'});let raw='';const decoder=new TextDecoder();let size=0
  while(true){const p=await reader.read();if(p.done)break;size+=p.value.length;if(size>65536){await reader.cancel();return reply(413,{error:'TOO_LARGE'})}raw+=decoder.decode(p.value,{stream:true})}
  let input:unknown;try{input=JSON.parse(raw+decoder.decode())}catch{return reply(400,{error:'INVALID_COMMAND'})}
  if(!input||typeof input!=='object'||Array.isArray(input))return reply(400,{error:'INVALID_COMMAND'})
  const command=input as Record<string,unknown>;const dir=await directory(env)
  if(command.action==='english'){
   if(Object.keys(command).some(k=>!['action','id','revision','title','body','confirmed'].includes(k))||typeof command.id!=='string'||!/^[a-f0-9-]{36}$/i.test(command.id)||!Number.isSafeInteger(command.revision)||command.confirmed!==true||typeof command.title!=='string'||!command.title.trim()||command.title.length>300||typeof command.body!=='string'||!command.body.trim()||command.body.length>30000)return reply(400,{error:'INVALID_COMMAND'})
   const {data:draft,error}=await serverClient(token).rpc('oaz_promotion_command_v1',{command:{action:'get',id:command.id,requestId:crypto.randomUUID()}})
   if(error||!draft||draft.status!=='pending'||draft.revision!==command.revision)return reply(409,{error:'SOURCE_CHANGED'})
   if(mailReviewReasons(command.title+'\n'+command.body).some(r=>['PRIVATE_RECORD','CREDENTIAL','CONFIDENTIAL_NOTICE'].includes(r)))return reply(400,{error:'PRIVATE_SELECTION'})
   await saveDraftEnglish(draft,command.title,command.body,env);return reply(200,{status:'ENGLISH_REVIEWED',public:false})
  }
  if(command.action==='list'){
   if(Object.keys(command).some(k=>!['action','cursor'].includes(k))||command.cursor!==undefined&&typeof command.cursor!=='string')return reply(400,{error:'INVALID_COMMAND'})
   const page=await gmailReadonly(await gmailAccessToken(env),env.OAZ_GMAIL_APPROVED_LABEL).page!(command.cursor as string|undefined)
   const items=[]
   for(const mail of page.messages){const key=digest(JSON.stringify([env.OAZ_GMAIL_APPROVED_LABEL,mail]));const file=join(dir,key+'.json');try{await writeFile(file,JSON.stringify({label:env.OAZ_GMAIL_APPROVED_LABEL,mail}),{flag:'wx',mode:0o600})}catch(e){if((e as NodeJS.ErrnoException).code!=='EEXIST')throw e}
    const review=env.OAZ_FINAL_ACCEPTANCE==='true'?await acceptanceRpc('mail_review',{command:{action:'get',key}},token):null
    items.push({key,title:mail.subject,receivedAt:mail.receivedAt,status:review?.postId!=null?'published':review?'reviewing':'REVIEW_REQUIRED'})}
   return reply(200,{items,nextCursor:page.nextCursor,remoteStateUnchanged:page.remoteStateUnchanged})
  }
  if(!['read','queue'].includes(String(command.action))||typeof command.key!=='string'||!/^[a-f0-9]{64}$/.test(command.key)||Object.keys(command).some(k=>!['action','key','start','end','confirmed'].includes(k)))return reply(400,{error:'INVALID_COMMAND'})
  const file=join(dir,command.key+'.json');if((await lstat(file)).isSymbolicLink())throw Error('PRIVATE_PATH')
  const record=JSON.parse(await readFile(file,'utf8')) as {label:string;mail:PublicMail}
  if(record.label!==env.OAZ_GMAIL_APPROVED_LABEL||digest(JSON.stringify([record.label,record.mail]))!==command.key)return reply(409,{error:'SOURCE_CHANGED'})
  if(command.action==='read')return reply(200,{key:command.key,title:record.mail.subject,text:record.mail.text,receivedAt:record.mail.receivedAt,reasons:mailReviewReasons(record.mail.text),status:'REVIEW_REQUIRED'})
  if(typeof command.start!=='number'||typeof command.end!=='number')return reply(400,{error:'INVALID_SELECTION'})
  const draft=reviewedExcerpt(record.mail,command.start,command.end,command.confirmed===true)
  const queue=join(dir,'approved-'+draft.fingerprint+'.json');let duplicate=false
  try{await writeFile(queue,JSON.stringify({sourceKey:command.key,label:record.label,start:command.start,end:command.end,mail:{id:record.mail.id,threadId:record.mail.threadId},draft,reviewedAt:new Date().toISOString(),reviewerSlot:'admin1'}),{flag:'wx',mode:0o600})}catch(e){if((e as NodeJS.ErrnoException).code!=='EEXIST')throw e;duplicate=true}
  return reply(200,{status:'QUEUED_PRIVATE_DRAFT',duplicate,public:false,requiresPublicationApproval:true})
 }catch(error){const code=error instanceof Error?error.message:'';if(['PRIVATE_SELECTION','INVALID_SELECTION'].includes(code))return reply(400,{error:code});return reply(503,{error:['GMAIL_REAUTH_REQUIRED','GMAIL_SCOPE_MISMATCH','GMAIL_ACCOUNT_MISMATCH','GMAIL_LABEL_CHANGED'].includes(code)?code:'GMAIL_REVIEW_UNAVAILABLE'})}
}
