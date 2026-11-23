import {serverClient} from '@/lib/admin/server-client'
import {handleHonorRequest} from '@/lib/admin/honor-http'
import {adminPort} from '@/lib/admin/server'
import type {HonorActor} from '@/lib/admin/honor-workflow'
export const dynamic='force-dynamic'
export async function POST(request:Request){
 return handleHonorRequest(request,process.env,token=>({
  verify:adminPort(token).verify,
  session:async()=>{const r=await adminPort(token).execute({action:'session',requestId:crypto.randomUUID(),version:0});return r.code?null:r.data as HonorActor},
  execute:async command=>{
   const client=serverClient(token)
   const {data,error}=await client.rpc('oaz_honor_manage_v1',{command});return {data,code:error?(error.code||'TRANSPORT_ERROR'):undefined}
  },
 }))
}
