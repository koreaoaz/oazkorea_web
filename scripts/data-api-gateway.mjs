// Official Data API transport: no DB password, PostgREST child or HMAC secret.
import {createPublicKey,timingSafeEqual,verify} from 'node:crypto';
import {parseGatewayUserToken} from './gateway-jwt-policy.mjs';
import {allowServerRpc,allowAcceptanceRpc} from './security-gateway-policy.mjs';
import {createOfflineGatewayHandler} from './vercel-private-runtime.mjs';
const origin='https://maoefmwpdcnugyenyiea.supabase.co';
const same=(a,b)=>typeof a==='string'&&typeof b==='string'&&a.length===b.length&&timingSafeEqual(Buffer.from(a),Buffer.from(b));
const json=(r,s,v)=>r.writeHead(s,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}).end(JSON.stringify(v));
async function read(response,limit){
 const reader=response.body?.getReader();if(!reader)throw Error();let size=0;const parts=[];
 for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>limit){await reader.cancel();throw Error();}parts.push(value);}
 return Buffer.concat(parts);
}
export function createProviderUserVerifier(request=fetch){
 let cached,expires=0,pending;
 async function keys(){
  if(cached&&Date.now()<expires)return cached;
  if(!pending)pending=(async()=>{
   const r=await request(origin+'/auth/v1/.well-known/jwks.json',{redirect:'error',cache:'no-store',signal:AbortSignal.timeout(5000)});
   if(r.status!==200)throw Error();const data=JSON.parse(await read(r,65536));
   if(!Array.isArray(data.keys)||data.keys.length<1||data.keys.length>8)throw Error();
   const seen=new Set(),result=[];
   for(const k of data.keys){
    if(k.kty!=='EC'||k.alg!=='ES256'||k.crv!=='P-256'||typeof k.kid!=='string'||!k.kid||seen.has(k.kid)||k.d||k.use&&k.use!=='sig'||k.key_ops?.some(op=>op!=='verify'))throw Error();
    seen.add(k.kid);result.push({kid:k.kid,key:createPublicKey({key:k,format:'jwk'})});
   }
   cached=result;expires=Date.now()+300000;return result;
  })().finally(()=>{pending=undefined;});
  return pending;
 }
 return async(token,apiKey)=>{
  const parsed=parseGatewayUserToken(token);if(!parsed)return false;
  try{
   if(parsed.header.alg==='ES256'){
    const key=(await keys()).find(k=>k.kid===parsed.header.kid);
    return !!key&&verify('sha256',parsed.message,{key:key.key,dsaEncoding:'ieee-p1363'},parsed.signature);
   }
   const r=await request(origin+'/auth/v1/user',{method:'GET',headers:{apikey:apiKey,Authorization:'Bearer '+token},redirect:'error',cache:'no-store',signal:AbortSignal.timeout(5000)});
   if(r.status!==200||!/^application\/json(?:;|$)/i.test(r.headers.get('content-type')??'')){await r.body?.cancel();return false;}
   const user=JSON.parse(await read(r,65536));return user?.id===parsed.claims.sub;
  }catch{return false;}
 };
}
export function createDataApiGateway(env=process.env,request=fetch){
 if(env.VERCEL_ENV==='preview'||env.OAZ_RUNTIME_CONTEXT==='preview-disabled'){
  if(env.OAZ_GATEWAY_TRANSPORT)throw Error('PREVIEW_CONNECTION_FORBIDDEN');
  return createOfflineGatewayHandler(env);
 }
 if(env.VERCEL_ENV!=='production'||env.OAZ_RUNTIME_CONTEXT!=='production-reviewed'||env.OAZ_GATEWAY_TRANSPORT!=='data-api-v1'||env.NEXT_PUBLIC_SUPABASE_URL!==origin||!/^sb_publishable_[\w-]+$/.test(env.NEXT_PUBLIC_SUPABASE_KEY??'')||!/^[a-f0-9]{64}$/.test(env.OAZ_ACCOUNTS_GATE_KEY??''))throw Error('DATA_API_CONFIG');
 for(const k of ['OAZ_RUNTIME_DB_URI','OAZ_RUNTIME_JWT_VERIFIER','OAZ_GATEWAY_JWT_POLICY','OAZ_PUBLIC_READER_JWT'])if(env[k])throw Error('LEGACY_GATEWAY_CONFIG_FORBIDDEN');
 const gate=env.OAZ_ACCOUNTS_GATE_KEY,publishable=env.NEXT_PUBLIC_SUPABASE_KEY;
 const service=env.SUPABASE_SECRET_KEY??env.SUPABASE_SERVICE_ROLE_KEY;
 if(!service)throw Error('SERVICE_API_KEY_REQUIRED');
 const userValid=createProviderUserVerifier(request);
 const serviceRoutes=new Set(['accounts_service','password_service','super_recovery_service','enrollment_service','invitation_service']);
 return async(req,res)=>{
  try{
   const server=allowServerRpc(req,gate),acceptance=allowAcceptanceRpc(req,gate);
   const name=req.url?.split('/').at(-1);
   if(!(server||acceptance)||name==='desktop_image_review_access'||req.headers.origin||req.headers['content-type']!=='application/json')return json(res,403,{error:'GATEWAY_DENIED'});
   const bearer=req.headers.authorization?.match(/^Bearer ([A-Za-z0-9._-]{1,8192})$/)?.[1];
   let key=publishable,token;
   // Server API credential lane, never interpreted as a user JWT.
   if(same(bearer,service)){
    if(!acceptance||!serviceRoutes.has(name))return json(res,403,{error:'SERVICE_ROUTE_DENIED'});
    key=service;if(!service.startsWith('sb_secret_'))token=service;
   }else if(same(bearer,publishable)){
    // Supabase maps the publishable apikey to anon, no fabricated JWT.
   }else{
    if(!bearer||!await userValid(bearer,publishable))return json(res,401,{error:'JWT_INVALID'});
    token=bearer;
   }
   const chunks=[];let size=0,limit=name==='mail_review'?180000:65536;
   for await(const p of req){size+=p.length;if(size>limit)return json(res,413,{error:'BODY_LIMIT'});chunks.push(p);}
   let args;try{args=JSON.parse(Buffer.concat(chunks));if(!args||typeof args!=='object'||Array.isArray(args))throw Error();}catch{return json(res,400,{error:'INVALID_JSON'});}
   const headers={'Content-Type':'application/json',apikey:key,'x-oaz-server-gate':gate,'Content-Profile':'public','Accept-Profile':'public'};
   if(token)headers.Authorization='Bearer '+token;
   const storage=server&&name==='oaz_storage_gateway_v1';
   if(storage&&(!token||key!==publishable||Object.keys(args).some(k=>k!=='command')))return json(res,403,{error:'STORAGE_USER_REQUIRED'});
   const r=await request(origin+'/rest/v1/rpc/'+(storage?'oaz_storage_gateway_v1':'oaz_gateway_v1'),{method:'POST',headers,body:JSON.stringify(storage?args:{route:(server?'server':'acceptance')+'/'+name,arguments:args}),redirect:'error',cache:'no-store',signal:AbortSignal.timeout(20000)});
   const raw=await read(r,4*1024*1024);
   if(!/^application\/json(?:;|$)/i.test(r.headers.get('content-type')??''))throw Error();
   const data=JSON.parse(raw);
   if(!r.ok){const code=['42501','PT409','23505','22023'].includes(data?.code)?data.code:'DATA_API_UNAVAILABLE';return json(res,r.status>=400&&r.status<500?r.status:503,{code});}
   return json(res,r.status,data);
  }catch{return json(res,503,{error:'GATEWAY_UNAVAILABLE'});}
 };
}
