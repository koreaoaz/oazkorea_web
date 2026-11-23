import 'server-only'
import {credentialsConfiguration} from '@/lib/admin/credentials-server'
import {rolePasswordEnabled} from '@/lib/admin/role-password-policy'

export async function POST(request: Request) {
  const config=credentialsConfiguration()
  const reply=(value:unknown,status:number)=>Response.json(value,{status,headers:{'Cache-Control':'no-store'}})
  if (!config || !rolePasswordEnabled() || request.headers.get('origin')!==config.origin) return reply({error:'ORIGIN_DENIED'},403)
  const authorization=request.headers.get('authorization')
  if (!authorization?.match(/^Bearer [A-Za-z0-9._-]{20,8192}$/)) return reply({error:'AUTH_REQUIRED'},401)
  const operation=request.headers.get('x-oaz-clock')
  if (operation!=='status' && operation!=='extend') return reply({error:'INVALID_OPERATION'},400)
  try {
    const r=await fetch(config.api+'/rest/v1/rpc/oaz_admin_clock_v1',{
      method:'POST',redirect:'error',cache:'no-store',signal:AbortSignal.timeout(10000),
      headers:{authorization,apikey:config.key,'Content-Type':'application/json','x-oaz-server-gate':config.gate},
      body:JSON.stringify({operation})
    })
    if (!r.ok) return reply({error:r.status===403?'ACCESS_DENIED':r.status===401?'AUTH_REQUIRED':'CLOCK_UNAVAILABLE'},[401,403].includes(r.status)?r.status:503)
    const result=await r.json()
    if (!['active','expired'].includes(result?.state)||!Number.isFinite(Date.parse(result.expiresAt))||
        !Number.isFinite(Date.parse(result.serverNow))||typeof result.sessionId!=='string') return reply({error:'CLOCK_UNAVAILABLE'},503)
    return reply(result,200)
  } catch {return reply({error:'CLOCK_UNAVAILABLE'},503)}
}
