/** Explicit, local-only synthetic stack. Never accepts a deployment or a shared port. */
export function e2eProfile(env:Readonly<Record<string,string|undefined>>) {
 if(!env.OAZ_E2E_RUN_ID)return null
 const id=env.OAZ_E2E_RUN_ID
 const origin=(value:string|undefined)=>{
  try {const u=new URL(value!);const port=Number(u.port);return u.origin===value&&u.hostname==='127.0.0.1'&&['http:','https:'].includes(u.protocol)&&port>=18000&&port<=19999?value:null}catch{return null}
 }
 const web=origin(env.OAZ_ADMIN_ORIGIN),api=origin(env.NEXT_PUBLIC_SUPABASE_URL),gateway=origin(env.OAZ_E2E_GATEWAY)
 if(!/^[a-f0-9]{32}$/.test(id)||env.VERCEL||env.VERCEL_URL||env.OAZ_ACCOUNTS_RELEASE||env.OAZ_SUPABASE_PROJECT_REF||!web||!api||!gateway||new Set([web,api,gateway]).size!==3||env.NEXT_PUBLIC_OAZ_E2E_RUN_ID!==id)throw Error('E2E_ISOLATION_REQUIRED')
 for(const name of ['NEXT_PUBLIC_SUPABASE_KEY','OAZ_AUTH_ADMIN_KEY','OAZ_ACCOUNTS_SERVICE_JWT','OAZ_LOCAL_SERVICE_ROLE_KEY']){
  try {const value=env[name]!;const claims=JSON.parse(atob(value.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));if(claims.ref!=='oaz-e2e-'+id||claims.role!==(name==='NEXT_PUBLIC_SUPABASE_KEY'?'anon':'service_role'))throw Error()}catch{throw Error('E2E_CREDENTIAL_ISOLATION_REQUIRED')}
 }
 return {web,api,gateway,privatePath:'build/e2e/'+id+'/private'}
}
