import 'server-only'
import {NextResponse} from 'next/server'
import {ADMIN_COOKIE} from './server'
import {credentialRpc,credentialsAuth,credentialsConfiguration} from './credentials-server'
import {passwordNext,type PasswordIdentity} from './role-password-policy'

export const REFRESH_COOKIE='oaz_admin_refresh'
export async function boundedJSON(request:Request,limit=8192) {
 if(!request.headers.get('content-type')?.startsWith('application/json'))throw Error('JSON_REQUIRED')
 const reader=request.body?.getReader();if(!reader)throw Error('INVALID_INPUT')
 const decoder=new TextDecoder('utf-8',{fatal:true});let size=0,text=''
 while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>limit){await reader.cancel();throw Error('TOO_LARGE')}text+=decoder.decode(value,{stream:true})}
 const body=JSON.parse(text+decoder.decode());if(!body||Array.isArray(body)||typeof body!=='object')throw Error('INVALID_INPUT');return body
}
export async function passwordIdentity(token:string):Promise<PasswordIdentity|null> {
 const u=await credentialsAuth().auth.getUser(token);if(u.error && (!u.error.status || u.error.status===429 || u.error.status>=500))throw Error('AUTH_UNAVAILABLE');if(u.error||!u.data.user)return null
 const identity=await credentialRpc('password_identity',{},token)
 return identity?.userId===u.data.user.id?identity:null
}
export function sessionResponse(tokens:{access_token:string;refresh_token:string},identity:PasswordIdentity) {
 // Only decode after Auth verification. DB checks the signed claims/session again.
 const claims=JSON.parse(Buffer.from(tokens.access_token.split('.')[1],'base64url').toString())
 const response=NextResponse.json({session:{access_token:tokens.access_token,refresh_token:'server-managed'},next:passwordNext(identity,claims.aal),sessionId:claims.session_id,identity:{role:identity.role,username:identity.username,mustChange:identity.mustChange}},{headers:{'Cache-Control':'no-store'}})
 const secure=credentialsConfiguration()!.origin.startsWith('https:')
 setRefreshCookie(response,tokens.refresh_token)
 response.cookies.set(ADMIN_COOKIE,tokens.access_token,{path:'/admin',httpOnly:true,sameSite:'strict',secure,maxAge:Math.max(0,Math.min(3600,Math.floor(claims.exp-Date.now()/1000)))})
 return response
}
export function setRefreshCookie(response:NextResponse,token:string) {
 response.cookies.set(REFRESH_COOKIE,token,{path:'/api/admin',httpOnly:true,sameSite:'strict',secure:credentialsConfiguration()?.origin.startsWith('https:')??true,maxAge:8*60*60})
}
export function clearPasswordCookies() {
 const response=NextResponse.json({ok:true},{headers:{'Cache-Control':'no-store'}})
 const secure=credentialsConfiguration()?.origin.startsWith('https:')??true
 response.cookies.set(REFRESH_COOKIE,'',{path:'/api/admin',httpOnly:true,sameSite:'strict',secure,maxAge:0})
 response.cookies.set(ADMIN_COOKIE,'',{path:'/admin',httpOnly:true,sameSite:'strict',secure,maxAge:0})
 return response
}
