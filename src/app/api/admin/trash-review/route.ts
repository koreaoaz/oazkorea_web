import {adminPort} from '@/lib/admin/server'
import {acceptanceRpc} from '@/lib/acceptance-rpc'
import {handleTrashReview,type TrashActor} from '@/lib/admin/trash-review'
import {isFinalLocalProfile,reviewedMainRuntime} from '@/lib/security-profile'
export const dynamic='force-dynamic'
export async function POST(request:Request){
 if(!reviewedMainRuntime(process.env)&&(process.env.OAZ_FINAL_ACCEPTANCE!=='true'||!isFinalLocalProfile(process.env)))return Response.json({error:'TRASH_NOT_READY'},{status:503,headers:{'Cache-Control':'no-store'}})
 return handleTrashReview(request,process.env,token=>({
  verify:()=>adminPort(token).verify(token),
  session:async()=>{const r=await adminPort(token).execute({action:'session',requestId:crypto.randomUUID(),version:0});return r.code?null:r.data as TrashActor},
  execute:async command=>{try{return {data:await acceptanceRpc('trash_review',{command},token)}}catch(e){return {code:e instanceof Error?e.message:'TRANSPORT_ERROR'}}},
 }))
}
