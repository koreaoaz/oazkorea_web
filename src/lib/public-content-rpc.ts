import {supabase} from '@/lib/supabaseClient'
import {mainPresentation} from './main-presentation'
export type PublicRpc='oaz_public_content_meta_v1'|'oaz_public_study_sessions_v1'|'oaz_public_attachments_v1'
type PublicResult={data:unknown;error:unknown|null}
const pending=new Map<string,Promise<PublicResult>>()
let active=0
const waiting:Array<()=>void>=[]
async function bounded<T>(read:()=>Promise<T>){
 if(active<4)active++;else await new Promise<void>(resolve=>waiting.push(resolve))
 try{return await read()}finally{const next=waiting.shift();if(next)next();else active--}
}
/** Public projections only. The browser never receives the internal gateway key. */
export async function publicContentRpc<T>(name:PublicRpc,args?:{tbl:string;rid:number},signal?:AbortSignal):Promise<{data:T|null;error:unknown|null}>{
 if(typeof process==='undefined'||!mainPresentation()&&process.env.NEXT_PUBLIC_OAZ_SECURITY_BRIDGE!=='true'){
  try{
  const query=supabase.rpc(name,args)
  const result=await (signal?query.abortSignal(signal):query)
  return {data:result.data as T|null,error:result.error}
  }catch{return {data:null,error:'PUBLIC_CONTENT_UNAVAILABLE'}}
 }
 try{
  const params=new URLSearchParams({kind:name,...(args?{table:args.tbl,id:String(args.rid)}:{})})
  const prefix=typeof window==='undefined'?(mainPresentation()?'https://www.oazkorea.co.kr':process.env.OAZ_E2E_RUN_ID?process.env.OAZ_ADMIN_ORIGIN:process.env.NEXT_PUBLIC_OAZ_DESKTOP_INTEGRATION==='owned-v1'?'http://127.0.0.1:3310':process.env.NEXT_PUBLIC_OAZ_FINAL_ACCEPTANCE==='true'?'http://127.0.0.1:3304':'http://127.0.0.1:3303'):''
  const url=prefix+'/api/public/content?'+params
  const read=async():Promise<PublicResult>=>{
   try{const response=await fetch(url,{signal,cache:'no-store',credentials:'omit',redirect:'error'})
    if(!response.ok)return {data:null,error:'PUBLIC_CONTENT_UNAVAILABLE'}
    return {data:await response.json(),error:null}
   }catch{return {data:null,error:'PUBLIC_CONTENT_UNAVAILABLE'}}
  }
  // Share only an in-flight public read. Completed responses are never cached;
  // source edits, stale translations and withdrawn attachments are revalidated.
  if(typeof window==='undefined')return await read() as {data:T|null;error:unknown|null}
  if(signal)return await bounded(read) as {data:T|null;error:unknown|null}
  let task=pending.get(url)
  if(!task){task=bounded(read).finally(()=>pending.delete(url));pending.set(url,task)}
  return await task as {data:T|null;error:unknown|null}
 }catch{return {data:null,error:'PUBLIC_CONTENT_UNAVAILABLE'}}
}
