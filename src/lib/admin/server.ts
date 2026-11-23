import 'server-only'
import { serverClient } from './server-client'
import { adminConfiguration } from './protocol'
import { inspectSupabaseConfig } from '../supabaseConfig'
import type { AdminPort } from './http'

export const ADMIN_COOKIE = 'oaz_admin_access'
export function adminPort(token: string): AdminPort {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '', key = process.env.NEXT_PUBLIC_SUPABASE_KEY ?? ''
  if (inspectSupabaseConfig(url,key).some(issue=>issue.severity==='error')) throw new Error('Invalid server configuration')
  const client = serverClient(token)
  return {
    verify:async bearer=>{const {data,error}=await client.auth.getUser(bearer);return !error&&!!data.user},
    execute:async command=>{const {data,error}=await client.rpc('oaz_admin_command_v2',{command});return {data,code:error?(error.code||'TRANSPORT_ERROR'):undefined}},
  }
}
export async function verifiedAdminPage(token?: string) {
  if (!adminConfiguration(process.env) || !token || !/^[A-Za-z0-9._-]{20,8192}$/.test(token)) return null
  try {
    const port=adminPort(token)
    if (!await port.verify(token)) return null
    const result=await port.execute({action:'session',requestId:crypto.randomUUID(),version:0})
    if (result.code || !result.data || typeof result.data!=='object') return null
    return result.data
  } catch { return null }
}
