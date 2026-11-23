import 'server-only'
import {createClient} from '@supabase/supabase-js'
import {supabaseApiFetch} from '../supabase-api-fetch'
import {isDesktopLocalProfile,isFinalLocalProfile,localGateway,localProfile,reviewedMainProfile} from '../security-profile'
/** The production private gateway is a release prerequisite; never use public REST for these RPCs. */
export function credentialsConfiguration(env:NodeJS.ProcessEnv=process.env){
 if(isDesktopLocalProfile(env)){
  if(!env.NEXT_PUBLIC_SUPABASE_KEY||!env.OAZ_AUTH_ADMIN_KEY||!env.OAZ_ACCOUNTS_SERVICE_JWT||!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(env.OAZ_ACCOUNTS_SERVICE_JWT)||!/^[a-f0-9]{64}$/.test(env.OAZ_SECURITY_BRIDGE_KEY??''))return null
  const p=localProfile(env)
  return {origin:p.web,api:p.api,rpc:localGateway(env)+'/acceptance-rpc/v1/rpc/',key:env.NEXT_PUBLIC_SUPABASE_KEY,service:env.OAZ_AUTH_ADMIN_KEY,rpcService:env.OAZ_ACCOUNTS_SERVICE_JWT,gate:env.OAZ_SECURITY_BRIDGE_KEY!,local:true}
 }
 if(isFinalLocalProfile(env)&&env.OAZ_FINAL_ACCEPTANCE==='true')return {
  origin:'http://127.0.0.1:3304',api:'http://127.0.0.1:55496',rpc:'http://127.0.0.1:55496/acceptance-rpc/v1/rpc/',
  key:env.NEXT_PUBLIC_SUPABASE_KEY!,service:env.OAZ_LOCAL_SERVICE_ROLE_KEY!,rpcService:env.OAZ_LOCAL_SERVICE_ROLE_KEY!,gate:env.OAZ_SECURITY_BRIDGE_KEY!,local:true}
 if(!reviewedMainProfile(env))return null
 try{
  const managed=env.OAZ_GATEWAY_TRANSPORT==='data-api-v1'
  const service=managed?(env.SUPABASE_SECRET_KEY??env.SUPABASE_SERVICE_ROLE_KEY):env.OAZ_AUTH_ADMIN_KEY
  const origin=new URL(env.OAZ_ADMIN_ORIGIN!),gateway=new URL(env.OAZ_ACCOUNTS_PRIVATE_GATEWAY!)
  if(origin.protocol!=='https:'||origin.origin!==env.OAZ_ADMIN_ORIGIN||gateway.protocol!=='https:'||gateway.username||gateway.password||gateway.search||gateway.hash||gateway.pathname!=='/acceptance-rpc/v1/rpc/'||env.NEXT_PUBLIC_SUPABASE_URL!=='https://maoefmwpdcnugyenyiea.supabase.co'||!service||!env.OAZ_ACCOUNTS_GATE_KEY)return null
  // Auth API의 sb_secret 키는 내부 PostgREST가 검증하는 JWT가 아니다.
  // 여기서는 형식만 확인하며 서명·역할 검증은 내부 PostgREST와 DB가 수행한다.
  const rpcService=managed?service:env.OAZ_ACCOUNTS_SERVICE_JWT
  if(!rpcService||rpcService.trim()!==rpcService||rpcService.length>8192||!(managed&&/^sb_secret_[A-Za-z0-9_-]+$/.test(rpcService)||/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(rpcService)))return null
  return {origin:origin.origin,api:env.NEXT_PUBLIC_SUPABASE_URL,rpc:gateway.href,key:env.NEXT_PUBLIC_SUPABASE_KEY!,service,rpcService,gate:env.OAZ_ACCOUNTS_GATE_KEY,local:false}
 }catch{return null}
}
export function credentialsAuth(service=false){
 const c=credentialsConfiguration();if(!c)throw Error('ACCOUNTS_NOT_READY')
 return createClient(c.api,service?c.service:c.key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:supabaseApiFetch(c.api)}})
}
export async function credentialRpc(name:'accounts_manage'|'accounts_service'|'login_identity'|'password_identity'|'password_manage'|'password_service'|'enrollment_self'|'super_recovery_service'|'super_recovery_claim',command:Record<string,unknown>,token?:string){
 const c=credentialsConfiguration();if(!c)throw Error('ACCOUNTS_NOT_READY')
 const r=await fetch(c.rpc+name,{method:'POST',cache:'no-store',redirect:'error',signal:AbortSignal.timeout(20000),
  headers:{'content-type':'application/json',apikey:c.key,'x-oaz-server-gate':c.gate,Authorization:'Bearer '+(['accounts_service','password_service','super_recovery_service'].includes(name)?c.rpcService:token??'')},body:JSON.stringify({command})})
 const data=await r.json().catch(()=>null)
 if(!r.ok)throw Error(['42501','PT409','23505','22023'].includes(data?.code)?data.code:'ACCOUNTS_UNAVAILABLE')
 return data
}
