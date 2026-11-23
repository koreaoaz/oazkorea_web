import test from 'node:test'
import assert from 'node:assert/strict'
import * as crypto from 'node:crypto'
import * as net from 'node:net'
import {loadSource} from './helpers/react-dom.mjs'
const env={VERCEL:'1',GATE:'',NEXT_PUBLIC_SUPABASE_KEY:'fixture',OAZ_ACCOUNTS_GATE_KEY:'a'.repeat(64),CRON_SECRET:'b'.repeat(32)}
const origin='https://example.invalid'
const {trafficRequest,dailyCheck,TrafficError}=loadSource('src/lib/traffic-server.ts',{
  'server-only':{}, 'node:crypto':crypto, 'node:net':net,
  './security-profile':{reviewedMainRuntime:()=>({api:'https://fixture.invalid',web:origin}),isDesktopLocalProfile:()=>false},
},{Response,URL,AbortSignal})
const {scheduledCheckLate}=loadSource('src/lib/traffic.ts')
const stats={day:'2026-11-24',today:0,total:0,refreshMs:3000}
const id=crypto.randomUUID()
const headers={'user-agent':'Chrome/148','sec-fetch-site':'same-origin',origin,referer:origin+'/studies/records','idempotency-key':id,'x-oaz-visit-day':stats.day,'x-vercel-forwarded-for':'192.0.2.1'}
const post=(changes={},body)=>new Request(origin+'/api/traffic',{method:'POST',headers:{...headers,...changes},body})
test('public reads are read only and zero requires a successful database response',async()=>{
  const get=new Request(origin+'/api/traffic')
  const res=await trafficRequest(get,env,async name=>{assert.equal(name,'stats');return stats})
  assert.deepEqual(await res.json(),stats)
  for(const value of [null,{...stats,today:-1}])assert.equal((await trafficRequest(get,env,async()=>value)).status,503)
})
test('visible visit sends keyed daily tags only',async()=>{
 let first
 const visit=async(name,args)=>{assert.equal(name,'visit');assert.deepEqual(Object.keys(args).sort(),['browser_tag','day_key','network_tag']);assert.match(args.browser_tag,/^[a-f0-9]{64}$/);assert.notEqual(args.network_tag,args.browser_tag);if(first)assert.equal(first,args.browser_tag);first=args.browser_tag;return stats}
 assert.equal((await trafficRequest(post(),env,visit)).status,200)
 assert.equal((await trafficRequest(post({},'visit'),env,visit)).status,200)
 const emptyStream=new ReadableStream({start(box){box.close()}})
 const nodeRequest=new Request(origin+'/api/traffic',{method:'POST',headers,body:emptyStream,duplex:'half'})
 assert.ok(nodeRequest.body)
 assert.equal((await trafficRequest(nodeRequest,env,visit)).status,200)
})
test('invalid origin, private paths, malformed input, bot, privacy and prefetch never reach the DB',async()=>{
 let calls=0
 const rpc=async()=>{calls++;return stats}
 for(const [h,code] of [[{origin:'https://other.invalid'},403],[{referer:origin+'/admin'},403],[{'idempotency-key':'broken'},400],[{'sec-purpose':'prefetch;prerender'},204],[{'user-agent':'Googlebot'},204],[{'sec-gpc':'1'},204],[{dnt:'1'},204]])assert.equal((await trafficRequest(post(h),env,rpc)).status,code)
 assert.equal((await trafficRequest(post({},'{"n":123}'),env,rpc)).status,400)
 assert.equal(calls,0)
 assert.equal((await trafficRequest(post(),env,async()=>{throw new TrafficError(429)})).headers.get('retry-after'),'60')
})
test('cron fails closed without credentials and never touches visitor writes',async()=>{
 let calls=0
 for(const [secret,authorization,code] of [['','',503],[env.CRON_SECRET,'wrong',401]]){
  const res=await dailyCheck(new Request(origin,{headers:{authorization}}),{...env,CRON_SECRET:secret},async()=>{calls++})
  assert.equal(res.status,code)
 }
 assert.equal(calls,0)
 for(const [error,expected] of [[null,200],['timeout',503],['db_error',503]]){
   const names=[],logs=[]
   const response=await dailyCheck(new Request(origin,{headers:{authorization:'Bearer '+env.CRON_SECRET,'user-agent':'vercel-cron/1.0'}}),env,async(name,args)=>{
    names.push(name)
    if(name==='stats'){if(error)throw new TrafficError(503,error);return stats}
    assert.equal(args.scheduled,true);if(error==='db_error')throw Error()
   },e=>logs.push(e))
   assert.deepEqual(names,['stats','check']);assert.equal(response.status,expected);assert.equal(logs[0].recorded,error!=='db_error')
   assert.equal(logs[0].outcome,error??'ok')
 }
})
test('missed schedule uses the Hobby delivery window, independent of a manual success',()=>{
 const start='2026-11-22T00:00:00Z',last='2026-11-23T00:46:00Z'
 assert.equal(scheduledCheckLate(last,start,Date.parse('2026-11-24T00:59:59Z')),false)
 assert.equal(scheduledCheckLate(last,start,Date.parse('2026-11-24T01:06:00Z')),true)
 assert.equal(scheduledCheckLate(null,'2026-11-24T02:00:00Z',Date.parse('2026-11-24T04:00:00Z')),false)
})

test('desktop visit gate is limited to the owned loopback pairing and the two visit RPCs',async()=>{
 const local={OAZ_DESKTOP_DEV:'true',OAZ_DESKTOP_INTEGRATION:'owned-v1',OAZ_SECURITY_BRIDGE:'true',
  OAZ_FINAL_ACCEPTANCE:'true',OAZ_FINAL_INTEGRATION:'true',OAZ_LOCAL_ADMIN_DEV:'true',OAZ_ADMIN_VERIFY_STACK:'true',
  OAZ_ADMIN_ORIGIN:'http://127.0.0.1:3310',NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:55341',
  NEXT_PUBLIC_SUPABASE_KEY:'fixture',OAZ_SECURITY_BRIDGE_KEY:'c'.repeat(64)}
 const urls=[]
 const {trafficConfig,trafficRpc}=loadSource('src/lib/traffic-server.ts',{
  'server-only':{},'node:crypto':crypto,'node:net':net,
 },{URL,Response,AbortSignal,fetch:async url=>{urls.push(url);return Response.json(stats)}})
 assert.equal(trafficConfig(local).desktopTraffic,true)
 assert.notEqual(trafficConfig(local).gate,local.OAZ_SECURITY_BRIDGE_KEY)
 for(const changes of [{VERCEL:'1'},{VERCEL_ENV:'preview'},{NEXT_PUBLIC_SUPABASE_URL:'https://remote.invalid'},
   {OAZ_ADMIN_ORIGIN:'http://127.0.0.1:3304'},{OAZ_SECURITY_BRIDGE_KEY:'bad'}]){
  assert.equal(trafficConfig({...local,...changes}),null)
 }
 const rpc=trafficRpc(local)
 await rpc('stats');await rpc('visit',{})
 await assert.rejects(rpc('status'));await assert.rejects(rpc('check'))
 assert.deepEqual(urls,['stats','visit'].map(n=>local.NEXT_PUBLIC_SUPABASE_URL+'/rest/v1/rpc/oaz_desktop_traffic_'+n+'_v1'))
})
