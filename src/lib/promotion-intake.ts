import {createHash} from 'node:crypto'
export type PublicMail={id:string;threadId:string;receivedAt:string;subject:string;text:string;publicReviewed:true}
export type SafeDraft={title:string;body:string;category:'recruitment'|'seminar'|'contest'|'other';opensOn:null;closesOn:null;fingerprint:string;receivedAt:string}
export type DraftProvider={name:string;generate:(publicText:Readonly<{title:string;body:string}>)=>Promise<{title:string;body:string}>}
const sensitive=/비밀번호|인증번호|인증 코드|회계|급여|통장|회원명부|출석부|개인정보|인사평가|비공개|confidential|password|verification code|payroll|bank account/i
export const eligiblePublicSubject=(subject:string)=>!sensitive.test(subject)&&/모집|공모|세미나|학술|행사|컨퍼런스|홍보|특강|교육|인턴|채용|캠프|장학|대회|recruit|seminar|conference|contest|workshop/i.test(subject)
/** Conservative text-only redaction. Never sends original mail, headers or attachments to a provider. */
export function publicMailText(raw:string){
 return raw.split(/(?:^|\n)(?:--\s*$|보낸 사람:|From:|수신:|To:|감사합니다|Best regards|Sent from)/im)[0]
 .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,'').replace(/<[^>]*>/g,' ')
 .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g,'[연락처 제외]')
 .replace(/(?:\+82[- .]?)?0?1[016789][- .]?\d{3,4}[- .]?\d{4}|0\d{1,2}[- .]\d{3,4}[- .]\d{4}/g,'[연락처 제외]')
 .replace(/\b\d{6}[- ]?[1-8]\d{6}\b/g,'[개인정보 제외]')
 .replace(/(?:Bearer\s+)?eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,'[인증정보 제외]')
 .replace(/https?:\/\/[^\s<>]+/gi,url=>{try{const u=new URL(url);if(u.username||u.password)return '[링크 제외]';return u.origin+u.pathname}catch{return '[링크 제외]'}})
 .replace(/\r/g,'').replace(/[ \t]+/g,' ').trim().slice(0,30000)
}
export async function draftFromPublicMail(mail:PublicMail,provider?:DraftProvider):Promise<SafeDraft|null>{
 if(mail.publicReviewed!==true||!eligiblePublicSubject(mail.subject)||!Number.isFinite(Date.parse(mail.receivedAt))||Date.parse(mail.receivedAt)<Date.parse('2025-01-01T00:00:00+09:00')||Date.parse(mail.receivedAt)>Date.now()+60000)return null;
 if(sensitive.test(mail.text))return null;
 const title=publicMailText(mail.subject).replace(/^(?:(?:re|fw|fwd):\s*)+/ig,'').slice(0,300),body=publicMailText(mail.text);
 if(!title||!body)return null;
 // Source identity is intentionally independent of any generated wording; no automatic publishing.
 const fingerprint=createHash('sha256').update(title.replace(/\s+/g,' ').toLowerCase()+'\n'+body.replace(/\s+/g,' ').toLowerCase()).digest('hex');
 let output={title,body};
 if(provider){const generated=await provider.generate(Object.freeze({title,body}));output={title:publicMailText(generated.title).slice(0,300),body:publicMailText(generated.body)};if(!output.title||!output.body||sensitive.test(output.title+' '+output.body))throw Error('UNSAFE_PROVIDER_OUTPUT')}
 return {...output,category:/공모|contest/i.test(title)?'contest':/모집|recruit/i.test(title)?'recruitment':/세미나|학술|행사|conference|seminar|workshop/i.test(title)?'seminar':'other',opensOn:null,closesOn:null,fingerprint,receivedAt:mail.receivedAt}
}
export type IntakeStore={claim:(day:string,runId:string)=>Promise<'claimed'|'complete'|'busy'>;put:(mail:Pick<PublicMail,'id'|'threadId'>,draft:SafeDraft,runId:string)=>Promise<'created'|'duplicate'>;finish:(day:string,runId:string,success:boolean)=>Promise<void>}
export type MailPage={messages:PublicMail[];nextCursor:string|null;listed:number;excluded:number;remoteStateUnchanged:boolean}
export type ReadonlyMailbox={list:()=>Promise<PublicMail[]>;page?:(cursor?:string)=>Promise<MailPage>;read?:(id:string)=>Promise<PublicMail|null>}
export type IntakeCheckpoint={load:(day:string)=>Promise<string|undefined>;save:(day:string,cursor:string|null)=>Promise<void>}
/** One bounded page per invocation; failed pages replay with DB fingerprint deduplication. */
export async function runPromotionBatch(mailbox:ReadonlyMailbox,store:IntakeStore,checkpoint:IntakeCheckpoint,now=new Date(),reviewed?:(mail:PublicMail)=>Promise<SafeDraft|null>,reserved?:(mail:PublicMail)=>Promise<boolean>){
 if(!mailbox.page)throw Error('INTAKE_PAGING_REQUIRED');
 const day=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul'}).format(now),runId=crypto.randomUUID(),claim=await store.claim(day,runId);
 if(claim!=='claimed')return {status:claim,created:0,duplicate:0,excluded:0,failed:0,provider:'rules'};
 try{
  const page=await mailbox.page(await checkpoint.load(day));if(page.messages.length>50||page.listed>50||!page.remoteStateUnchanged)throw Error('INTAKE_PAGE_INVALID');
  const result={status:page.nextCursor?'partial':'complete',created:0,duplicate:0,excluded:page.excluded,failed:0,listed:page.listed,provider:'rules',remoteStateUnchanged:true};
  for(const mail of page.messages){try{if(await reserved?.(mail)){result.excluded++;continue}const draft=await reviewed?.(mail)??await draftFromPublicMail(mail);if(!draft){result.excluded++;continue}result[await store.put({id:mail.id,threadId:mail.threadId},draft,runId)]++}catch{result.failed++}}
  if(!result.failed)await checkpoint.save(day,page.nextCursor);
  if(result.failed)result.status='partial';
  await store.finish(day,runId,!result.failed&&!page.nextCursor);return result;
 }catch(error){await store.finish(day,runId,false);throw error}
}
export async function runPromotionIntake(mailbox:ReadonlyMailbox,store:IntakeStore,now=new Date(),provider?:DraftProvider){
 const day=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul'}).format(now),runId=crypto.randomUUID(),claim=await store.claim(day,runId);
 if(claim!=='claimed')return {status:claim,created:0,duplicate:0,excluded:0,failed:0,provider:provider?.name??'rules'};
 const result={status:'complete',created:0,duplicate:0,excluded:0,failed:0,provider:provider?.name??'rules'};
 try{const messages=await mailbox.list();if(messages.length>100)throw Error('INTAKE_PAGE_LIMIT');for(const mail of messages){try{const draft=await draftFromPublicMail(mail,provider);if(!draft){result.excluded++;continue}const outcome=await store.put({id:mail.id,threadId:mail.threadId},draft,runId);result[outcome]++}catch{result.failed++}}result.status=result.failed?'partial':'complete';await store.finish(day,runId,!result.failed);return result}
 catch{await store.finish(day,runId,false);throw Error('INTAKE_UNAVAILABLE')}
}
