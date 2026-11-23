import {e2eProfile} from './e2e-profile'
/** Explicit pairs; synthetic stacks additionally require their own project-scoped keys. */
export function localProfile(env:Readonly<Record<string,string|undefined>>) {
 const e2e=e2eProfile(env);if(e2e)return e2e
 if(env.OAZ_DESKTOP_DEV==='true'&&env.OAZ_DESKTOP_INTEGRATION==='owned-v1')return {web:'http://127.0.0.1:3310',api:'http://127.0.0.1:55341',privatePath:'build/main-admin-integration-20261112/runtime'}
 if(env.OAZ_FINAL_ACCEPTANCE==='true'&&env.OAZ_SECURITY_BRIDGE==='true')return {web:'http://127.0.0.1:3304',api:'http://127.0.0.1:55496',privatePath:'build/final-acceptance/private'}
 if(env.OAZ_SECURITY_BRIDGE==='true')return {web:'http://127.0.0.1:3303',api:'http://127.0.0.1:55495',privatePath:'build/security-conflict/private'}
 if(env.OAZ_ADMIN_VERIFY_STACK==='true')return {web:'http://127.0.0.1:3302',api:'http://127.0.0.1:55494',privatePath:env.OAZ_FINAL_INTEGRATION==='true'?'build/final-integration/private':'build/admin-verification/private'}
 return {web:'http://127.0.0.1:3301',api:'http://127.0.0.1:55491',privatePath:'build/admin-dev/private'}
}
export function isDesktopLocalProfile(env:Readonly<Record<string,string|undefined>>) {
 return env.OAZ_DESKTOP_DEV==='true'&&env.OAZ_DESKTOP_INTEGRATION==='owned-v1'&&env.OAZ_SECURITY_BRIDGE==='true'&&env.OAZ_FINAL_ACCEPTANCE==='true'&&isFinalLocalProfile(env)
}
export function localGateway(env:Readonly<Record<string,string|undefined>>) {
 const e2e=e2eProfile(env);if(e2e)return e2e.gateway
 return isDesktopLocalProfile(env)?'http://127.0.0.1:55347':localProfile(env).api
}
export function isFinalLocalProfile(env:Readonly<Record<string,string|undefined>>) {
 const p=localProfile(env)
 return env.OAZ_FINAL_INTEGRATION==='true'&&env.OAZ_LOCAL_ADMIN_DEV==='true'&&env.OAZ_ADMIN_ORIGIN===p.web&&env.NEXT_PUBLIC_SUPABASE_URL===p.api&&env.OAZ_ADMIN_VERIFY_STACK==='true'
}
/** Opt-in reviewed Main deployment only; this function never enables a deployment. */
export function reviewedMainProfile(env:Readonly<Record<string,string|undefined>>){
 if(env.OAZ_ACCOUNTS_RELEASE!=='reviewed-v1'||env.OAZ_SECURITY_BRIDGE!=='true'||env.OAZ_SUPABASE_PROJECT_REF!=='maoefmwpdcnugyenyiea'||env.NEXT_PUBLIC_SUPABASE_URL!=='https://maoefmwpdcnugyenyiea.supabase.co')return null
 try{
  const gateway=new URL(env.OAZ_ACCOUNTS_PRIVATE_GATEWAY!),origin=new URL(env.OAZ_ADMIN_ORIGIN!)
  if(gateway.protocol!=='https:'||gateway.pathname!=='/acceptance-rpc/v1/rpc/'||gateway.username||gateway.password||gateway.search||gateway.hash||origin.protocol!=='https:'||origin.origin!==env.OAZ_ADMIN_ORIGIN||!/^\w{64}$/.test(env.OAZ_ACCOUNTS_GATE_KEY??''))return null
  return {api:env.NEXT_PUBLIC_SUPABASE_URL,web:origin.origin,gateway:gateway.origin,gate:env.OAZ_ACCOUNTS_GATE_KEY!}
 }catch{return null}
}

/** Explicit Main runtime candidate. Config opt-in is not deployment approval. */
export function reviewedMainRuntime(env:Readonly<Record<string,string|undefined>>){
 if(env.OAZ_MAIN_RUNTIME_RELEASE!=='reviewed-v1'||env.VERCEL!=='1'||env.VERCEL_ENV!=='production'||env.OAZ_ADMIN_ORIGIN!=='https://www.oazkorea.co.kr')return null
 for(const key of ['OAZ_DESKTOP_DEV','OAZ_LOCAL_ADMIN_DEV','OAZ_FINAL_INTEGRATION','OAZ_FINAL_ACCEPTANCE','OAZ_ADMIN_VERIFY_STACK'])if(env[key]==='true')return null
 if(env.OAZ_E2E_RUN_ID||env.NEXT_PUBLIC_OAZ_DESKTOP_INTEGRATION)return null
 return reviewedMainProfile(env)
}
