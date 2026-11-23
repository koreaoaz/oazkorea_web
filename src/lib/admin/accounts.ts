import { adminConfiguration,UUID_PATTERN } from './protocol'
import { CONTENT_TABLES } from './policy'
import type { AdminPort } from './http'
export type AccountPort=AdminPort & {createIdentity:(email:string,password:string,requestId:string)=>Promise<string|null>}
export async function handleAccountCreation(request:Request,env:Readonly<Record<string,string|undefined>>,factory:(token:string)=>AccountPort){
  const config=adminConfiguration(env)
  const local=config&&new URL(config.origin).hostname==='127.0.0.1'
  const reply=(status:number,error?:string)=>Response.json(error?{error}:{ok:true},{status,headers:{'Cache-Control':'no-store'}})
  if(!config||!local||env.OAZ_ADMIN_LOCAL_PROVISIONING!=='true')return reply(503,'LOCAL_PROVISIONING_DISABLED')
  if(request.method!=='POST')return reply(405,'METHOD_NOT_ALLOWED')
  if(request.headers.get('origin')!==config.origin)return reply(403,'ORIGIN_DENIED')
  const bearer=request.headers.get('authorization')?.match(/^Bearer ([A-Za-z0-9._-]{20,8192})$/)?.[1]
  if(!bearer)return reply(401,'AUTH_REQUIRED')
  if(!request.headers.get('content-type')?.startsWith('application/json'))return reply(415,'JSON_REQUIRED')
  try{
    const reader=request.body?.getReader();if(!reader)return reply(400,'INVALID_INPUT')
    let size=0,text='';const decoder=new TextDecoder()
    while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>8192){await reader.cancel();return reply(413,'REQUEST_TOO_LARGE')}text+=decoder.decode(value,{stream:true})}
    text+=decoder.decode();const b=JSON.parse(text)
    if(!b||typeof b!=='object'||Array.isArray(b)||Object.keys(b).some(k=>!['requestId','slot','email','password','displayName','scopes'].includes(k))||
      typeof b.requestId!=='string'||!UUID_PATTERN.test(b.requestId)||typeof b.slot!=='string'||!/^admin[1-9][0-9]{0,6}$/.test(b.slot)||b.slot==='admin1'||
      typeof b.email!=='string'||!/^[-+.\w]+@[-.\w]+\.[A-Za-z]{2,}$/.test(b.email)||b.email.length>254||
      typeof b.password!=='string'||b.password.length<12||b.password.length>128||
      typeof b.displayName!=='string'||!b.displayName.trim()||b.displayName.length>80||
      !Array.isArray(b.scopes)||b.scopes.length>6||new Set(b.scopes).size!==b.scopes.length||b.scopes.some((t:unknown)=>!CONTENT_TABLES.some(a=>a===t)))return reply(400,'INVALID_INPUT')
    const port=factory(bearer);if(!await port.verify(bearer))return reply(401,'AUTH_EXPIRED')
    if(env.OAZ_FINAL_INTEGRATION==='true'&&!b.email.endsWith('@example.invalid'))return reply(400,'SYNTHETIC_ACCOUNT_REQUIRED')
    const session=await port.execute({action:'session',requestId:crypto.randomUUID(),version:0})
    if(session.code||!session.data||typeof session.data!=='object'||!('version' in session.data)||typeof session.data.version!=='number')return reply(403,'FORBIDDEN')
    const version=session.data.version
    // DB checks current actor, AAL2 and slot under its lock BEFORE Auth Admin API.
    const prepare=await port.execute({action:'accounts.prepare',requestId:b.requestId,version,slot:b.slot})
    if(prepare.code)return reply(prepare.code==='42501'?403:409,'PROVISIONING_DENIED')
    if(prepare.data&&typeof prepare.data==='object'&&'status' in prepare.data&&prepare.data.status==='completed')return reply(201)
    const userId=await port.createIdentity(b.email,b.password,b.requestId)
    if(!userId)return reply(409,'PROVISIONING_REVIEW_REQUIRED')
    const complete=await port.execute({action:'accounts.complete',requestId:crypto.randomUUID(),operationId:b.requestId,version,slot:b.slot,userId,
      displayName:b.displayName.trim(),scopes:b.scopes,status:'active',revision:0})
    if(complete.code)return reply(409,'PROVISIONING_REVIEW_REQUIRED')
    return reply(201)
  }catch{return reply(503,'ACCOUNT_UNAVAILABLE')}
}
