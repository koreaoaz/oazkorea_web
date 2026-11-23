'use client'
import {useState} from 'react'
import {useRouter} from 'next/navigation'
import {adoptPasswordSession,withPasswordLock} from '@/lib/admin/password-client'
export function PasswordLogin(){
 const router=useRouter(),[username,setUsername]=useState(''),[password,setPassword]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('')
 return <main className="admin-panel mx-auto my-10 max-w-md"><h1>관리자 로그인</h1><form className="space-y-4" onSubmit={async e=>{e.preventDefault();if(busy)return;setBusy(true);setError('');try{const next=await withPasswordLock(async()=>{const r=await fetch('/api/admin/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,password})});if(!r.ok)throw Error(r.status===429?'잠시 후 다시 시도해 주세요.':'아이디 또는 비밀번호를 확인해 주세요.');return adoptPasswordSession(await r.json())});setPassword('');router.replace(next);router.refresh()}catch(e){setError(e instanceof Error?e.message:'로그인을 확인하지 못했습니다.')}finally{setBusy(false)}}}>
 <label className="block">아이디<input className="block w-full" autoComplete="username" value={username} onChange={e=>setUsername(e.target.value)} pattern="[a-z][a-z0-9._-]{3,31}" required disabled={busy}/></label>
 <label className="block">비밀번호<input className="block w-full" type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} required disabled={busy}/></label>
 <button type="submit" disabled={busy}>{busy?'로그인 중…':'로그인'}</button>{error&&<p role="alert">{error}</p>}</form><a href="/admin/recover">최고관리자 비밀번호 복구</a></main>
}
