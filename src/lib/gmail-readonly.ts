import 'server-only'
import {createHash} from 'node:crypto'
import {eligiblePublicSubject,publicMailText,type PublicMail,type ReadonlyMailbox} from './promotion-intake'
type Part={mimeType?:string;filename?:string;body?:{data?:string;size?:number};headers?:{name:string;value:string}[];parts?:Part[]}
type Message={id:string;threadId:string;internalDate:string;labelIds?:string[];payload:Part}
const endpoint='https://gmail.googleapis.com/gmail/v1/users/me'
export function decodeMailSubject(value:string){
 return value.slice(0,8192).replace(/\?=\s+(?==\?)/g,'?=').replace(/=\?([^?]+)\?([bq])\?([^?]*)\?=/gi,(_,charset:string,encoding:string,data:string)=>{
  try{const bytes=encoding.toLowerCase()==='b'?Buffer.from(data,'base64'):Buffer.from(data.replace(/_/g,' ').replace(/=([0-9a-f]{2})/gi,(_match,hex:string)=>String.fromCharCode(parseInt(hex,16))),'latin1');return new TextDecoder(charset,{fatal:true}).decode(bytes)}catch{return '[제목 인코딩 확인 필요]'}
 });
}
export async function limitedJSON(response:Response,limit=2*1024*1024):Promise<unknown>{
 if(!response.ok)throw Error('GMAIL_READ_FAILED');const reader=response.body?.getReader();if(!reader)throw Error('GMAIL_EMPTY');
 const parts:Uint8Array[]=[];let count=0;while(true){const {value,done}=await reader.read();if(done)break;count+=value.length;if(count>limit){await reader.cancel();throw Error('GMAIL_TOO_LARGE')}parts.push(value)}
 return JSON.parse(Buffer.concat(parts).toString('utf8'))
}

/** Only GET requests; approved label must already exist and contain only reviewed public promotions. */
export function gmailReadonly(token:string,approvedLabel:string,fetcher:typeof fetch=fetch):ReadonlyMailbox{
 if(!token||!/^Label_[A-Za-z0-9_-]{1,100}$/.test(approvedLabel))throw Error('GMAIL_AUTH_PENDING');
 const get=async(path:string)=>limitedJSON(await fetcher(endpoint+path,{method:'GET',redirect:'error',cache:'no-store',signal:AbortSignal.timeout(10000),headers:{Authorization:`Bearer ${token}`}}));
 const text=(part:Part):string=>part.filename?'':part.mimeType==='text/plain'&&part.body?.data?Buffer.from(part.body.data,'base64url').toString('utf8'):(part.parts??[]).map(text).filter(Boolean).join('\n');
 const htmlText=(part:Part):string=>part.filename?'':part.mimeType==='text/html'&&part.body?.data?publicMailText(Buffer.from(part.body.data,'base64url').toString('utf8').replace(/<\/(p|div|li|tr|h[1-6])>|<br\s*\/?\s*>/gi,'\n').replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/&quot;/gi,'"').replace(/&#39;/g,"'")):(part.parts??[]).map(htmlText).filter(Boolean).join('\n');
 const page=async(cursor?:string)=>{
  if(cursor!==undefined&&!/^[A-Za-z0-9_-]{1,2048}$/.test(cursor))throw Error('GMAIL_CURSOR_INVALID');
  const profile=await get('/profile') as {emailAddress?:string};if(profile.emailAddress?.toLowerCase()!=='koreaoaz@gmail.com')throw Error('GMAIL_ACCOUNT_MISMATCH');
  const query=new URLSearchParams({labelIds:approvedLabel,q:'after:1735657200 -in:spam -in:trash',maxResults:'50',includeSpamTrash:'false'});if(cursor)query.set('pageToken',cursor);
  const result=await get('/messages?'+query) as {messages?:{id:string}[];nextPageToken?:string};
  if((result.messages?.length??0)>50)throw Error('GMAIL_PAGE_LIMIT');
  const messages:PublicMail[]=[];let excluded=0;const excludedReasons={subject:0,emptyBody:0};const before:string[]=[],after:string[]=[];
  const signature=(m:Message)=>createHash('sha256').update(JSON.stringify([m.id,[...(m.labelIds??[])].sort(),m.internalDate])).digest('hex');
  for(const item of result.messages??[]){
   if(!/^[a-zA-Z0-9_-]{1,100}$/.test(item.id))throw Error('GMAIL_MESSAGE_INVALID');
   const path='/messages/'+item.id+'?format=metadata&metadataHeaders=Subject';
   const metadata=await get(path) as Message;
   if(!metadata.labelIds?.includes(approvedLabel))throw Error('GMAIL_LABEL_CHANGED');
   before.push(signature(metadata));
   const subject=decodeMailSubject(metadata.payload.headers?.find(h=>h.name.toLowerCase()==='subject')?.value??'');
   if(metadata.labelIds.some(x=>['SPAM','TRASH','DRAFT'].includes(x))||!eligiblePublicSubject(subject)){excluded++;excludedReasons.subject++}else{
    const full=await get('/messages/'+item.id+'?format=full') as Message;
    if(!full.labelIds?.includes(approvedLabel)||full.labelIds.some(x=>['SPAM','TRASH','DRAFT'].includes(x)))throw Error('GMAIL_LABEL_CHANGED');
    const body=text(full.payload)||htmlText(full.payload);
    if(body)messages.push({id:full.id,threadId:full.threadId,subject,text:body,receivedAt:new Date(Number(full.internalDate)).toISOString(),publicReviewed:true});else {excluded++;excludedReasons.emptyBody++}
   }
   after.push(signature(await get(path) as Message));
  }
  const unchanged=JSON.stringify(before)===JSON.stringify(after);
  if(!unchanged)throw Error('GMAIL_REMOTE_STATE_CHANGED');
  return {messages,nextCursor:result.nextPageToken??null,listed:result.messages?.length??0,excluded,excludedReasons,remoteStateUnchanged:unchanged};
 };
 const read=async(id:string)=>{
  if(!/^[A-Za-z0-9_-]{1,100}$/.test(id))throw Error('GMAIL_MESSAGE_INVALID');
  const profile=await get('/profile') as {emailAddress?:string};if(profile.emailAddress?.toLowerCase()!=='koreaoaz@gmail.com')throw Error('GMAIL_ACCOUNT_MISMATCH');
  const path='/messages/'+id+'?format=metadata&metadataHeaders=Subject',before=await get(path) as Message;
  const full=await get('/messages/'+id+'?format=full') as Message;
  const after=await get(path) as Message;
  const signature=(m:Message)=>JSON.stringify([m.id,[...(m.labelIds??[])].sort(),m.internalDate]);
  if(signature(before)!==signature(full)||signature(full)!==signature(after))throw Error('GMAIL_REMOTE_STATE_CHANGED');
  if(!full.labelIds?.includes(approvedLabel)||full.labelIds.some(x=>['SPAM','TRASH','DRAFT'].includes(x)))throw Error('GMAIL_LABEL_CHANGED');
  const subject=decodeMailSubject(full.payload.headers?.find(h=>h.name.toLowerCase()==='subject')?.value??''),body=text(full.payload)||htmlText(full.payload);
  if(!eligiblePublicSubject(subject)||!body)return null;
  return {id:full.id,threadId:full.threadId,subject,text:body,receivedAt:new Date(Number(full.internalDate)).toISOString(),publicReviewed:true as const};
 };
 return {page,read,list:async()=>{
  const profile=await get('/profile') as {emailAddress?:string};if(profile.emailAddress?.toLowerCase()!=='koreaoaz@gmail.com')throw Error('GMAIL_ACCOUNT_MISMATCH');
  const collected:PublicMail[]=[];let page:string|undefined,listed=0;
  do{
   const query=new URLSearchParams({labelIds:approvedLabel,q:'after:1735657200 -in:spam -in:trash',maxResults:'50',includeSpamTrash:'false'});if(page)query.set('pageToken',page);
   const result=await get('/messages?'+query) as {messages?:{id:string}[];nextPageToken?:string};
   for(const item of result.messages??[]){
    if(++listed>100)throw Error('GMAIL_REVIEWED_BATCH_TOO_LARGE');
    if(!/^[a-zA-Z0-9_-]{1,100}$/.test(item.id))continue;
    const metadata=await get('/messages/'+item.id+'?format=metadata&metadataHeaders=Subject') as Message;
    const subject=decodeMailSubject(metadata.payload.headers?.find(h=>h.name.toLowerCase()==='subject')?.value??'');
    if(!metadata.labelIds?.includes(approvedLabel)||metadata.labelIds.some(x=>['SPAM','TRASH','DRAFT'].includes(x))||!eligiblePublicSubject(subject))continue;
    const full=await get('/messages/'+item.id+'?format=full') as Message;
    if(!full.labelIds?.includes(approvedLabel)||full.labelIds.some(x=>['SPAM','TRASH','DRAFT'].includes(x)))continue;
    const body=text(full.payload);if(!body)continue; // No HTML, attachment download, or image OCR fallback.
    collected.push({id:full.id,threadId:full.threadId,subject,text:body,receivedAt:new Date(Number(full.internalDate)).toISOString(),publicReviewed:true});
   }page=result.nextPageToken;
  }while(page);
  return collected;
 }}
}
