import 'server-only'
import {readFile} from 'node:fs/promises'
import {join} from 'node:path'
import {isFinalLocalProfile,localProfile,reviewedMainRuntime} from '../security-profile'

/** Shape/role/expiry preflight only. Supabase still verifies the JWT signature. */
export async function mediaUploaderKey(env:Readonly<Record<string,string|undefined>>=process.env){
 if(reviewedMainRuntime(env)){
  const key=env.OAZ_MEDIA_UPLOADER_JWT??''
  if(!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(key)||key.length>8192)throw Error('MEDIA_KEY_NOT_CONFIGURED')
  try{
   const claims=JSON.parse(Buffer.from(key.split('.')[1],'base64url').toString('utf8'))
   if(claims.role!=='oaz_media_uploader'||!Number.isSafeInteger(claims.exp)||claims.exp<=Date.now()/1000+30)throw Error()
  }catch{throw Error('MEDIA_KEY_NOT_CONFIGURED')}
  return key
 }
 const profile=localProfile(env)
 if(env.OAZ_LOCAL_ADMIN_DEV!=='true'||env.NEXT_PUBLIC_SUPABASE_URL!==profile.api||env.OAZ_ADMIN_ORIGIN!==profile.web)throw Error('LOCAL_MEDIA_REQUIRED')
 return (await readFile(join(process.cwd(),profile.privatePath,'media-uploader.key'),'ascii')).trim()
}

export const managedMediaEnabled=(env:Readonly<Record<string,string|undefined>>)=>Boolean(reviewedMainRuntime(env))||isFinalLocalProfile(env)
export const mediaByteLimit=(env:Readonly<Record<string,string|undefined>>)=>reviewedMainRuntime(env)?4*1024*1024:5*1024*1024
