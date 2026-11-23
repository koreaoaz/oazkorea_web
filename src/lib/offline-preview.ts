/** No backend exists in this Preview. Never use this profile for functional Auth tests. */
export const PREVIEW_MODE='offline-v1'
export const PREVIEW_URL='https://offline.invalid'
export const PREVIEW_KEY='sb_publishable_offline_fixture'
/** Vercel's Next builder prefixes documented deployment/Git metadata after API
 * env resolution. Offline Preview needs none of it. Remove an exact list, never
 * a wildcard NEXT_PUBLIC_* and never backend credentials. */
export function removeOfflinePreviewTelemetry(env:Record<string,string|undefined>){
 if(env.VERCEL==='1'&&env.VERCEL_ENV==='preview'&&env.OAZ_PREVIEW_MODE===PREVIEW_MODE){
  const metadata=['ENV','TARGET_ENV','URL','BRANCH_URL','PROJECT_PRODUCTION_URL','DEPLOYMENT_ID','PROJECT_ID',
   'GIT_PROVIDER','GIT_REPO_SLUG','GIT_REPO_OWNER','GIT_REPO_ID','GIT_COMMIT_REF','GIT_COMMIT_SHA',
   'GIT_COMMIT_MESSAGE','GIT_COMMIT_AUTHOR_LOGIN','GIT_COMMIT_AUTHOR_NAME','GIT_PREVIOUS_SHA','GIT_PULL_REQUEST_ID',
   'OBSERVABILITY_CLIENT_CONFIG']
  for(const name of metadata)delete env['NEXT_PUBLIC_VERCEL_'+name]
 }
}
export function offlinePreviewResponse(){
 return new Response(JSON.stringify({error:'PREVIEW_BACKEND_DISABLED'}),{status:503,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}})
}
export function previewPathBlocked(path:string){
 return /^\/(?:api|admin|editor|signin|login_callback|oauth_callback|server-rpc|acceptance-rpc)(?:\/|$)/.test(path)
}
export function assertOfflinePreview(env:Readonly<Record<string,string|undefined>>){
 const stop=()=>{throw Error('SECURITY_CONFIGURATION:OFFLINE_PREVIEW_CONNECTION')}
 if(env.VERCEL_ENV!=='preview'||env.OAZ_PREVIEW_MODE!==PREVIEW_MODE||env.NEXT_PUBLIC_SUPABASE_URL!==PREVIEW_URL||env.NEXT_PUBLIC_SUPABASE_KEY!==PREVIEW_KEY)stop()
 if(env.OAZ_RUNTIME_CONTEXT&&env.OAZ_RUNTIME_CONTEXT!=='preview-disabled')stop()
 if(env.OAZ_PDF_VALIDATOR_KEY&&!/^[a-f0-9]{64}$/.test(env.OAZ_PDF_VALIDATOR_KEY))stop()
 const allowed=new Set(['OAZ_PREVIEW_MODE','OAZ_RUNTIME_CONTEXT','OAZ_PDF_VALIDATOR_KEY','NEXT_PUBLIC_OAZ_PREVIEW_MODE','NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_KEY','NEXT_PUBLIC_OAZ_DEPLOYMENT_ENV'])
 for(const [name,value] of Object.entries(env)){
  if(!value||allowed.has(name))continue
  if(/^(?:OAZ_|NEXT_PUBLIC_|SUPABASE_|POSTGRES_|PG(?:HOST|HOSTADDR|PORT|USER|PASSWORD|DATABASE|SERVICE|SERVICEFILE|PASSFILE)$)|(?:^|_)(?:DATABASE|DB)(?:_|$)/.test(name)){
   throw Error('SECURITY_CONFIGURATION:OFFLINE_PREVIEW_CONNECTION:UNEXPECTED_ENV_NAME:'+name.replace(/[^A-Z0-9_]/g,'').slice(0,96))
  }
 }
 return 'OFFLINE_PREVIEW_NO_BACKEND'
}
