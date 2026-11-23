// Private PostgREST transport. No Auth emulation, JWT minting or role substitution.
import http from 'node:http';
import {pathToFileURL} from 'node:url';
import {allowServerRpc,allowAcceptanceRpc} from './security-gateway-policy.mjs';

export function createMainGateway({gate,upstream,jwtVerifier},transport=fetch){
 return http.createServer(createMainGatewayHandler({gate,upstream,jwtVerifier},transport));
}
export function createMainGatewayHandler({gate,upstream,jwtVerifier},transport=fetch){
 const target=new URL(upstream);
 if(!/^[a-f0-9]{64}$/.test(gate??'')||target.origin!==upstream||target.hostname!=='127.0.0.1'||target.protocol!=='http:'||!target.port)throw Error('PRIVATE_GATEWAY_CONFIG');
 return (req,res)=>handle(req,res).catch(()=>{if(!res.headersSent)res.writeHead(503,{'Cache-Control':'no-store'});res.end();});
 async function handle(req,res){
  const bridge=allowServerRpc(req,gate),acceptance=allowAcceptanceRpc(req,gate);
  const name=req.url?.slice(req.url.lastIndexOf('/')+1);
  if((!bridge&&!acceptance)||name==='desktop_image_review_access'){res.writeHead(403,{'Cache-Control':'no-store'}).end();return;}
  if(req.headers.origin||!/^Bearer [A-Za-z0-9._-]{20,8192}$/.test(req.headers.authorization??'')||req.headers['content-type']!=='application/json'){res.writeHead(403).end();return;}
  if(jwtVerifier&&!await jwtVerifier(req.headers.authorization.slice(7))){res.writeHead(401,{'Content-Type':'application/json','Cache-Control':'no-store'}).end('{"error":"JWT_INVALID"}');return;}
  const limit=name==='mail_review'?180000:65536;let size=0;const chunks=[];
  for await(const part of req){size+=part.length;if(size>limit){res.writeHead(413).end();return;}chunks.push(part);}
  const schema=bridge?'oaz_server_api':'oaz_acceptance';
  const response=await transport(target.origin+'/rpc/'+name,{method:'POST',headers:{'Content-Type':'application/json','Accept-Profile':schema,'Content-Profile':schema,Authorization:req.headers.authorization},body:Buffer.concat(chunks),redirect:'error',cache:'no-store',signal:AbortSignal.timeout(20000)});
  const reader=response.body?.getReader();let length=0;const output=[];
  if(reader)while(true){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>4*1024*1024){await reader.cancel();throw Error('PRIVATE_RESULT_LIMIT');}output.push(value);}
  res.writeHead(response.status,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}).end(Buffer.concat(output));
 }
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const port=Number(process.env.OAZ_GATEWAY_PORT??8080);
 if(!Number.isInteger(port)||port<1024||port>65535)throw Error('PRIVATE_GATEWAY_PORT');
 const server=createMainGateway({gate:process.env.OAZ_ACCOUNTS_GATE_KEY,upstream:process.env.OAZ_PRIVATE_POSTGREST_URL});
 server.requestTimeout=25000;server.headersTimeout=10000;server.maxHeadersCount=40;
 server.listen(port,'127.0.0.1');
}
