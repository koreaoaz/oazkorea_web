import 'server-only'
import {createHash} from 'node:crypto'
import {eligiblePublicSubject} from './promotion-intake'
import {decodeMailSubject,limitedJSON} from './gmail-readonly'
import {parseMailMime,type MailPart} from './mail-autofill'
type Message={id:string;internalDate:string;labelIds?:string[];payload:MailPart}
const endpoint='https://gmail.googleapis.com/gmail/v1/users/me'
/** Separate MIME contract: the legacy source fingerprint remains byte-for-byte compatible. */
export async function gmailMime(token:string,label:string,id:string,fetcher:typeof fetch=fetch){
 if(!/^Label_[A-Za-z0-9_-]{1,100}$/.test(label)||!/^[A-Za-z0-9_-]{1,100}$/.test(id))throw Error('GMAIL_MESSAGE_INVALID')
 const get=async(path:string,limit?:number)=>limitedJSON(await fetcher(endpoint+path,{method:'GET',redirect:'error',cache:'no-store',signal:AbortSignal.timeout(15000),headers:{Authorization:`Bearer ${token}`}}),limit)
 const profile=await get('/profile') as {emailAddress?:string};if(profile.emailAddress?.toLowerCase()!=='koreaoaz@gmail.com')throw Error('GMAIL_ACCOUNT_MISMATCH')
 const metaPath='/messages/'+id+'?format=metadata&metadataHeaders=Subject'
 const before=await get(metaPath) as Message,full=await get('/messages/'+id+'?format=full',8*1024*1024) as Message,after=await get(metaPath) as Message
 const sig=(m:Message)=>JSON.stringify([m.id,[...(m.labelIds??[])].sort(),m.internalDate])
 if(sig(before)!==sig(full)||sig(full)!==sig(after)||full.id!==id)throw Error('GMAIL_REMOTE_STATE_CHANGED')
 if(!full.labelIds?.includes(label)||full.labelIds.some(x=>['SPAM','TRASH','DRAFT'].includes(x)))throw Error('GMAIL_LABEL_CHANGED')
 const subject=decodeMailSubject(full.payload.headers?.find(h=>h.name.toLowerCase()==='subject')?.value??'')
 if(!eligiblePublicSubject(subject)||Number(full.internalDate)<Date.parse('2025-01-01T00:00:00+09:00'))throw Error('GMAIL_SOURCE_INELIGIBLE')
 const document=parseMailMime(full.payload as MailPart),attachmentBytes=new Map<string,Buffer>()
 const attachment=async(attachmentId:string)=>{
  const cached=attachmentBytes.get(attachmentId);if(cached)return cached
  const part=document.attachments.find(p=>p.id===attachmentId);if(!part||part.size>5242880)throw Error('DOCUMENT_UNAVAILABLE')
  const item=part.inline?{data:part.inline,size:part.size}:await get('/messages/'+id+'/attachments/'+encodeURIComponent(part.id),8*1024*1024) as {data?:string;size?:number}
  if(!item.data||!/^[-_A-Za-z0-9=]+$/.test(item.data)||Number(item.size)>5242880)throw Error('DOCUMENT_UNAVAILABLE')
  const bytes=Buffer.from(item.data,'base64url');if(bytes.length>5242880||bytes.length!==item.size)throw Error('DOCUMENT_UNAVAILABLE')
  if(sig(await get(metaPath) as Message)!==sig(full))throw Error('GMAIL_REMOTE_STATE_CHANGED')
  attachmentBytes.set(attachmentId,bytes);return bytes
 }
 // Gmail may rotate an opaque attachment retrieval ID on unchanged messages.
 // Bind publishable PDFs to actual bytes; retain all MIME fields and part/header
 // order, but replace that transport handle with a stable presence marker.
 const canonical=(value:unknown):unknown=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([key,item])=>[key,key==='attachmentId'?{transportHandle:typeof item==='string'&&item.length>0}:canonical(item)])):value
 const pdfEvidence=[]
 for(const [index,part] of document.attachments.entries()){
  if(index>=10){pdfEvidence.push({name:part.name,size:part.size,status:'limit'});continue}
  if(part.size>5242880){pdfEvidence.push({name:part.name,size:part.size,status:'oversized'});continue}
  try{const bytes=await attachment(part.id);pdfEvidence.push({name:part.name,size:part.size,sha256:createHash('sha256').update(bytes).digest('hex')})}catch(e){if(e instanceof Error&&e.message==='GMAIL_REMOTE_STATE_CHANGED')throw e;document.warnings.push('PDF_SOURCE_UNAVAILABLE');pdfEvidence.push({name:part.name,size:part.size,status:'unavailable'})}
 }
 const fingerprint=createHash('sha256').update(JSON.stringify({version:2,payload:canonical(full.payload),pdfEvidence})).digest('hex')
 if(sig(await get(metaPath) as Message)!==sig(full))throw Error('GMAIL_REMOTE_STATE_CHANGED')
 return {document,fingerprint,subject,receivedAt:new Date(Number(full.internalDate)).toISOString(),attachment}
}
