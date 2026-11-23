import 'server-only'
import {readdir,readFile,lstat} from 'node:fs/promises'
import {join} from 'node:path'
import {createHash} from 'node:crypto'
import {reviewedExcerpt} from './gmail-review'
import type {PublicMail} from './promotion-intake'
export async function manualReviewReserved(folder:string,mail:PublicMail){
 const hash=createHash('sha256').update(mail.id).digest('hex'),file=join(folder,'gmail-review','manual-'+hash+'.json')
 try{if((await lstat(file)).isSymbolicLink())throw Error('PRIVATE_PATH');const record=JSON.parse(await readFile(file,'utf8'));return record.messageHash===hash&&record.status==='manual-review'}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return false;throw e}
}
/** A queued selection is usable only while the identical message is still in the approved label. */
export async function reviewedQueue(folder:string,label:string){
 const dir=join(folder,'gmail-review');let files:string[]
 try{if((await lstat(dir)).isSymbolicLink())throw Error('PRIVATE_PATH');files=await readdir(dir)}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')files=[];else throw e}
 const selections:Record<string,{start:number;end:number;fingerprint:string}>={}
 for(const name of files.filter(f=>/^approved-[a-f0-9]{64}\.json$/.test(f)).slice(0,1000)){
  const file=join(dir,name);if((await lstat(file)).isSymbolicLink())throw Error('PRIVATE_PATH')
  const record=JSON.parse(await readFile(file,'utf8'))
  if(record.label===label&&record.reviewerSlot==='admin1'&&/^[a-f0-9]{64}$/.test(record.sourceKey)&&name==='approved-'+record.draft?.fingerprint+'.json')selections[record.sourceKey]={start:record.start,end:record.end,fingerprint:record.draft.fingerprint}
 }
 return async(mail:PublicMail)=>{
  const key=createHash('sha256').update(JSON.stringify([label,mail])).digest('hex'),selection=selections[key]
  if(!selection)return null
  const draft=reviewedExcerpt(mail,selection.start,selection.end,true)
  if(draft.fingerprint!==selection.fingerprint)throw Error('REVIEW_SOURCE_CHANGED')
  return draft
 }
}
