import 'server-only'
import {createHash,createHmac,timingSafeEqual} from 'node:crypto'
import {isIP} from 'node:net'
import {reviewedMainRuntime,isDesktopLocalProfile} from './security-profile'
import {publicVisitPath,validStats} from './traffic'

type Env=Readonly<Record<string,string|undefined>>
type RPC=(name:'stats'|'visit'|'check'|'status',args?:Record<string,unknown>)=>Promise<unknown>
export function trafficConfig(env:Env){
 const main=reviewedMainRuntime(env)
 const local=!env.VERCEL_ENV&&isDesktopLocalProfile(env)
 const api=main?.api||(local?env.NEXT_PUBLIC_SUPABASE_URL:null)
 const origin=main?.web||(local?'http://127.0.0.1:3310':null)
 const bridge=env.OAZ_SECURITY_BRIDGE_KEY
 const desktopTraffic=local && !main && !env.VERCEL && !env.OAZ_ACCOUNTS_GATE_KEY &&
   api==='http://127.0.0.1:55341' && env.OAZ_ADMIN_ORIGIN==='http://127.0.0.1:3310' &&
   typeof bridge==='string' && /^[a-f0-9]{64}$/.test(bridge)
 const gate=desktopTraffic?createHmac('sha256',bridge).update('oaz-desktop-traffic-v1').digest('hex'):env.OAZ_ACCOUNTS_GATE_KEY
 const key=env.NEXT_PUBLIC_SUPABASE_KEY
 return api&&origin&&gate&&/^[a-f0-9]{64}$/.test(gate)&&key?{api,origin,gate,key,desktopTraffic}:null
}
export class TrafficError extends Error{
 constructor(readonly status:number,readonly kind:'timeout'|'config_error'|'db_error'='db_error'){super(kind)}
}
export const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store','X-Robots-Tag':'noindex',...(status===429?{'Retry-After':'60'}:{})}})
export function trafficRpc(env:Env,adminToken?:string):RPC{
 return async(name,args={})=>{
  const c=trafficConfig(env)
  if(!c)throw new TrafficError(503,'config_error')
  const timeout=AbortSignal.timeout(4500)
  try{
   if(c.desktopTraffic && name!=='stats' && name!=='visit')throw new TrafficError(503,'config_error')
   const prefix=c.desktopTraffic?'oaz_desktop_traffic_':'oaz_traffic_'
   const res=await fetch(c.api+'/rest/v1/rpc/'+prefix+name+'_v1',{method:'POST',credentials:'omit',redirect:'error',cache:'no-store',signal:timeout,
    headers:{...(name==='status'&&adminToken?{Authorization:'Bearer '+adminToken}:{}),apikey:c.key,'Content-Type':'application/json','x-oaz-server-gate':c.gate},body:JSON.stringify(args)})
   if(!res.ok)throw new TrafficError([409,429].includes(res.status)?res.status:503)
   return name==='check'?null:await res.json()
  }catch(e){if(e instanceof TrafficError)throw e;throw new TrafficError(503,timeout.aborted?'timeout':'db_error')}
 }
}
// Older clients send zero bytes. Node can expose a stream even when it contains none.
// New clients send one fixed marker. Read at most its length; no counters are accepted.
async function validVisitBody(req: Request) {
 const marker = 'visit'
 if (!req.body) return true
 if (Number(req.headers.get('content-length')) > marker.length) return false
 const reader = req.body.getReader()
 let length = 0
 try {
  while (true) {
   const {done, value} = await reader.read()
   if (done) return length === 0 || length === marker.length
   for (const byte of value) {
    if (byte !== marker.charCodeAt(length++)) {
     void reader.cancel().catch(() => {})
     return false
    }
   }
  }
 } finally { reader.releaseLock() }
}
export async function trafficRequest(req:Request,env:Env,rpc=trafficRpc(env)){
 const c=trafficConfig(env)
 if(!c)return reply({error:'UNAVAILABLE'},503)
 try{
  let result:unknown
  if(req.method==='GET')result=await rpc('stats')
  else{
   const h=req.headers
   let ref:URL|null=null
   try{ref=new URL(h.get('referer')??'')}catch{}
   if(h.get('origin')!==c.origin||h.get('sec-fetch-site')!=='same-origin'||ref?.origin!==c.origin||!publicVisitPath(ref.pathname))return reply({error:'ORIGIN_DENIED'},403)
   if(!h.get('user-agent')||/bot\b|crawler|spider|headless|vercel-cron|preview|curl\/|wget\//i.test(h.get('user-agent')!)||
      /prefetch|prerender/i.test([h.get('purpose'),h.get('sec-purpose')].join(' '))||h.has('next-router-prefetch')||h.get('dnt')==='1'||h.get('sec-gpc')==='1')return new Response(null,{status:204})
   const id=h.get('idempotency-key')??'',day=h.get('x-oaz-visit-day')??''
   if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(id)||!await validVisitBody(req))return reply({error:'INVALID_VISIT'},400)
   const ip=h.get('x-vercel-forwarded-for')??''
   const tag=(kind:string,input:string)=>createHmac('sha256',c.gate).update(['oaz-traffic-v1',kind,day,input].join('|')).digest('hex')
   result=await rpc('visit',{day_key:day,browser_tag:tag('browser',id.toLowerCase()),network_tag:tag('rate',env.VERCEL==='1'&&isIP(ip)?ip:'shared')})
  }
  if(!validStats(result))throw new TrafficError(503)
  return reply(result)
 }catch(e){return reply({error:'VISIT_UNAVAILABLE'},e instanceof TrafficError?e.status:503)}
}
export async function dailyCheck(req:Request,env:Env,rpc=trafficRpc(env),log=(entry:object)=>console.info(JSON.stringify(entry))){
 const secret=env.CRON_SECRET
 if(!secret||secret.length<32)return reply({error:'UNAVAILABLE'},503)
 const hash=(s:string)=>createHash('sha256').update(s).digest()
 if(!timingSafeEqual(hash(req.headers.get('authorization')??''),hash('Bearer '+secret)))return reply({error:'UNAUTHORIZED'},401)
 const start=Date.now()
 let outcome='ok'
 try{if(!validStats(await rpc('stats')))throw new TrafficError(503)}catch(e){outcome=e instanceof TrafficError?e.kind:'db_error'}
 const elapsed=Math.min(60000,Math.max(0,Date.now()-start))
 const scheduled=req.headers.get('user-agent')==='vercel-cron/1.0'
 let recorded=true
 try{await rpc('check',{outcome,elapsed,scheduled})}catch{recorded=false}
 log({event:'oaz_daily_db_check',at:new Date().toISOString(),outcome,elapsed,scheduled,recorded})
 return reply({outcome,elapsed,recorded},outcome==='ok'&&recorded?200:503)
}
