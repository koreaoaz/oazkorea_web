'use client'
import {supabase} from '@/lib/supabaseClient'
let renewing:Promise<string|null>|null=null
export function withPasswordLock<T>(task:()=>Promise<T>):Promise<T>{
 return navigator.locks?navigator.locks.request('oaz-password-cookie',task):task()
}
export async function adoptPasswordSession(body:{session:{access_token:string;refresh_token:string};next:string;sessionId?:string}){
 const r=await supabase.auth.setSession(body.session);if(r.error)throw Error('세션을 확인하지 못했습니다.')
 if(body.sessionId && localStorage.getItem('oaz-active-admin-session')!==body.sessionId){
  localStorage.setItem('oaz-active-admin-session',body.sessionId)
 }
 return body.next
}
export function renewPasswordSession(bind=false):Promise<string|null>{
 if(renewing && !bind)return renewing
 const task=withPasswordLock(async()=>{
  const s=bind?(await supabase.auth.getSession()).data.session:null
  const r=await fetch('/api/admin/auth-session',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json',...(s?{Authorization:'Bearer '+s.access_token}:{})},body:JSON.stringify(s&&s.refresh_token!=='server-managed'?{refreshToken:s.refresh_token}:{})})
  if(r.status===401)return null
  if(!r.ok)throw Error('AUTH_UNAVAILABLE')
  return adoptPasswordSession(await r.json())
 }).finally(()=>{if(renewing===task)renewing=null})
 renewing=task
 return renewing
}
export async function passwordCommand(command:Record<string,unknown>){
 const session=(await supabase.auth.getSession()).data.session;if(!session)throw Error('다시 로그인해 주세요.')
 const r=await fetch('/api/admin/password-accounts',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+session.access_token},body:JSON.stringify(command)})
 const body=await r.json();if(!r.ok)throw Error(body.error==='RECENT_MFA_AND_PERMISSION_REQUIRED'?'최고관리자 권한과 최근 인증을 확인해 주세요.':body.error==='ACCOUNT_CONFLICT'?'중복 아이디 또는 변경 충돌입니다.':body.error==='PASSWORD_RULE'?'새 비밀번호는 기존과 다르게 15자 이상, UTF-8 72바이트 이하로 입력하세요.':body.error==='REAUTHENTICATION_REQUIRED'?'현재 비밀번호를 확인해 주세요.':'요청을 완료하지 못했습니다. 계정 상태를 확인한 후 다시 시도하세요.')
 return body
}
export async function endPasswordSession(){
 await withPasswordLock(async()=>{
  const response=await fetch('/api/admin/auth-session',{method:'DELETE',credentials:'same-origin'})
  if(!response.ok)throw Error('LOGOUT_UNCONFIRMED')
  const result=await supabase.auth.signOut({scope:'local'})
  if(result.error)throw Error('LOGOUT_UNCONFIRMED')
  localStorage.removeItem('oaz-active-admin-session')
 })
}
