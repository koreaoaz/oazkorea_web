// Fixed issuer and algorithm/key-type binding. No remote key URLs, token minting,
// claim rewriting or authentication fallback. PostgREST verifies the same JWT again.
import {createPublicKey,createHmac,timingSafeEqual,verify} from 'node:crypto';
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const fail=()=>{throw Error('JWT_POLICY_CONFIG');};
function bytes(s){
 if(typeof s!=='string'||!s||!/^[A-Za-z0-9_-]+$/.test(s))throw Error();
 const b=Buffer.from(s,'base64url');if(b.toString('base64url')!==s)throw Error();return b;
}
function object(s){
 const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes(s));
 const value=JSON.parse(text);if(!value||typeof value!=='object'||Array.isArray(value))throw Error();
 // Reject duplicate (including escaped) member names before two parsers can
 // disagree about a signed claim. JSON.parse above validates the grammar.
 const stack=[];
 for(const t of text.match(/"(?:\\.|[^"\\])*"|[{}\[\],:]|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null/g)??[]){
  if(t==='{'||t==='['){stack.push(t==='{'?{keys:new Set(),key:true}:null);if(stack.length>32)throw Error();}
  else if(t==='}'||t===']')stack.pop();
  else if(t===','&&stack.at(-1))stack.at(-1).key=true;
  else if(t.startsWith('"')&&stack.at(-1)?.key){const k=JSON.parse(t),o=stack.at(-1);if(o.keys.has(k))throw Error();o.keys.add(k);o.key=false;}
 }
 return value;
}
// Parsing is only a prerequisite, never an authorization decision.
export function parseGatewayUserToken(token,now=Math.floor(Date.now()/1000)){
 try{
  if(typeof token!=='string'||token.length>8192)throw Error();
  const parts=token.split('.');if(parts.length!==3)throw Error();
  const header=object(parts[0]),claims=object(parts[1]),signature=bytes(parts[2]);
  if(!['ES256','HS256'].includes(header.alg)||(header.typ!==undefined&&header.typ!=='JWT')||['jku','jwk','x5u','x5c','crit','b64'].some(k=>k in header))throw Error();
  if(header.kid!==undefined&&(typeof header.kid!=='string'||!header.kid||header.kid.length>200))throw Error();
  if(header.alg==='ES256'&&(!header.kid||signature.length!==64)||header.alg==='HS256'&&signature.length!==32)throw Error();
  if(claims.iss!=='https://maoefmwpdcnugyenyiea.supabase.co/auth/v1'||claims.role!=='authenticated'||!(claims.aud==='authenticated'||Array.isArray(claims.aud)&&claims.aud.length===1&&claims.aud[0]==='authenticated')||!uuid.test(claims.sub??'')||!uuid.test(claims.session_id??''))throw Error();
  if(!Number.isSafeInteger(claims.iat)||!Number.isSafeInteger(claims.exp)||claims.exp<=now||claims.iat>now+30||claims.exp<=claims.iat||claims.nbf!==undefined&&(!Number.isSafeInteger(claims.nbf)||claims.nbf>now+30||claims.nbf>=claims.exp))throw Error();
  return {header,claims,signature,message:Buffer.from(parts[0]+'.'+parts[1])};
 }catch{return null;}
}
export function createGatewayJwtVerifier(env){
 if(env.OAZ_GATEWAY_JWT_POLICY!=='main-v1')fail();
 const production=env.OAZ_RUNTIME_CONTEXT==='production-reviewed';
 if(!production&&env.OAZ_RUNTIME_CONTEXT!=='synthetic')fail();
 const ref=production?'maoefmwpdcnugyenyiea':'synthetic';
 const issuer=production?`https://${ref}.supabase.co/auth/v1`:'https://synthetic.invalid/auth/v1';
 let jwks;try{jwks=JSON.parse(env.OAZ_RUNTIME_JWT_VERIFIER);}catch{fail();}
 if(!Array.isArray(jwks?.keys)||jwks.keys.length<2||jwks.keys.length>8)fail();
 const keys=[],ids=new Set();
 for(const k of jwks.keys){
  if(!k||typeof k!=='object'||(k.use!==undefined&&k.use!=='sig')||k.d||k.key_ops?.some(x=>x!=='verify'))fail();
  if(k.kid!==undefined){if(typeof k.kid!=='string'||!k.kid||k.kid.length>200||ids.has(k.kid))fail();ids.add(k.kid);}
  try{
   if(k.kty==='EC'&&k.alg==='ES256'&&k.crv==='P-256'&&k.kid&&bytes(k.x).length===32&&bytes(k.y).length===32){
    keys.push({alg:'ES256',kid:k.kid,key:createPublicKey({key:k,format:'jwk'})});
   }else if(k.kty==='oct'&&k.alg==='HS256'&&bytes(k.k).length>=32){keys.push({alg:'HS256',kid:k.kid,key:bytes(k.k)});}
   else fail();
  }catch{fail();}
 }
 if(!keys.some(k=>k.alg==='ES256')||keys.filter(k=>k.alg==='HS256').length!==1)fail();
 return (token,now=Math.floor(Date.now()/1000))=>{
  try{
   if(typeof token!=='string'||token.length>8192) return false;
   const parts=token.split('.');if(parts.length!==3)return false;
   const h=object(parts[0]),p=object(parts[1]),sig=bytes(parts[2]);
   if(!['ES256','HS256'].includes(h.alg)||(h.typ!==undefined&&h.typ!=='JWT')||['jku','jwk','x5u','x5c','crit','b64'].some(k=>k in h))return false;
   if(h.kid!==undefined&&(typeof h.kid!=='string'||!h.kid||h.kid.length>200))return false;
   // A kid-less legacy HMAC token can select only the sole HMAC key, never EC.
   const matches=keys.filter(k=>k.alg===h.alg&&(h.kid===undefined?h.alg==='HS256':k.kid===h.kid));
   if(matches.length!==1)return false;
   const k=matches[0],msg=Buffer.from(parts[0]+'.'+parts[1]);
   if(h.alg==='ES256'){
    if(sig.length!==64||!verify('sha256',msg,{key:k.key,dsaEncoding:'ieee-p1363'},sig))return false;
   }else{const expected=createHmac('sha256',k.key).update(msg).digest();if(sig.length!==expected.length||!timingSafeEqual(sig,expected))return false;}
   if(!Number.isSafeInteger(p.exp)||!Number.isSafeInteger(p.iat)||p.exp<=now||p.iat>now+30||p.exp<=p.iat)return false;
   if(p.nbf!==undefined&&(!Number.isSafeInteger(p.nbf)||p.nbf>now+30||p.nbf>=p.exp))return false;
   if(p.role==='authenticated'){
    return p.iss===issuer&&(p.aud==='authenticated'||(Array.isArray(p.aud)&&p.aud.length===1&&p.aud[0]==='authenticated'))&&uuid.test(p.sub??'')&&uuid.test(p.session_id??'');
   }
   // Supabase legacy anon/service keys: no user identity/audience. Service key
   // remains privileged and server-only; RPC ACLs remain a separate requirement.
   return h.alg==='HS256'&&['anon','service_role'].includes(p.role)&&p.iss==='supabase'&&p.ref===ref&&p.aud===undefined&&p.sub===undefined&&p.session_id===undefined;
  }catch{return false;}
 };
}

// HS256 user tokens additionally use the official Auth validation endpoint.
// This does not replace PostgREST verification or validate anon/service API keys.
export function createGatewayRequestVerifier(env,signatureVerifier,request=fetch){
 if(env.OAZ_RUNTIME_CONTEXT!=='production-reviewed')fail();
 const apiKey=env.NEXT_PUBLIC_SUPABASE_KEY;
 if(typeof apiKey!=='string'||!/^sb_publishable_[A-Za-z0-9_-]{1,480}$/.test(apiKey))fail();
 return async token=>{
  if(!signatureVerifier(token))return false;
  try{
   const parts=token.split('.'),header=object(parts[0]),claims=object(parts[1]);
   if(header.alg!=='HS256'||claims.role!=='authenticated')return true;
   const response=await request('https://maoefmwpdcnugyenyiea.supabase.co/auth/v1/user',{
    method:'GET',headers:{apikey:apiKey,Authorization:'Bearer '+token},
    redirect:'error',cache:'no-store',signal:AbortSignal.timeout(5000)
   });
   if(response.status!==200||!/^application\/json(?:;|$)/i.test(response.headers.get('content-type')??'')){
    await response.body?.cancel();return false;
   }
   const reader=response.body?.getReader();if(!reader)return false;
   const chunks=[];let length=0;
   for(;;){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>65536){await reader.cancel();return false;}chunks.push(value);}
   const user=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks)));
   // Never return/store the Auth response, email, metadata or access token.
   return user?.id===claims.sub;
  }catch{return false;}
 };
}
