/** Public build-time presentation selector; never an authorization decision. */
export function mainPresentation(){
 return process.env.NEXT_PUBLIC_OAZ_MAIN_RELEASE==='reviewed-v1'&&process.env.NEXT_PUBLIC_SUPABASE_URL==='https://maoefmwpdcnugyenyiea.supabase.co'
}
export const presentationMediaLimit=()=>mainPresentation()?4*1024*1024:5*1024*1024
