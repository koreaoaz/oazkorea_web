import 'server-only'
import {cookies} from 'next/headers'
import {NextResponse} from 'next/server'
import {credentialsAuth,credentialsConfiguration} from '@/lib/admin/credentials-server'
import {rolePasswordEnabled} from '@/lib/admin/role-password-policy'
import {REFRESH_COOKIE,boundedJSON,passwordIdentity,sessionResponse,clearPasswordCookies,setRefreshCookie} from '@/lib/admin/password-session-server'
export const dynamic='force-dynamic'

function allowed(request:Request){return rolePasswordEnabled() && request.headers.get('origin')===credentialsConfiguration()?.origin}
function failure(status:number) {
  return NextResponse.json({error:status===401?'AUTH_REQUIRED':status===403?'ORIGIN_DENIED':status===400?'INVALID_INPUT':'AUTH_UNAVAILABLE'},
    {status,headers:{'Cache-Control':'no-store'}})
}
function invalidRefresh(error:{code?:string;status?:number}|null) {
  return !!error && ['refresh_token_not_found','refresh_token_already_used','session_not_found','session_expired','user_banned','user_not_found','invalid_grant'].includes(error.code??'')
}
export async function POST(request:Request){
  if(!allowed(request))return failure(403)
  let supplied:unknown
  try {
    const body=await boundedJSON(request)
    if(Object.keys(body).some(k=>k!=='refreshToken'))return failure(400)
    supplied=body.refreshToken
  } catch {return failure(400)}
  if(supplied!==undefined && (typeof supplied!=='string'||!supplied||supplied.length>2048))return failure(400)
  let rotated:string|undefined
  try {
    const token=request.headers.get('authorization')?.match(/^Bearer ([A-Za-z0-9._-]{20,8192})$/)?.[1]
    const previous=supplied && token?await passwordIdentity(token):null
    if(supplied&&!previous)return failure(401)
    const refresh=typeof supplied==='string'?supplied:(await cookies()).get(REFRESH_COOKIE)?.value
    if(!refresh)return failure(401)
    const auth=credentialsAuth()
    const {data,error}=await auth.auth.refreshSession({refresh_token:refresh})
    if(error||!data.session)return failure(invalidRefresh(error)?401:503)
    if(!supplied)rotated=data.session.refresh_token
    const identity=await passwordIdentity(data.session.access_token)
    if(!identity || (previous && identity.userId!==previous.userId))return failure(401)
    if(previous && token){
      // Auth verified both access tokens above; bind the refresh grant to the same login.
      const sid=(jwt:string)=>JSON.parse(Buffer.from(jwt.split('.')[1],'base64url').toString()).session_id
      if(!sid(token)||sid(token)!==sid(data.session.access_token))return failure(401)
    }
    return sessionResponse(data.session,identity)
  } catch {
    const response=failure(503)
    if(rotated)setRefreshCookie(response,rotated)
    return response
  }
}
export async function DELETE(request:Request){
  if(!allowed(request))return failure(403)
  const refresh=(await cookies()).get(REFRESH_COOKIE)?.value
  if(!refresh)return clearPasswordCookies()
  let rotated:string|undefined
  try{
    const auth=credentialsAuth()
    const {data,error}=await auth.auth.refreshSession({refresh_token:refresh})
    if(error||!data.session)return error?.code==='session_not_found'||error?.code==='session_expired'?clearPasswordCookies():failure(503)
    rotated=data.session.refresh_token
    const result=await auth.auth.admin.signOut(data.session.access_token,'local')
    if(result.error)throw Error('SIGN_OUT_UNCONFIRMED')
    return clearPasswordCookies()
  }catch{
    const response=failure(503)
    if(rotated)setRefreshCookie(response,rotated)
    return response
  }
}
