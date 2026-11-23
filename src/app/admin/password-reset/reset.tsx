'use client'
import {useRef,useState} from 'react'
import {supabase} from '@/lib/supabaseClient'
import {credentialsCommand} from '@/lib/admin/credentials-client'
import {passwordAllowed} from '@/lib/admin/credentials-policy'
import {AdminSecurity} from '../security'
export function PasswordReset(){
 const [ready,setReady]=useState(false),[password,setPassword]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false)
 const task=useRef(''),pending=useRef(false)
 async function run(complete:boolean){if(pending.current)return;pending.current=true;setBusy(true);try{
  if(!complete){const url=new URL(window.location.href);const hash=new URLSearchParams(url.hash.slice(1)).get('token');task.current=url.searchParams.get('task')??'';window.history.replaceState(null,'',url.pathname);if(!hash||!task.current)throw Error()
   const result=await supabase.auth.verifyOtp({token_hash:hash,type:'recovery'});if(result.error)throw Error();setReady(true);setMessage('복구 링크가 확인되었습니다. MFA 등록 계정은 아래에서 기존 인증 앱으로 먼저 인증하세요.')
  }else{await credentialsCommand({action:'reset.finish',taskId:task.current,password});setPassword('');await supabase.auth.signOut({scope:'local'});setReady(false);setMessage('비밀번호 변경이 완료되었습니다. 새 비밀번호와 기존 MFA로 다시 로그인하세요.')}
 }catch{setMessage('복구를 확인하지 못했습니다. 링크 만료·사용 여부와 기존 MFA 인증을 확인하고 관리자에게 문의하세요.')}finally{pending.current=false;setBusy(false)}}
 return <main className="mx-auto max-w-xl space-y-5 p-5"><h1 className="text-2xl font-bold">관리자 비밀번호 재설정</h1>
 <p>본인에게 전달된 일회용 링크만 사용하세요. 기존 MFA 등록은 해제되지 않습니다.</p>
 {!ready&&<button disabled={busy} onClick={()=>void run(false)}>복구 링크 확인</button>}
 {ready&&<><AdminSecurity general/><form className="space-y-4" onSubmit={e=>{e.preventDefault();void run(true)}}><label className="block">새 비밀번호<input className="block w-full rounded border p-3" type="password" autoComplete="new-password" value={password} minLength={15} required disabled={busy} onChange={e=>setPassword(e.target.value)}/></label><p>15자 이상·UTF-8 72바이트 이내의 고유한 암호를 사용하세요.</p><button disabled={busy||!passwordAllowed(password)}>비밀번호 변경 완료</button></form></>}
 {message&&<p role="status">{message}</p>}<a href="/admin/login">관리자 로그인으로 이동</a></main>
}
