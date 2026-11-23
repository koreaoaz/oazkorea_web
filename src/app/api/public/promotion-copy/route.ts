import {readFile,lstat} from 'node:fs/promises'
import {join} from 'node:path'
import {serverClient} from '@/lib/admin/server-client'
import {isFinalLocalProfile,localProfile} from '@/lib/security-profile'
import {safeAutoCopy} from '@/lib/mail-autofill'
export const dynamic='force-dynamic'
export async function GET(request:Request){
 const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'},empty=()=>Response.json(null,{headers})
 if(process.env.OAZ_FINAL_ACCEPTANCE!=='true'||!isFinalLocalProfile(process.env))return empty()
 const params=new URL(request.url).searchParams,id=params.get('id')??''
 if(!/^[1-9][0-9]*$/.test(id)||!Number.isSafeInteger(Number(id))||[...params.keys()].some(k=>k!=='id')||params.getAll('id').length!==1)return Response.json({error:'INVALID_INPUT'},{status:400,headers})
 try{
  // Anonymous public visibility and current hash precede every private cache read.
  const meta=await serverClient().rpc('oaz_public_content_meta_v1',{tbl:'editor_0_noti',rid:Number(id)})
  if(meta.error||!meta.data?.sourceHash)return empty()
  const folder=join(process.cwd(),localProfile(process.env).privatePath,'mail-public-copy'),path=join(folder,id+'.json')
  if((await lstat(folder)).isSymbolicLink())return empty()
  const info=await lstat(path);if(!info.isFile()||info.isSymbolicLink()||info.size>180000)return empty()
  const cache=JSON.parse(await readFile(path,'utf8'))
  if(cache.sourceHash!==meta.data.sourceHash||!safeAutoCopy(cache.copy))return empty()
  return Response.json({deadline:cache.copy.deadline,links:cache.copy.links,translationStatus:'blocked_provider',sourceHash:meta.data.sourceHash},{headers})
 }catch{return empty()}
}
