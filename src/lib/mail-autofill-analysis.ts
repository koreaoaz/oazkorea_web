import {createHash} from 'node:crypto'
import {spawn} from 'node:child_process'
import {join} from 'node:path'
import {autofillMail,deadlineFromText,type MailDocument} from './mail-autofill'
import {normalizePublicPDF} from './admin/pdf-normalize'
import {readOfficial} from './mail-official-source'
const hash=(s:string|Uint8Array)=>createHash('sha256').update(s).digest('hex')
export type CandidatePDF={fingerprint:string;name:string;bytes?:Uint8Array;status:'ready'|'blocked';source:'gmail'|'official';reason?:string}
async function pdfText(bytes:Uint8Array):Promise<string>{
 return new Promise((resolve,reject)=>{
  const child=spawn('python',['-B',join(process.cwd(),'scripts/mail-pdf-text.py')],{windowsHide:true,stdio:['pipe','pipe','pipe'],env:{NODE_ENV:'production',PATH:process.env.PATH,SystemRoot:process.env.SystemRoot,USERPROFILE:process.env.USERPROFILE,PYTHONDONTWRITEBYTECODE:'1'}})
  const chunks:Buffer[]=[];let size=0,settled=false
  const fail=()=>{if(settled)return;settled=true;clearTimeout(timer);child.kill();reject(Error('PDF_REVIEW_REJECTED'))},timer=setTimeout(fail,15000)
  child.on('error',fail);child.stdin.on('error',fail);child.stderr.resume();child.stdout.on('data',(b:Buffer)=>{size+=b.length;if(size>1500000)fail();else chunks.push(b)})
  child.on('close',code=>{if(settled)return;settled=true;clearTimeout(timer);try{if(code!==0)throw Error();resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')).text)}catch{reject(Error('PDF_REVIEW_REJECTED'))}});child.stdin.end(bytes)
 })
}
/** No AI; only original sentences, date evidence and public-resource GETs. */
export async function analyzeMail(subject:string,document:MailDocument,receivedAt:string,attachment:(id:string)=>Promise<Uint8Array>){
 const auto=autofillMail(subject,document,receivedAt),pdfs:CandidatePDF[]=[],warnings=[...auto.warnings]
 const dateSources:{kind:string;hash:string;deadline:string;evidence:ReturnType<typeof deadlineFromText>['evidence']}[]=[]
 const addDate=(text:string,kind:string)=>{const d=deadlineFromText(text,receivedAt);dateSources.push({kind,hash:hash(text),deadline:d.deadline,evidence:d.evidence});warnings.push(...d.warnings)}
 addDate(auto.copy.body,'mail')
 const addPDF=async(name:string,source:'gmail'|'official',identity:string,read:()=>Promise<Uint8Array>)=>{
  if(pdfs.length>=10){warnings.push('PDF_LIMIT_REVIEW');return}
  try{if(/[<>\r\n]|강의|과제|회원|회계|lecture|assignment|confidential|[\w.+-]+@/i.test(name))throw Error('PDF_REVIEW_REJECTED');const bytes=await normalizePublicPDF(await read());if(pdfs.some(p=>p.fingerprint===hash(bytes)))return;const text=await pdfText(bytes);addDate(text,source+'-pdf');pdfs.push({fingerprint:hash(bytes),name:name.slice(0,100),bytes,status:'ready',source})}
  catch{pdfs.push({fingerprint:hash(identity),name:name.slice(0,100),status:'blocked',source,reason:'PDF_SECURITY_OR_PRIVACY_REVIEW_REQUIRED'})}
 }
 for(const part of auto.attachments.slice(0,10))await addPDF(part.name,'gmail',part.id,()=>attachment(part.id))
 if(auto.attachments.length>10)warnings.push('PDF_LIMIT_REVIEW')
 const visited=new Set<string>();let inspected=0
 // Requests stay bounded even for link-heavy newsletters. Never follow authentication pages.
 for(const link of auto.copy.links.slice(0,6)){
  if(visited.has(link.url))continue;visited.add(link.url)
  try{
   const page=await readOfficial(link.url);inspected++
   if(page.type==='pdf'){await addPDF(decodeURIComponent(new URL(page.url).pathname.split('/').pop()||'document.pdf'),'official',link.url,async()=>page.bytes);continue}
   addDate(page.text,'official-page')
   for(const child of page.links.filter(l=>new URL(l.url).origin===new URL(page.url).origin&&/\.pdf(?:\?|$)/i.test(l.url)).slice(0,2)){
    if(visited.has(child.url))continue;visited.add(child.url)
    await addPDF(child.name||'document.pdf','official',child.url,async()=>{const pdf=await readOfficial(child.url);if(pdf.type!=='pdf')throw Error();return pdf.bytes})
   }
  }catch{warnings.push('OFFICIAL_SOURCE_UNAVAILABLE')}
 }
 if(auto.copy.links.length>6)warnings.push('OFFICIAL_SOURCE_LIMIT')
 const dates=[...new Set(dateSources.map(d=>d.deadline).filter(Boolean))]
 // Conflicts are never silently resolved by picking the latest, earliest or first date.
 auto.copy.deadline=dates.length===1?dates[0]:''
 if(dates.length>1)warnings.push('DEADLINE_CONFLICT')
 return {...auto,pdfs,warnings:[...new Set(warnings)],provenance:{...auto.provenance,dateSources,officialPagesInspected:inspected},translationStatus:'blocked_provider' as const}
}
