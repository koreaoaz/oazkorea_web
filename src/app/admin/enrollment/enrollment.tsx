'use client'
import {useRef,useState} from 'react'
import {supabase} from '@/lib/supabaseClient'
import {AdminSecurity} from '../security'
export function Enrollment(){
 const [username,setUsername]=useState(''),[password,setPassword]=useState(''),[signedIn,setSignedIn]=useState(false),[message,setMessage]=useState(''),[busy,setBusy]=useState(false)
 const running=useRef(false)
 async function run(activate:boolean){
  if(running.current)return;running.current=true;setBusy(true);setMessage('')
  try{
   if(!activate){
    const r=await fetch('/api/admin/enrollment/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,password})});setPassword('')
    if(!r.ok)throw Error();const {session}=await r.json();const {error}=await supabase.auth.setSession(session);if(error)throw Error();setSignedIn(true)
   }else{
    const {data}=await supabase.auth.getSession();if(!data.session)throw Error()
    const r=await fetch('/api/admin/enrollment',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+data.session.access_token},body:JSON.stringify({action:'activate'})})
    if(!r.ok||(await r.json()).state!=='ACTIVE')throw Error()
    await supabase.auth.signOut({scope:'local'});setSignedIn(false);setMessage('초기 등록이 완료됐습니다. 관리자 로그인에서 다시 로그인하고 MFA 인증을 진행하세요.')
   }
  }catch{setMessage('초기 등록을 확인하지 못했습니다. 등록 허용 여부와 인증 앱 확인 상태를 점검해 주세요.')}
  finally{setPassword('');running.current=false;setBusy(false)}
 }
 return <main className="mx-auto max-w-xl space-y-5 p-6"><h1 className="text-2xl font-bold">관리자 초기 등록</h1><p>등록 대기 중에는 콘텐츠와 관리자 기능을 사용할 수 없습니다. 인증 앱 등록을 완료한 뒤 계정을 활성화하세요.</p>
 {!signedIn?<form className="space-y-4" onSubmit={e=>{e.preventDefault();void run(false)}}><label className="block">아이디<input className="block w-full rounded border p-3" value={username} autoComplete="username" onChange={e=>setUsername(e.target.value)} required/></label><label className="block">비밀번호<input className="block w-full rounded border p-3" type="password" value={password} autoComplete="current-password" onChange={e=>setPassword(e.target.value)} required/></label><button disabled={busy}>초기 등록 로그인</button></form>:<><AdminSecurity general enrollment/><button disabled={busy} onClick={()=>void run(true)}>MFA 확인 후 초기 등록 완료</button></>}
 {message&&<p role="status">{message}</p>}<a href="/admin/login">관리자 로그인</a></main>
}
