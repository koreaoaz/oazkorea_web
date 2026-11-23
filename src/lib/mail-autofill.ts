import {parseFragment,type DefaultTreeAdapterTypes as Tree} from 'parse5'
import {createHash} from 'node:crypto'
import {mailReviewReasons} from './gmail-review'

export type MailLink={name:string;url:string}
export type MailPart={mimeType?:string;filename?:string;partId?:string;headers?:{name:string;value:string}[];body?:{data?:string;size?:number;attachmentId?:string};parts?:MailPart[]}
export type MailDocument={text:string;links:MailLink[];attachments:{id:string;name:string;size:number;inline?:string}[];warnings:string[]}
export type AutoCopy={title:string;summary:string;body:string;deadline:string;links:MailLink[]}
const deniedURL=/unsubscribe|optout|opt-out|tracking|clicktrack|email-preferences|password|reset|magic.?link|oauth|login|signin|verify|auth\/callback/i
const secretKey=/token|secret|password|passwd|credential|session|signature|email|recipient|user_id|api.?key|code|auth|ticket|jwt|saml/i
export function publicLink(raw:string):string|null{
 try{
  if(raw.length>2048||/[\s<>\\]/.test(raw))return null
  const u=new URL(raw);if(u.protocol!=='https:'||u.username||u.password||u.port&&u.port!=='443'||u.hash||deniedURL.test(u.pathname)||!u.hostname.includes('.')||u.hostname.endsWith('.local')||u.hostname.endsWith('.internal')||u.hostname==='localhost'||/^\d|^\[/.test(u.hostname))return null
  if([...u.searchParams.keys()].some(k=>secretKey.test(k)))return null
  for(const key of [...u.searchParams.keys()])if(/^(utm_|fbclid$|gclid$|mc_[ce]id$)/i.test(key))u.searchParams.delete(key)
  if([...u.searchParams].some(([key,value])=>! /^(id|page|category|type|lang|view|no|seq|board|boardId|idx|mode|usp|articleId|menuId|bbsId|nttId)$/i.test(key)||value.length>100))return null
  if(/eyJ[A-Za-z0-9_-]+\.|[\w.+-]+@/.test(decodeURIComponent(u.pathname+u.search)))return null
  return u.href
 }catch{return null}
}
export function cleanMailText(text:string){
 return text.replace(/\r\n?/g,'\n').replace(/\u00a0/g,' ').replace(/[\u200b\ufeff]/g,'').replace(/\*\*/g,'').replace(/__([^_\n]+)__/g,'$1').replace(/`([^`\n]+)`/g,'$1').replace(/^\s*#{1,6}\s+/gm,'').replace(/^\s*[-*+]\s+/gm,'• ').replace(/\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g,'$1 ($2)').replace(/[ \t]+\n/g,'\n').replace(/\n{3,}/g,'\n\n').trim()
}
export function htmlMail(html:string,baseURL?:string):{text:string;links:MailLink[]}{
 if(html.length>2_000_000)throw Error('MAIL_PART_LIMIT')
 const links:MailLink[]=[];let budget=0
 const walk=(n:Tree.Node,depth=0):string=>{
  if(++budget>30000||depth>80)throw Error('MAIL_HTML_LIMIT')
  if(n.nodeName==='#text')return (n as Tree.TextNode).value
  if(!('childNodes' in n))return ''
  const tag='tagName' in n?n.tagName:''
  if(['script','style','head','iframe','object','embed','svg','template','noscript','form','input'].includes(tag))return ''
  const attrs='attrs' in n?n.attrs:[],style=attrs.find(a=>a.name==='style')?.value??''
  if(attrs.some(a=>a.name==='hidden')||/display\s*:\s*none|visibility\s*:\s*hidden/i.test(style))return ''
  let text=n.childNodes.map(c=>walk(c,depth+1)).join('')
  if(tag==='a'){
   const raw=attrs.find(a=>a.name==='href')?.value
   let url:string|null=null
   try{url=raw?publicLink(baseURL?new URL(raw,baseURL).href:raw):null}catch{/* malformed references are not public candidates */}
   if(url){const name=cleanMailText(text).trim().slice(0,100)||new URL(url).hostname;links.push({name,url});if(!text.includes(url))text+=' ('+url+')'}
  }
  if(tag==='br')return '\n'
  if(tag==='li')return '\n• '+text+'\n'
  return ['p','div','section','article','tr','table','h1','h2','h3','h4','blockquote'].includes(tag)?'\n'+text+'\n':text
 }
 return {text:cleanMailText(walk(parseFragment(html))),links}
}
export function parseMailMime(root:MailPart):MailDocument{
 const links:MailLink[]=[],attachments:MailDocument['attachments']=[],warnings:string[]=[];let parts=0,total=0
 const decode=(p:MailPart)=>{
  const b=Buffer.from(p.body?.data??'','base64url');total+=b.length;if(total>2_000_000)throw Error('MAIL_PART_LIMIT')
  const charset=p.headers?.find(h=>h.name.toLowerCase()==='content-type')?.value.match(/charset\s*=\s*["']?([\w-]+)/i)?.[1]??'utf-8'
  try{return new TextDecoder(charset,{fatal:true}).decode(b)}catch{warnings.push('MIME_CHARSET_UNSUPPORTED');return ''}
 }
 const visit=(p:MailPart,depth=0):string=>{
  if(++parts>200||depth>16)throw Error('MAIL_MIME_LIMIT')
  if(p.filename||p.mimeType==='application/pdf'){
   if(p.mimeType==='application/pdf'||/\.pdf$/i.test(p.filename??''))attachments.push({id:p.body?.attachmentId??'part:'+String(p.partId??parts),name:p.filename||'document.pdf',size:p.body?.size??0,...(p.body?.data?{inline:p.body.data}:{})})
   return ''
  }
  if(p.mimeType==='text/plain')return cleanMailText(decode(p))
  if(p.mimeType==='text/html'){const html=htmlMail(decode(p));links.push(...html.links);return html.text}
  const children=(p.parts??[]).map(c=>({type:c.mimeType,text:visit(c,depth+1)}))
  if(p.mimeType==='multipart/alternative')return children.find(c=>c.type==='text/plain'&&c.text.trim())?.text||children.find(c=>c.text.trim())?.text||''
  return [...new Set(children.map(c=>c.text.trim()).filter(Boolean))].join('\n\n')
 }
 const text=visit(root)
 for(const found of text.matchAll(/https?:\/\/[^\s<>"\]]+/gi)){const url=publicLink(found[0].replace(/[),.;]+$/,''));if(url)links.push({name:new URL(url).hostname,url})}
 return {text,links:links.filter((l,i)=>links.findIndex(other=>other.url===l.url)===i),attachments,warnings:[...new Set(warnings)]}
}
export function safePublicBody(raw:string){
 const kept:string[]=[],excluded:{line:number;hash:string;reason:string}[]=[],warnings:string[]=[]
 let footer=false
 for(const [i,line] of cleanMailText(raw).split('\n').entries()){
  if(/^\s*(?:--\s*|감사합니다[.!]?|Best regards[,!]?|Kind regards[,!]?|Sent from .*|이 메일은.*(?:지정|수신)|This (?:e-?mail|message).*(?:confidential|intended)|본 (?:메일|이메일).*(?:비밀|수신|기밀))\s*$/i.test(line))footer=true
  const reasons=mailReviewReasons(line),hard=reasons.some(r=>['PRIVATE_RECORD','CREDENTIAL','CONFIDENTIAL_NOTICE'].includes(r))
  const contact=/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}|(?:\+82[- .]?)?0?1[016789][- .]?\d{3,4}[- .]?\d{4}|0\d{1,2}[- .]\d{3,4}[- .]\d{4}|\b\d{6}[- ]?[1-8]\d{6}\b|^(?:담당자|담당|보낸 사람|받는 사람|From|To|Cc)\s*[:：]/i.test(line)
  if(footer||hard||contact){excluded.push({line:i,hash:createHash('sha256').update(line).digest('hex'),reason:footer?'SIGNATURE_OR_NOTICE':contact?'CONTACT':'SENSITIVE'});if(hard&&!footer)warnings.push('SENSITIVE_CONTENT_REVIEW');continue}
  kept.push(line.replace(/https?:\/\/[^\s<>"\]]+/gi,rawURL=>publicLink(rawURL.replace(/[),.;]+$/,''))??''))
 }
 return {body:cleanMailText(kept.join('\n')),excluded,warnings:[...new Set(warnings)]}
}
export function validDeadline(s:string){
 if(!s)return true
 if(!/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2})?$/.test(s))return false
 const [d,t]=s.split('T'),parsed=new Date(d+'T00:00:00Z')
 return Number.isFinite(parsed.getTime())&&parsed.toISOString().slice(0,10)===d&&(!t||Number(t.slice(0,2))<24&&Number(t.slice(3))<60)
}
export function deadlineFromText(text:string,receivedAt:string){
 const dates:{value:string;line:number;yearBasis:string}[]=[],warnings:string[]=[]
 const explicitYears=[...new Set([...text.matchAll(/\b(20\d{2})\s*(?:년|[./-])/g)].map(m=>m[1]))]
 for(const [lineIndex,line] of text.split('\n').entries()){
  if(!/(신청|접수|모집|등록|제출|지원).{0,16}(기간|마감|까지)|(?:마감|deadline|apply by|applications? close)/i.test(line))continue
  if(/선착순|상시|별도 안내|미정|until filled/i.test(line)){warnings.push('DEADLINE_NON_DATE');continue}
  const matches=[...line.matchAll(/(?:(20\d{2})\s*[년./-]\s*)?(\d{1,2})\s*[월./-]\s*(\d{1,2})\s*일?(?:\s*(?:\([^)]{1,4}\))?\s*(\d{1,2})\s*[:시]\s*(\d{2})?\s*분?)?/g)]
  const m=matches.at(-1);if(!m)continue
  let year=m[1]||matches.find(x=>x[1])?.[1]||(explicitYears.length===1?explicitYears[0]:'');let yearBasis=m[1]?'explicit':'document-context'
  if(!year){const received=new Date(receivedAt),localYear=new Date(+received+9*3600000).getUTCFullYear();const candidate=new Date(`${localYear}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}T00:00:00+09:00`);const days=(+candidate-+received)/86400000;if(days>=-7&&days<=60){year=String(localYear);yearBasis='received-date-context'}else{warnings.push('DEADLINE_YEAR_UNCONFIRMED');continue}}
  const value=`${year}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`+(m[4]?`T${m[4].padStart(2,'0')}:${(m[5]??'00').padStart(2,'0')}`:'')
  if(validDeadline(value))dates.push({value,line:lineIndex,yearBasis});else warnings.push('DEADLINE_INVALID')
 }
 const distinct=[...new Set(dates.map(d=>d.value))]
 if(distinct.length>1)warnings.push('DEADLINE_CONFLICT')
 return {deadline:distinct.length===1?distinct[0]:'',evidence:dates,warnings:[...new Set(warnings)]}
}
export function autofillMail(subject:string,doc:MailDocument,receivedAt:string){
 const cleaned=safePublicBody(doc.text)
 const title=cleanMailText(subject).replace(/^(?:(?:re|fw|fwd)\s*:\s*)+/ig,'').trim().slice(0,300)
 const date=deadlineFromText(cleaned.body,receivedAt)
 const sentences=cleaned.body.split(/\n+|(?<=[.!?])\s+/).map(s=>s.trim()).filter(s=>s&&!/^https?:/.test(s)&&!/^•?$/.test(s))
 const selected=sentences.filter(s=>/모집|행사|세미나|대상|참가|신청|접수|활동|교육|마감|recruit|seminar|deadline/i.test(s))
 const summary=(selected.length?selected:sentences).slice(0,3).join(' ').slice(0,600)
 const copy:AutoCopy={title,summary,body:cleaned.body,deadline:date.deadline,links:doc.links.filter(l=>publicLink(l.url)&&!mailReviewReasons(l.name).some(r=>['PRIVATE_RECORD','CREDENTIAL','CONFIDENTIAL_NOTICE'].includes(r))).slice(0,20)}
 return {copy,warnings:[...new Set([...doc.warnings,...cleaned.warnings,...date.warnings,...(doc.links.length>20?['LINK_LIMIT_REVIEW']:[])])],provenance:{excluded:cleaned.excluded,deadline:date.evidence,sourceDigest:createHash('sha256').update(doc.text).digest('hex')},attachments:doc.attachments}
}
export function safeAutoCopy(value:unknown):value is AutoCopy{
 if(!value||typeof value!=='object'||Array.isArray(value))return false
 const c=value as AutoCopy
 if(Object.keys(c).sort().join(',')!=='body,deadline,links,summary,title'||typeof c.title!=='string'||!c.title.trim()||c.title.length>300||typeof c.body!=='string'||c.body.trim().length<20||c.body.length>25000||typeof c.summary!=='string'||c.summary.length>2000||typeof c.deadline!=='string'||!validDeadline(c.deadline)||!Array.isArray(c.links)||c.links.length>20)return false
 if(c.links.some(l=>!l||Object.keys(l).sort().join(',')!=='name,url'||typeof l.name!=='string'||!l.name.trim()||l.name.length>100||typeof l.url!=='string'||publicLink(l.url)!==l.url)||new Set(c.links.map(l=>l.url)).size!==c.links.length)return false
 const raw=[c.title,c.summary,c.body,...c.links.map(l=>l.name+' '+l.url)].join('\n'),clean=safePublicBody(raw)
 return clean.excluded.length===0&&!/<[^>]+>|\*\*|\b(?:Bearer|api[_ -]?key|secret)\s*[:=]/i.test(raw)
}
