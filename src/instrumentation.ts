/** Reject unsafe configuration before the Node server becomes ready. */
export async function register(){
 if(process.env.NEXT_RUNTIME==='nodejs'){
  const {assertRuntimeEnvironment}=await import('./lib/deployment-guard')
  const {removeOfflinePreviewTelemetry}=await import('./lib/offline-preview')
  removeOfflinePreviewTelemetry(process.env)
  const compiled={
   NEXT_PUBLIC_SUPABASE_URL:process.env.NEXT_PUBLIC_SUPABASE_URL,
   NEXT_PUBLIC_SUPABASE_KEY:process.env.NEXT_PUBLIC_SUPABASE_KEY,
   NEXT_PUBLIC_OAZ_DESKTOP_INTEGRATION:process.env.NEXT_PUBLIC_OAZ_DESKTOP_INTEGRATION,
   NEXT_PUBLIC_OAZ_DEPLOYMENT_ENV:process.env.NEXT_PUBLIC_OAZ_DEPLOYMENT_ENV,
   NEXT_PUBLIC_OAZ_PREVIEW_ISOLATED_REF:process.env.NEXT_PUBLIC_OAZ_PREVIEW_ISOLATED_REF,
   NEXT_PUBLIC_OAZ_PREVIEW_MODE:process.env.NEXT_PUBLIC_OAZ_PREVIEW_MODE,
  }
  const runtime=process.env
  try{assertRuntimeEnvironment(compiled,runtime)}catch{
   console.error('SECURITY_STARTUP_REJECTED')
   process.exit(1)
  }
  if(runtime.OAZ_PREVIEW_MODE==='offline-v1'){
   const {offlinePreviewResponse}=await import('./lib/offline-preview')
   // All reviewed backend transports use fetch. No DNS/socket request is made.
   globalThis.fetch=async()=>offlinePreviewResponse()
  }
 }
}
