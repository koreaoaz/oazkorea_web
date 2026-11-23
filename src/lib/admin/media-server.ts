import 'server-only'
import {normalizeImage} from './image-normalize'
import {serverClient} from './server-client'
import {reviewedMainRuntime} from '../security-profile'
import {mediaUploaderKey} from './media-credentials'
import type {MediaPort} from './media-upload'

export function mediaPort(token:string):MediaPort{
 const final=process.env.OAZ_FINAL_INTEGRATION==='true'||Boolean(reviewedMainRuntime(process.env)),pending=new Map<string,{bucket:string;bytes:Uint8Array}>()
 const userStorage=process.env.OAZ_GATEWAY_TRANSPORT==='data-api-v1'&&Boolean(reviewedMainRuntime(process.env))
 const client=serverClient(token)
 const privileged=async()=>userStorage?client:serverClient(await mediaUploaderKey())

 return {
  identity:async()=>{
   const {data,error}=await client.auth.getUser(token);if(error||!data.user)return null
   const result=await client.rpc('oaz_admin_command_v2',{command:{action:'session',requestId:crypto.randomUUID(),version:0}})
   if(result.error||final&&result.data?.role==='SUPER_ADMIN'&&result.data?.aal!=='aal2')return null
   const scopes:string[]=result.data.scopes??[]
   return {id:data.user.id,role:result.data.role,scopes:result.data.promotion?.manualEdit?[...new Set([...scopes,'editor_0_noti'])]:scopes}
  },
  normalize:normalizeImage,
  reserve:async(actor,bucket,path,size,raw=false)=>{const c=final?client:await privileged();const {data,error}=await c.rpc(final?'oaz_media_reserve_scoped_v1':'oaz_media_reserve_v1',final?{bucket,object_name:path,byte_count:size,rights_confirmed:true}:{actor,bucket,object_name:path,byte_count:size});if(error||data!==true)return false;if(userStorage){const permit=await client.rpc('oaz_storage_gateway_v1',{command:{action:'permit',kind:raw?'raw':'image',path}});return !permit.error&&permit.data===true}return true},
  upload:async(bucket,path,bytes)=>{const c=await privileged();if(final)pending.set(path,{bucket,bytes});const {error}=await c.storage.from(final?'oaz-final-image-staging':bucket).upload(path,bytes,{contentType:'image/webp',upsert:false});if(error&&process.env.NODE_ENV==='development'){const reason=error.message.match(/permission denied for (?:schema|table|function) [a-zA-Z0-9_.]+|new row violates row.level security policy/)?.[0]??'STORAGE_REQUEST';console.warn('[media] 저장 실패',reason,'statusCode' in error?error.statusCode:'unavailable')}return !error},
  finish:async path=>{const c=await privileged();if(final){const saved=pending.get(path);if(!saved)return false;const approved=await client.rpc('oaz_media_approve_scoped_v1',{path});if(approved.error||approved.data!==true)return false;const published=await c.storage.from(saved.bucket).upload(path,saved.bytes,{contentType:'image/webp',upsert:false});pending.delete(path);if(published.error)return false}const {data,error}=await c.rpc(userStorage?'oaz_storage_gateway_v1':'oaz_media_finish_v1',userStorage?{command:{action:'finish',kind:'image',path}}:{path});return !error&&data===true},
 }
}
