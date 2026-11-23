import 'server-only'
import {createHash} from 'node:crypto'
import {readFile,writeFile,rename,mkdir,lstat} from 'node:fs/promises'
import {join} from 'node:path'
import {localProfile} from './security-profile'
import type {Draft} from './admin/promotion-contract'
import {serverClient} from './admin/server-client'
export const draftSourceHash=(draft:Pick<Draft,'title'|'body'>)=>createHash('sha256').update(JSON.stringify([draft.title,draft.body??''])).digest('hex')
async function reviewPath(id:string,revision:number,env:NodeJS.ProcessEnv){
 if(!/^[a-f0-9-]{36}$/i.test(id)||!Number.isSafeInteger(revision)||revision<0)throw Error('INVALID_REVIEW')
 const root=join(process.cwd(),localProfile(env).privatePath);if((await lstat(root)).isSymbolicLink())throw Error('PRIVATE_PATH')
 const folder=join(root,'promotion-english');await mkdir(folder,{recursive:true,mode:0o700});if((await lstat(folder)).isSymbolicLink())throw Error('PRIVATE_PATH')
 const file=join(folder,id+'-'+revision+'.json');try{if((await lstat(file)).isSymbolicLink())throw Error('PRIVATE_PATH')}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e}return file
}
export async function saveDraftEnglish(draft:Draft,title:string,body:string,env:NodeJS.ProcessEnv){
 const file=await reviewPath(draft.id,draft.revision,env),record={draftId:draft.id,revision:draft.revision,sourceHash:draftSourceHash(draft),title,body,reviewer:'admin1',reviewedAt:new Date().toISOString()},history=file+'.'+crypto.randomUUID()
 await writeFile(history,JSON.stringify(record),{flag:'wx',mode:0o600});const temporary=history+'.current';await writeFile(temporary,JSON.stringify(record),{flag:'wx',mode:0o600});await rename(temporary,file)
}
export async function loadDraftEnglish(draft:Draft,revision:number,env:NodeJS.ProcessEnv){
 try{const review=JSON.parse(await readFile(await reviewPath(draft.id,revision,env),'utf8'));return review.draftId===draft.id&&review.revision===revision&&review.reviewer==='admin1'&&review.sourceHash===draftSourceHash(draft)&&typeof review.title==='string'&&typeof review.body==='string'?review as {title:string;body:string;sourceHash:string}:null}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return null;throw e}
}
/** Publication still uses the existing user JWT and DB authority. Never upgrades B permissions. */
export async function publishReviewedEnglish(client:ReturnType<typeof serverClient>,draft:Draft,postId:number,english:{title:string;body:string}){
 const session=await client.rpc('oaz_admin_command_v2',{command:{action:'session',version:0,requestId:crypto.randomUUID()}});if(session.error)return false
 const current=await client.rpc('oaz_final_command_v1',{command:{action:'translation.get',table:'editor_0_noti',id:postId,requestId:crypto.randomUUID()}})
 if(current.error||current.data?.source?.title!==draft.title||current.data?.source?.body!==draft.body)return false
 if((current.data.title||current.data.body)&&!['automatic','pending','retry'].includes(current.data.status))return current.data.title===english.title&&current.data.body===english.body
 const saved=await client.rpc('oaz_final_command_v1',{command:{action:'translation.save',table:'editor_0_noti',id:postId,revision:current.data.revision,sourceHash:current.data.sourceHash,version:session.data.version,title:english.title,body:english.body,requestId:crypto.randomUUID()}})
 return !saved.error
}
