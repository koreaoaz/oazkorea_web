import {adminPort} from '@/lib/admin/server'
import {acceptanceRpc} from '@/lib/acceptance-rpc'
import {handleHonorWorkflow,type HonorActor} from '@/lib/admin/honor-workflow'
import {isFinalLocalProfile,reviewedMainRuntime} from '@/lib/security-profile'
export const dynamic='force-dynamic'
export async function POST(request:Request){
 if(!reviewedMainRuntime(process.env)&&(process.env.OAZ_FINAL_ACCEPTANCE!=='true'||!isFinalLocalProfile(process.env)))return Response.json({error:'HONOR_NOT_READY'},{status:503,headers:{'Cache-Control':'no-store'}})
 return handleHonorWorkflow(request,process.env,token=>({
  verify:()=>adminPort(token).verify(token),
  session:async()=>{const r=await adminPort(token).execute({action:'session',requestId:crypto.randomUUID(),version:0});return r.code?null:r.data as HonorActor},
  execute:async command=>{try{return {data:await acceptanceRpc('honor_workflow',{command},token)}}catch(e){return {code:e instanceof Error?e.message:'TRANSPORT_ERROR'}}},
 }))
}
