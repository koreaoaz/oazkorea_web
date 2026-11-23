import {inspectSupabaseConfig} from './supabaseConfig'
import {isDesktopLocalProfile} from './security-profile'
import {assertOfflinePreview} from './offline-preview'

type Env=Readonly<Record<string,string|undefined>>
const stop=(code:string):never=>{throw new Error('SECURITY_CONFIGURATION:'+code)}
const protectedRefs=new Set(['maoefmwpdcnugyenyiea','ctbwaqtqubmjmltbxfzm'])

/** Pure configuration checks. Messages contain codes, never supplied values. */
export function assertPublicConfiguration(url?:string,key?:string){
 if(inspectSupabaseConfig(url,key).some(issue=>issue.severity==='error'))stop('PUBLIC_CLIENT')
}
function unsafeCredential(value:string){
 if(value.startsWith('sb_secret_')||value.includes('-----BEGIN '))return true
 if(value.startsWith('eyJ')){
  try{return JSON.parse(atob(value.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))).role!=='anon'}catch{return true}
 }
 return false
}
export function assertDeploymentEnvironment(env:Env){
 if(env.OAZ_PREVIEW_MODE==='offline-v1')return assertOfflinePreview(env)
 assertPublicConfiguration(env.NEXT_PUBLIC_SUPABASE_URL,env.NEXT_PUBLIC_SUPABASE_KEY)
 for(const [name,value] of Object.entries(env)){
  if(value&&name.startsWith('NEXT_PUBLIC_')&&(unsafeCredential(value)||/(?:SERVICE_ROLE|SECRET|PASSWORD|PRIVATE_KEY|AUTH_ADMIN|GATE_KEY)/.test(name)))stop('PUBLIC_SECRET')
 }
 const hosted=env.VERCEL==='1'||!!env.VERCEL_URL||!!env.VERCEL_BRANCH_URL
 if(hosted&&!['preview','production','development'].includes(env.VERCEL_ENV??''))stop('HOSTED_CONTEXT')
 if(hosted&&(env.OAZ_LOCAL_ADMIN_DEV==='true'||env.OAZ_DESKTOP_DEV==='true'||env.NEXT_PUBLIC_OAZ_DESKTOP_INTEGRATION))stop('HOSTED_LOCAL_PROFILE')
 if(env.VERCEL_ENV==='preview'){
  const ref=env.OAZ_PREVIEW_ISOLATED_REF
  if(!/^[a-z]{20}$/.test(ref??'')||protectedRefs.has(ref!))stop('PREVIEW_ISOLATED_PROJECT')
  const target='https://'+ref+'.supabase.co'
  if(env.NEXT_PUBLIC_SUPABASE_URL!==target)stop('PREVIEW_TARGET')
  // Existing member OAuth is closed. This does not enable another registration flow.
  if(env.NEXT_PUBLIC_OAZ_OAUTH_TEST_ORIGIN)stop('PREVIEW_OAUTH_CLOSED')
  if(env.OAZ_ADMIN_ENABLED==='true'||env.OAZ_VISITOR_V2_ENABLED==='true')stop('PREVIEW_PRIVILEGED_SERVICE_UNREVIEWED')
  const urls=new Set(['SUPABASE_URL','SUPABASE_STORAGE_URL','NEXT_PUBLIC_SUPABASE_STORAGE_URL','NEXT_PUBLIC_PROJECT_STORAGE_URL'])
  const refs=new Set(['SUPABASE_PROJECT_REF','NEXT_PUBLIC_SUPABASE_PROJECT_REF','SUPABASE_REF','NEXT_PUBLIC_SUPABASE_REF'])
  const keys=new Set(['SUPABASE_ANON_KEY','NEXT_PUBLIC_SUPABASE_ANON_KEY','SUPABASE_PUBLISHABLE_KEY','NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'])
  for(const [name,value] of Object.entries(env)){
   if(!value)continue
   if(unsafeCredential(value))stop('PREVIEW_PRIVILEGED_ALIAS')
   if(urls.has(name)){if(value!==target&&!value.startsWith(target+'/'))stop('PREVIEW_ALTERNATE_URL');continue}
   if(refs.has(name)){if(value!==ref)stop('PREVIEW_ALTERNATE_REF');continue}
   if(keys.has(name)){if(value!==env.NEXT_PUBLIC_SUPABASE_KEY)stop('PREVIEW_ALTERNATE_KEY');continue}
   if(['NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_KEY','OAZ_PREVIEW_ISOLATED_REF','NEXT_PUBLIC_OAZ_PREVIEW_ISOLATED_REF'].includes(name))continue
   if(/(?:^|_)(?:SUPABASE|POSTGRES|POSTGRESQL|DATABASE|DB)(?:_|$)|^PG(?:HOST|HOSTADDR|PORT|USER|PASSWORD|DATABASE|SERVICE|SERVICEFILE|PASSFILE)$/.test(name)||/^OAZ_(?:AUTH_ADMIN_KEY|ACCOUNTS_SERVICE_JWT|LOCAL_SERVICE_ROLE_KEY|SECURITY_BRIDGE_KEY|ACCOUNTS_PRIVATE_GATEWAY)$/.test(name))stop('PREVIEW_UNREVIEWED_CONNECTION')
   if(value.startsWith('eyJ')){
    const claims=JSON.parse(atob(value.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')))
    if(claims.ref&&claims.ref!==ref)stop('PREVIEW_CREDENTIAL_PROJECT')
   }
  }
  return 'PREVIEW_CONFIGURATION_ONLY_REMOTE_ISOLATION_UNVERIFIED'
 }
 if(env.OAZ_DESKTOP_DEV==='true'||env.NEXT_PUBLIC_OAZ_DESKTOP_INTEGRATION){
  // Offline fixtures are build-only and cannot start the privileged desktop profile.
  const offline=env.NEXT_PUBLIC_SUPABASE_URL==='https://offline.invalid'&&env.NEXT_PUBLIC_SUPABASE_KEY==='sb_publishable_offline_fixture'&&env.OAZ_ADMIN_ENABLED==='false'&&env.OAZ_DESKTOP_BUILD_ONLY==='true'
  if(!offline&&(!isDesktopLocalProfile(env)||env.NEXT_PUBLIC_OAZ_DESKTOP_INTEGRATION!=='owned-v1'))stop('DESKTOP_PROFILE')
 }
 return 'PUBLIC_CONFIGURATION_ONLY_NOT_RELEASE_APPROVAL'
}

/** Compiled public values must match dynamic runtime values; a build cannot change projects silently. */
export function assertRuntimeEnvironment(compiled:Env,runtime:Env){
 assertDeploymentEnvironment(runtime)
 assertPublicConfiguration(compiled.NEXT_PUBLIC_SUPABASE_URL,compiled.NEXT_PUBLIC_SUPABASE_KEY)
 for(const key of ['NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_KEY','NEXT_PUBLIC_OAZ_DESKTOP_INTEGRATION']){
  if((compiled[key]??'')!==(runtime[key]??''))stop('RUNTIME_PUBLIC_MISMATCH')
 }
 if((compiled.NEXT_PUBLIC_OAZ_DEPLOYMENT_ENV??'')!==(runtime.VERCEL_ENV??''))stop('RUNTIME_DEPLOYMENT_MISMATCH')
 if((compiled.NEXT_PUBLIC_OAZ_PREVIEW_MODE??'')!==(runtime.OAZ_PREVIEW_MODE??''))stop('RUNTIME_PREVIEW_MODE_MISMATCH')
 if(runtime.VERCEL_ENV==='preview'&&runtime.OAZ_PREVIEW_MODE!=='offline-v1'&&compiled.NEXT_PUBLIC_OAZ_PREVIEW_ISOLATED_REF!==runtime.OAZ_PREVIEW_ISOLATED_REF)stop('RUNTIME_PREVIEW_MISMATCH')
}
