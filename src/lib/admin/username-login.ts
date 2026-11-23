/** Provider-independent login boundary. Passwords are never normalized or logged. */
export const LOGIN_NAME = /^[a-z][a-z0-9._-]{3,31}$/
export type LoginIdentity = {slot:string; userId:string; email:string}
export type LoginTokens = {access_token:string; refresh_token:string}
export type UsernameLoginPort = {
 resolve:(username:string)=>Promise<LoginIdentity|null>
 authenticate:(email:string,password:string)=>Promise<LoginTokens|null>
 current:(token:string)=>Promise<{userId:string;slot:string;role:string}|null>
 discard:()=>Promise<void>
}

/** Single-process local guard only. A durable shared limiter is required before production activation. */
export function createLoginLimiter(now:()=>number=Date.now) {
 let start=now(), total=0
 const attempts=new Map<string,number>()
 return (name:string)=>{
  if(now()-start>=15*60*1000){start=now();total=0;attempts.clear()}
  if(++total>60)return false
  const count=(attempts.get(name)??0)+1;attempts.set(name,count)
  return count<=8
 }
}

export async function handleUsernameLogin(request:Request, origin:string|null,
 port:UsernameLoginPort, consume:(name:string)=>boolean) {
 const reply=(status:number,body:unknown)=>Response.json(body,{status,headers:{'Cache-Control':'no-store','Vary':'Origin','X-Content-Type-Options':'nosniff'}})
 const denied=()=>reply(401,{error:'LOGIN_NOT_VERIFIED'})
 if(!origin)return reply(503,{error:'LOGIN_NOT_READY'})
 if(request.method!=='POST')return reply(405,{error:'METHOD_NOT_ALLOWED'})
 if(request.headers.get('origin')!==origin)return reply(403,{error:'ORIGIN_DENIED'})
 if(!request.headers.get('content-type')?.startsWith('application/json'))return reply(415,{error:'JSON_REQUIRED'})
 let signedIn=false
 try{
  const reader=request.body?.getReader();if(!reader)return denied()
  let size=0,text='';const decoder=new TextDecoder('utf-8',{fatal:true})
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>2048){await reader.cancel();return reply(413,{error:'REQUEST_TOO_LARGE'})}text+=decoder.decode(value,{stream:true})}
  const b=JSON.parse(text+decoder.decode())
  if(!b||Array.isArray(b)||typeof b!=='object'||Object.keys(b).some(k=>!['username','password'].includes(k))||
   typeof b.username!=='string'||!LOGIN_NAME.test(b.username)||typeof b.password!=='string'||!b.password||b.password.length>256)return denied()
  if(!consume(b.username))return reply(429,{error:'LOGIN_RETRY_LATER'})
  const identity=await port.resolve(b.username)
  // Unknown names still take the provider password path; no public email lookup endpoint.
  const tokens=await port.authenticate(identity?.email??'unassigned-login@example.invalid',b.password)
  signedIn=!!tokens
  if(!tokens||!identity){if(signedIn)await port.discard();return denied()}
  const current=await port.current(tokens.access_token)
  if(!current||current.userId!==identity.userId||current.slot!==identity.slot||
   !/^admin[1-9][0-9]{0,6}$/.test(current.slot)||current.role!==(current.slot==='admin1'?'SUPER_ADMIN':'ADMIN')){
   await port.discard();return denied()
  }
  // Official Auth tokens only; UI adopts the existing SDK refresh/MFA contract.
  return reply(200,{session:{access_token:tokens.access_token,refresh_token:tokens.refresh_token}})
 }catch{
  if(signedIn){try{await port.discard()}catch{/* Own failed login only; never log tokens. */}}
  return denied()
 }
}
