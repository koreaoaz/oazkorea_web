import {serverClient} from '@/lib/admin/server-client'
import {handleFinalRequest} from '@/lib/admin/final-http'
export const dynamic='force-dynamic'
export async function POST(request:Request){return handleFinalRequest(request,process.env,token=>{
 const c=serverClient(token)
 return {verify:async()=>{const r=await c.auth.getUser(token);return r.error?null:r.data.user?.id??null},execute:async command=>{const r=await c.rpc('oaz_final_command_v1',{command});return {data:r.data,code:r.error?.code||undefined}}}
})}
