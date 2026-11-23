import 'server-only'
import {rolePasswordEnabled} from './role-password-policy'
import {lstat,readFile} from 'node:fs/promises'
import path from 'node:path'
import {createClient} from '@supabase/supabase-js'
import {supabaseApiFetch} from '../supabase-api-fetch'
import {isDesktopLocalProfile,isFinalLocalProfile,localProfile,reviewedMainRuntime} from '../security-profile'
import {adminPort} from './server'
import {LOGIN_NAME,type LoginIdentity,type UsernameLoginPort} from './username-login'
import {UUID_PATTERN} from './protocol'
import {credentialRpc,credentialsConfiguration} from './credentials-server'

export async function credentialRegistryReady(){
 if(!credentialsConfiguration())return false
 try{
  const preflight=await credentialRpc(rolePasswordEnabled()?'password_service':'accounts_service',{action:'preflight'})
  if(rolePasswordEnabled())return preflight.policy==='role-password-v1' && preflight.registryCount>=1
  const count=preflight.registryCount
  if(reviewedMainRuntime(process.env))return Number.isSafeInteger(count)&&count>=1
  return isDesktopLocalProfile(process.env)?Number.isSafeInteger(count)&&count>=5:count===5
 }catch{return false}
}

/** Isolated review adapter, never loaded for production. No passwords in this registry.
 * A production registry with transactional audit/rename is a separate release gate.
 */
export async function localLoginRegistry():Promise<Map<string,LoginIdentity>|null>{
 if(!isFinalLocalProfile(process.env)||process.env.OAZ_FINAL_ACCEPTANCE!=='true')return null
 try{
  const root=process.cwd(),file=path.join(root,localProfile(process.env).privatePath,'admin-login-aliases.json')
  for(let current=file;;current=path.dirname(current)){
   const stat=await lstat(current);if(stat.isSymbolicLink())return null
   if(current===path.dirname(current))break
  }
  if((await lstat(file)).size>8192)return null
  const config=JSON.parse(await readFile(file,'utf8'))
  if(config.schema!==1||config.localSynthetic!==true||config.origin!=='http://127.0.0.1:3304'||
   config.api!=='http://127.0.0.1:55496'||!Array.isArray(config.accounts)||config.accounts.length!==5)return null
  const result=new Map<string,LoginIdentity>(),slots=new Set(),users=new Set()
  for(const a of config.accounts){
   if(!a||typeof a.username!=='string'||typeof a.slot!=='string'||typeof a.userId!=='string'||!LOGIN_NAME.test(a.username)||!/^admin[1-5]$/.test(a.slot)||!UUID_PATTERN.test(a.userId)||
    typeof a.email!=='string'||!/^[-+.\w]+@example\.invalid$/.test(a.email)||result.has(a.username)||slots.has(a.slot)||users.has(a.userId))return null
   slots.add(a.slot);users.add(a.userId);result.set(a.username,{slot:a.slot,userId:a.userId,email:a.email})
  }
  return result
 }catch{return null}
}

export function usernamePort(registry:Map<string,LoginIdentity>):UsernameLoginPort{
 const auth=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_KEY!,{
  auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:supabaseApiFetch(process.env.NEXT_PUBLIC_SUPABASE_URL!)}})
 return {
  resolve:async username=>{
   if(await credentialRegistryReady()){
    const value=await credentialRpc(rolePasswordEnabled()?'password_service':'accounts_service',{action:'resolve',username})
    if(value?.limited)throw Error('LOGIN_RETRY_LATER')
    return value?{...value,username}:null
   }
   // Once the DB registry is enabled, a DB outage must not resurrect old aliases.
   if(process.env.OAZ_ACCOUNT_REGISTRY_V1==='true'||process.env.OAZ_ACCOUNTS_RELEASE==='reviewed-v1')throw Error('LOGIN_NOT_READY')
   return registry.get(username)??null
  },
  authenticate:async(email,password)=>{
   const {data,error}=await auth.auth.signInWithPassword({email,password})
   return !error&&data.session?{access_token:data.session.access_token,refresh_token:data.session.refresh_token}:null
  },
  current:async token=>{
   const user=await auth.auth.getUser(token);if(user.error||!user.data.user)return null
   if(rolePasswordEnabled()||isDesktopLocalProfile(process.env)){
    const s=await credentialRpc(rolePasswordEnabled()?'password_identity':'login_identity',{},token)
    return s?.userId===user.data.user.id&&typeof s.slot==='string'&&typeof s.role==='string'?s:null
   }
   const result=await adminPort(token).execute({action:'session',requestId:crypto.randomUUID(),version:0})
   const s=result.data as {slot?:unknown;role?:unknown}|null
   return !result.code&&s&&typeof s.slot==='string'&&typeof s.role==='string'?{userId:user.data.user.id,slot:s.slot,role:s.role}:null
  },
  discard:async()=>{await auth.auth.signOut({scope:'local'})},
 }
}
