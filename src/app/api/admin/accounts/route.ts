import 'server-only'
import { createClient } from '@supabase/supabase-js'
import { handleAccountCreation } from '@/lib/admin/accounts'
import { adminPort } from '@/lib/admin/server'
export const dynamic='force-dynamic'
export async function POST(request:Request){
  if(process.env.OAZ_ACCOUNT_REGISTRY_V1==='true'||process.env.OAZ_ACCOUNTS_RELEASE==='reviewed-v1'){
    const reply=(status:number,error:string)=>Response.json({error},{status,headers:{'Cache-Control':'no-store'}})
    if(request.headers.get('origin')!==process.env.OAZ_ADMIN_ORIGIN)return reply(403,'ORIGIN_DENIED')
    const token=request.headers.get('authorization')?.match(/^Bearer ([A-Za-z0-9._-]{20,8192})$/)?.[1]
    if(!token)return reply(401,'AUTH_REQUIRED')
    try{
      const port=adminPort(token)
      if(!await port.verify(token))return reply(401,'AUTH_EXPIRED')
      const session=await port.execute({action:'session',requestId:crypto.randomUUID(),version:0})
      if(session.code||!session.data||typeof session.data!=='object'||!('role' in session.data)||session.data.role!=='SUPER_ADMIN')return reply(403,'FORBIDDEN')
      return reply(409,(isDesktopLocalProfile(process.env)||reviewedMainRuntime(process.env))?'USE_INVITATION_FLOW':'EXACT_FIVE_ADMIN_SLOTS')
    }catch{return reply(503,'ACCOUNT_UNAVAILABLE')}
  }
  return handleAccountCreation(request,process.env,token=>{
    const url=process.env.NEXT_PUBLIC_SUPABASE_URL
    if(url!==localProfile(process.env).api)throw new Error('LOCAL_AUTH_REQUIRED')
    const key=process.env.OAZ_LOCAL_SERVICE_ROLE_KEY
    if(!key)throw new Error('LOCAL_AUTH_KEY_REQUIRED')
    const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}})
    return {...adminPort(token),createIdentity:async(email,password,requestId)=>{
      const {data,error}=await client.auth.admin.createUser({email,password,email_confirm:true,app_metadata:{oaz_provisioning_request:requestId}})
      if(!error)return data.user.id
      // Recovery is limited to the same server-created operation. Never adopt an unrelated identity.
      if(process.env.OAZ_FINAL_INTEGRATION!=='true'||!email.endsWith('@example.invalid'))return null
      const listed=await client.auth.admin.listUsers({page:1,perPage:1000})
      if(listed.error)return null
      const matches=listed.data.users.filter(u=>u.email===email&&u.app_metadata.oaz_provisioning_request===requestId)
      return matches.length===1?matches[0].id:null
    }}
  })
}
import {localProfile,isDesktopLocalProfile,reviewedMainRuntime} from '@/lib/security-profile'
