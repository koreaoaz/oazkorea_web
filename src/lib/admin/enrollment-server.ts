import 'server-only'
import {createClient} from '@supabase/supabase-js'
import {supabaseApiFetch} from '../supabase-api-fetch'
import {credentialsConfiguration} from './credentials-server'
import type {UsernameLoginPort} from './username-login'
import {isDesktopLocalProfile} from '../security-profile'

export function enrollmentConfiguration(env:NodeJS.ProcessEnv=process.env){
 if(isDesktopLocalProfile(env))return credentialsConfiguration(env)
 // 기존 3304에는 opt-in하지 않는다. 새 합성 환경의 정확한 포트 쌍만 허용한다.
 if(env.OAZ_ENROLLMENT_SYNTHETIC==='owned-v1'&&env.OAZ_ADMIN_ORIGIN==='http://127.0.0.1:3316'&&env.NEXT_PUBLIC_SUPABASE_URL==='http://127.0.0.1:55501'&&/^[a-f0-9]{64}$/.test(env.OAZ_ENROLLMENT_GATE_KEY??''))return {
  origin:'http://127.0.0.1:3316',api:'http://127.0.0.1:55501',rpc:'http://127.0.0.1:55501/acceptance-rpc/v1/rpc/',key:env.NEXT_PUBLIC_SUPABASE_KEY!,service:env.OAZ_ENROLLMENT_AUTH_KEY!,rpcService:env.OAZ_ENROLLMENT_AUTH_KEY!,gate:env.OAZ_ENROLLMENT_GATE_KEY!}
 if(env.OAZ_ENROLLMENT_RELEASE!=='reviewed-v1')return null
 return credentialsConfiguration(env)
}
export function enrollmentAuth(){
 const c=enrollmentConfiguration();if(!c)throw Error('ENROLLMENT_NOT_READY')
 return createClient(c.api,c.key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:supabaseApiFetch(c.api)}})
}
export async function enrollmentRpc(action:'status'|'activate'|'resolve',username?:string,token?:string){
 const c=enrollmentConfiguration();if(!c)throw Error('ENROLLMENT_NOT_READY')
 const service=action==='resolve',command=service?{action,username}:{action}
 const r=await fetch(c.rpc+(service?'enrollment_service':'enrollment_self'),{method:'POST',cache:'no-store',redirect:'error',signal:AbortSignal.timeout(15000),headers:{'Content-Type':'application/json',apikey:c.key,'x-oaz-server-gate':c.gate,Authorization:'Bearer '+(service?c.rpcService:token??'')},body:JSON.stringify({command})})
 if(!r.ok)throw Error(r.status===403?'42501':'ENROLLMENT_NOT_AVAILABLE')
 return r.json()
}
export function enrollmentLoginPort():UsernameLoginPort{
 const auth=enrollmentAuth()
 return {
  resolve:async username=>enrollmentRpc('resolve',username),
  authenticate:async(email,password)=>{const {data,error}=await auth.auth.signInWithPassword({email,password});return !error&&data.session?{access_token:data.session.access_token,refresh_token:data.session.refresh_token}:null},
  current:async token=>{const {data,error}=await auth.auth.getUser(token);if(error||!data.user)return null;const s=await enrollmentRpc('status',undefined,token);return s?.state==='PENDING_ENROLLMENT'&&s.userId===data.user.id?{userId:s.userId,slot:s.slot,role:s.role}:null},
  discard:async()=>{await auth.auth.signOut({scope:'local'})},
 }
}
