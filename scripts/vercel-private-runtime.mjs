// One disposable Vercel container: private PostgREST + unchanged JWT gateway.
// No DB bootstrap, migrations, credential files, token minting or secret logging.
import {spawn} from 'node:child_process';
import {createServer} from 'node:http';
import {pathToFileURL} from 'node:url';
import {createMainGateway} from './main-private-gateway.mjs';
import {createGatewayJwtVerifier,createGatewayRequestVerifier} from './gateway-jwt-policy.mjs';

export function runtimeConfig(env) {
  if(env.VERCEL_ENV==='preview'||env.OAZ_RUNTIME_CONTEXT==='preview-disabled') {
    if(env.VERCEL_ENV!=='preview'||env.OAZ_RUNTIME_CONTEXT!=='preview-disabled'||env.OAZ_PREVIEW_MODE!=='offline-v1')throw Error('PREVIEW_CONTEXT_REQUIRED');
    for(const [name,value] of Object.entries(env)){
      if(!value)continue;
      if(/(?:^|_)(?:SUPABASE|POSTGRES|POSTGRESQL|DATABASE|DB)(?:_|$)|^PG(?:HOST|HOSTADDR|PORT|USER|PASSWORD|DATABASE|SERVICE|SERVICEFILE|PASSFILE)$|^OAZ_(?:ACCOUNTS|AUTH|ADMIN|RUNTIME_DB|RUNTIME_JWT|SECURITY|MEDIA|IMAGE|PUBLIC_READER|GATEWAY_JWT)/.test(name)){
        if(name==='NEXT_PUBLIC_SUPABASE_URL'&&value==='https://offline.invalid')continue;
        if(name==='NEXT_PUBLIC_SUPABASE_KEY'&&value==='sb_publishable_offline_fixture')continue;
        throw Error('PREVIEW_CONNECTION_FORBIDDEN');
      }
    }
    const port=Number(env.PORT??8080);
    if(!Number.isInteger(port)||port<1024||port>65535)throw Error('RUNTIME_PORT');
    return {preview:true,port};
  }
  let db;
  try { db=new URL(env.OAZ_RUNTIME_DB_URI); } catch { throw Error('RUNTIME_DB_CONFIG'); }
  const context=env.OAZ_RUNTIME_CONTEXT;
  if(db.protocol!=='postgresql:'||db.pathname!=='/postgres'||!db.password||db.hash)throw Error('RUNTIME_DB_CONFIG');
  if(context==='synthetic') {
    if(!/^oaz-runtime-db-[a-f0-9]{12}$/.test(db.hostname)||db.username!=='authenticator'||db.port!=='5432'||db.search)throw Error('SYNTHETIC_TARGET_REQUIRED');
  } else if(context==='production-reviewed') {
    const ref='maoefmwpdcnugyenyiea';
    const direct=db.hostname===`db.${ref}.supabase.co`&&db.username==='authenticator';
    const pooler=/^aws-[0-9]+-[a-z0-9-]+\.pooler\.supabase\.com$/.test(db.hostname)&&db.username===`authenticator.${ref}`;
    if(!(direct||pooler)||db.port!=='5432'||db.searchParams.get('sslmode')!=='verify-full'||[...db.searchParams.keys()].some(k=>k!=='sslmode'))throw Error('PRODUCTION_TLS_TARGET_REQUIRED');
  } else throw Error('RUNTIME_CONTEXT_REQUIRED');
  const gate=env.OAZ_ACCOUNTS_GATE_KEY, jwt=env.OAZ_RUNTIME_JWT_VERIFIER;
  if(!/^[a-f0-9]{64}$/.test(gate??'')||typeof jwt!=='string'||jwt.length<32)throw Error('RUNTIME_AUTH_CONFIG');
  const port=Number(env.PORT??8080);
  if(!Number.isInteger(port)||port<1024||port>65535||[3000,3001].includes(port))throw Error('RUNTIME_PORT');
  const jwtVerifier=context==='production-reviewed'||env.OAZ_GATEWAY_JWT_POLICY?createGatewayJwtVerifier(env):undefined;
  const requestVerifier=context==='production-reviewed'?createGatewayRequestVerifier(env,jwtVerifier):undefined;
  return {port,gate,jwtVerifier,requestVerifier,restEnv:{PATH:process.env.PATH,
    PGRST_DB_URI:env.OAZ_RUNTIME_DB_URI,PGRST_JWT_SECRET:jwt,PGSSLROOTCERT:'/etc/ssl/cert.pem',
    PGRST_DB_SCHEMAS:'oaz_server_api,oaz_acceptance',PGRST_DB_ANON_ROLE:'anon',
    PGRST_DB_CONFIG:'false',PGRST_DB_POOL:'2',PGRST_DB_MAX_ROWS:'1000',
    PGRST_DB_PREPARED_STATEMENTS:'false',PGRST_SERVER_HOST:'127.0.0.1',
    PGRST_SERVER_PORT:'3000',PGRST_ADMIN_SERVER_PORT:'3001',PGRST_LOG_LEVEL:'error'}};
}

export function createOfflineGatewayHandler(env=process.env) {
  if(!runtimeConfig(env).preview)throw Error('OFFLINE_GATEWAY_PREVIEW_ONLY');
  return (req,res)=>{
    const health=req.method==='GET'&&req.url==='/healthz';
    res.writeHead(health?200:503,{'Content-Type':'application/json','Cache-Control':'no-store'});
    res.end(JSON.stringify(health?{mode:'offline-v1',database:false,postgrest:false}:{error:'PREVIEW_BACKEND_DISABLED'}));
  };
}

export async function runRuntime(env=process.env) {
  const c=runtimeConfig(env);
  if(c.preview){
    const server=createServer(createOfflineGatewayHandler(env));
    server.listen(c.port,'0.0.0.0');
    for(const signal of ['SIGTERM','SIGINT'])process.once(signal,()=>server.close());
    return server;
  }
  const child=spawn('/usr/local/bin/postgrest',[],{env:c.restEnv,stdio:['ignore','ignore','pipe']});
  child.stderr.on('data',chunk=>{
    const text=chunk.toString();
    const codes=[...new Set(text.match(/\bPGRST[0-9]{3}\b/g)??[])];
    for(const code of codes)console.error(code);
    for(const [needle,code] of [['Connection refused','DB_CONNECTION_REFUSED'],['could not translate host','DB_DNS_FAILED'],['password authentication failed','DB_AUTH_FAILED'],['permission denied','DB_PERMISSION_DENIED']])if(text.includes(needle))console.error(code);
  });
  let failed=false,stopping=false,server;
  const stop=(code)=>{
    if(stopping)return;stopping=true;process.exitCode=code;
    server?.close(); child.kill('SIGTERM');
    setTimeout(()=>{child.kill('SIGKILL');process.exit(code);},1500).unref();
  };
  child.on('error',()=>{failed=true;stop(1);});
  child.on('exit',()=>{failed=true;if(!stopping)stop(1);});
  process.once('SIGTERM',()=>stop(0));process.once('SIGINT',()=>stop(0));
  for(let n=0;n<100&&!failed;n++) {
    try {
      const ready=await fetch('http://127.0.0.1:3001/ready',{signal:AbortSignal.timeout(500)});
      await ready.body?.cancel();
      if(ready.ok){
        server=createMainGateway({gate:c.gate,upstream:'http://127.0.0.1:3000',jwtVerifier:c.requestVerifier??c.jwtVerifier});
        server.requestTimeout=25000;server.headersTimeout=10000;server.maxHeadersCount=40;
        server.on('error',()=>stop(1));server.listen(c.port,'0.0.0.0');
        return;
      }
    } catch { /* Only a safe category is emitted at final startup failure. */ }
    await new Promise(resolve=>setTimeout(resolve,200));
  }
  console.error('RUNTIME_START_FAILED');stop(1);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  runRuntime().catch(()=>{console.error('RUNTIME_CONFIG_FAILED');process.exitCode=1;});
}
