import 'server-only'
import {createHash,createHmac,timingSafeEqual} from 'node:crypto'
import {adminConfiguration} from './protocol'
import {managedMediaEnabled,mediaUploaderKey} from './media-credentials'
import {MEDIA_BUCKETS} from './media-upload'
import {mediaPort} from './media-server'
import {serverClient} from './server-client'
import {reviewedMainRuntime} from '../security-profile'
import {normalizeDeliveryImage} from './image-normalize'
import {acceptanceRpc} from '../acceptance-rpc'

const stage='oaz-final-image-staging',limit=5*1024*1024
type Ticket={v:1;actor:string;bearer:string;table:string;raw:string;size:number;sha:string;exp:number}
const digest=(x:Uint8Array|string)=>createHash('sha256').update(x).digest('hex')
function key(){const k=process.env.OAZ_ACCOUNTS_GATE_KEY??process.env.OAZ_SECURITY_BRIDGE_KEY;if(!/^[a-zA-Z0-9_]{64}$/.test(k??''))throw Error('CONFIG');return k!}
function seal(t:Ticket){const body=Buffer.from(JSON.stringify(t)).toString('base64url');return body+'.'+createHmac('sha256',key()).update('oaz-direct-image-v1:'+body).digest('base64url')}
function open(value:string):Ticket{
 if(value.length>3000)throw Error('TICKET')
 const [body,sig,...rest]=value.split('.'),expected=createHmac('sha256',key()).update('oaz-direct-image-v1:'+body).digest()
 const actual=Buffer.from(sig??'','base64url');if(rest.length||actual.length!==expected.length||!timingSafeEqual(actual,expected))throw Error('TICKET')
 const t:Ticket=JSON.parse(Buffer.from(body,'base64url').toString())
 if(t.v!==1||!MEDIA_BUCKETS[t.table]||!Number.isSafeInteger(t.exp)||t.exp<=Date.now()/1000||t.exp>Date.now()/1000+601||!Number.isSafeInteger(t.size)||t.size<1||t.size>limit||!/^managed\/[0-9a-f-]{36}\.webp$/.test(t.raw)||!/^[a-f0-9]{64}$/.test(t.sha))throw Error('TICKET')
 return t
}
export async function directMedia(request:Request){
 const reply=(status:number,error:string)=>Response.json({error},{status,headers:{'Cache-Control':'no-store'}})
 const config=adminConfiguration(process.env)
 if(!config||!managedMediaEnabled(process.env))return reply(503,'MEDIA_NOT_READY')
 if(request.headers.get('origin')!==config.origin)return reply(403,'ORIGIN_DENIED')
 const token=request.headers.get('authorization')?.match(/^Bearer ([A-Za-z0-9._-]{20,8192})$/)?.[1]
 if(!token)return reply(401,'AUTH_REQUIRED')
 if(request.headers.get('content-type')!=='application/json')return reply(415,'JSON_REQUIRED')
 try{
  const reader=request.body?.getReader();if(!reader)return reply(400,'REQUEST_REQUIRED')
  let size=0;const chunks:Uint8Array[]=[]
  while(true){const x=await reader.read();if(x.done)break;size+=x.value.length;if(size>4096){await reader.cancel();return reply(413,'REQUEST_LIMIT')}chunks.push(x.value)}
  const body=JSON.parse(Buffer.concat(chunks).toString())
  const port=mediaPort(token),actor=await port.identity()
  if(!actor)return reply(401,'AUTH_EXPIRED')
  const claims=JSON.parse(Buffer.from(token.split('.')[1],'base64url').toString())
  if(claims.sub!==actor.id||(actor.role==='SUPER_ADMIN'&&claims.aal!=='aal2'))return reply(403,'MFA_REQUIRED')
  const ticket=body.action==='finish'?open(String(body.ticket??'')):null
  const table=ticket?.table??body.table,bucket=MEDIA_BUCKETS[table]
  if(!bucket||actor.role!=='SUPER_ADMIN'&&!actor.scopes.includes(table))return reply(403,'CONTENT_SCOPE_DENIED')
  const userStorage=process.env.OAZ_GATEWAY_TRANSPORT==='data-api-v1'&&Boolean(reviewedMainRuntime(process.env))
  const client=serverClient(userStorage?token:await mediaUploaderKey())
  if(body.action==='prepare'){
   if(body.rights!==true||body.mime!=='image/webp'||!Number.isSafeInteger(body.size)||body.size<1||body.size>limit||typeof body.sha!=='string'||!/^[a-f0-9]{64}$/.test(body.sha))return reply(400,'INVALID_IMAGE_REQUEST')
   const raw=`managed/${crypto.randomUUID()}.webp`
   if(!await port.reserve(actor.id,bucket,raw,body.size,true))return reply(403,'CURRENT_SCOPE_DENIED')
   if(userStorage){
    const ticket=seal({v:1,actor:actor.id,bearer:digest(token),table,raw,size:body.size,sha:body.sha,exp:Math.floor(Date.now()/1000)+600})
    return Response.json({ticket,authenticatedPath:raw,expiresIn:600},{headers:{'Cache-Control':'no-store'}})
   }
   const signed=await client.storage.from(stage).createSignedUploadUrl(raw,{upsert:false})
   if(signed.error||!signed.data)return reply(503,'UPLOAD_UNAVAILABLE')
   const url=new URL(signed.data.signedUrl),api=new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!)
   if(url.origin!==api.origin||url.pathname!==`/storage/v1/object/upload/sign/${stage}/${raw}`)return reply(503,'UPLOAD_TARGET_DENIED')
   // Display metadata from the trusted provider response, never authentication.
   // The SDK documents 2h, but self-hosted provider defaults may be shorter.
   const uploadExpiry=JSON.parse(Buffer.from((url.searchParams.get('token')??'').split('.')[1]??'','base64url').toString()).exp
   const remaining=uploadExpiry-Math.floor(Date.now()/1000)
   if(!Number.isSafeInteger(uploadExpiry)||remaining<=0||remaining>7260)return reply(503,'UPLOAD_EXPIRY_UNCONFIRMED')
   return Response.json({ticket:seal({v:1,actor:actor.id,bearer:digest(token),table,raw,size:body.size,sha:body.sha,exp:Math.floor(Date.now()/1000)+600}),signedUrl:url.href,expiresIn:600,finalizeExpiresIn:600,signedUploadExpiresIn:remaining},{headers:{'Cache-Control':'no-store'}})
  }
  if(!ticket||ticket.actor!==actor.id||ticket.bearer!==digest(token))return reply(403,'TICKET_DENIED')
  // Final destination is server-derived and never disclosed by the raw ticket.
  const h=createHmac('sha256',key()).update('oaz-normalized-path-v1:'+ticket.raw).digest('hex')
  const path=`managed/${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}.webp`
  const already=await acceptanceRpc('image_access',{bucket,path:path,preview:true},token)
  if(already)return Response.json({bucket,path:path},{status:201,headers:{'Cache-Control':'no-store'}})
  const downloaded=await client.storage.from(stage).download(ticket.raw)
  if(downloaded.error||!downloaded.data)return reply(409,'UPLOAD_INCOMPLETE')
  if(downloaded.data.size!==ticket.size||downloaded.data.size>limit)return reply(400,'IMAGE_MISMATCH')
  const input=new Uint8Array(await downloaded.data.arrayBuffer())
  if(digest(input)!==ticket.sha)return reply(400,'IMAGE_MISMATCH')
  let bytes:Uint8Array;try{bytes=await normalizeDeliveryImage(input)}catch{return reply(400,'INVALID_IMAGE')}
  // A separate normalized object is the only one eligible for publication.
  if(!await port.reserve(actor.id,bucket,path,bytes.length))return reply(409,'FINALIZE_REVIEW_REQUIRED')
  if(!await port.upload(bucket,path,bytes)||!await port.finish(path))return reply(409,'FINALIZE_REVIEW_REQUIRED')
  return Response.json({bucket,path:path},{status:201,headers:{'Cache-Control':'no-store'}})
 }catch{return reply(400,'UPLOAD_REQUEST_REJECTED')}
}
