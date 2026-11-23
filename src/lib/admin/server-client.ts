import 'server-only'
import {createClient} from '@supabase/supabase-js'
import {securityBridgeFetch} from '../security-bridge'
export function serverClient(token?:string){
 return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_KEY!,{
  auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
  global:{fetch:securityBridgeFetch(),...(token?{headers:{Authorization:`Bearer ${token}`}}:{})},
 })
}
