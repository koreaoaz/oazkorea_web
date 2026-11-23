import 'server-only'
import {isFinalLocalProfile,localProfile,localGateway,reviewedMainProfile} from './security-profile'
import {gatewayToken} from './gateway-public-token'
import {supabaseApiFetch} from './supabase-api-fetch'

const reviewed=new Set(['oaz_storage_gateway_v1','oaz_account_recovery_v1','oaz_admin_command_v2','oaz_admin_insights_v1','oaz_attachment_access_v1','oaz_attachment_command_v1','oaz_final_command_v1','oaz_honor_manage_v1','oaz_media_approve_scoped_v1','oaz_media_reserve_scoped_v1','oaz_promotion_command_v1','oaz_public_attachments_v1','oaz_public_content_meta_v1','oaz_public_honor_v1','oaz_public_study_sessions_v1'])
/** Forward the original end-user JWT; never mint a privileged user or role claim. */
export function securityBridgeFetch(env:Readonly<Record<string,string|undefined>>=process.env,request:typeof fetch=fetch):typeof fetch {
 return async(input,init)=>{
  if(env.OAZ_SECURITY_BRIDGE!=='true')return request(input,init)
  const production=reviewedMainProfile(env)
  if(!production&&(!isFinalLocalProfile(env)||!/^\w{64}$/.test(env.OAZ_SECURITY_BRIDGE_KEY??'')))throw Error('SECURITY_BRIDGE_NOT_CONFIGURED')
  const req=new Request(input,init),url=new URL(req.url),profile=production??localProfile(env)
  if(url.origin!==profile.api)throw Error('SECURITY_BRIDGE_ORIGIN_DENIED')
  const name=url.pathname.match(/^\/rest\/v1\/rpc\/([a-z0-9_]+)$/)?.[1]
  if(!name||!reviewed.has(name))return supabaseApiFetch(profile.api,request)(input,{...init,redirect:'error'})
  if(req.method!=='POST'||url.search||url.hash)throw Error('SECURITY_BRIDGE_REQUEST_DENIED')
  const headers=new Headers(req.headers)
  if(production){
   const original=headers.get('authorization')
   if(original&&!original.startsWith('Bearer '))throw Error('SECURITY_BRIDGE_AUTH_DENIED')
   headers.set('Authorization','Bearer '+gatewayToken(original?.slice(7),env,true))
  }
  headers.set('x-oaz-server-gate',production?.gate??env.OAZ_SECURITY_BRIDGE_KEY!)
  headers.delete('accept-profile');headers.delete('content-profile')
  return request((production?.gateway??localGateway(env))+'/server-rpc/v1/rpc/'+name,{method:'POST',headers,body:await req.arrayBuffer(),cache:'no-store',redirect:'error',signal:req.signal})
 }
}
