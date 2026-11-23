'use client'

import {T,useUIText} from '@/components/LocaleProvider';
import { useEffect,useRef, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { adminCommand } from '@/lib/admin/client'
import { useRouter } from 'next/navigation'
import { syncAdminCookie } from '@/lib/admin/session'
import Link from 'next/link'
import {AdminSecurity} from '../security'

export function AdminLogin({ origin,usernameReady=false }: { origin: string;usernameReady?:boolean }) {
 const uiText=useUIText();

  const router=useRouter()
  const [busy, setBusy] = useState(false), [message, setMessage] = useState('')
  const pending = useRef(false)
  const [email,setEmail]=useState(''),[password,setPassword]=useState('')
  const [username,setUsername]=useState(''),[legacy,setLegacy]=useState(false),[visible,setVisible]=useState(false)
  const [needsMfa,setNeedsMfa]=useState(false)
  const desktop=process.env.NEXT_PUBLIC_OAZ_DESKTOP_INTEGRATION==='owned-v1'
  const useUsername=usernameReady&&!legacy
  useEffect(()=>{
    let active=true
    const timer=setTimeout(()=>{void(async()=>{try{
      if(window.location.origin!==origin)return
      const {data,error}=await supabase.auth.getSession()
      if(!active||error||!data.session)return
      if(desktop){const {data:level}=await supabase.auth.mfa.getAuthenticatorAssuranceLevel();if(level?.currentLevel==='aal1'&&level.nextLevel==='aal2'){setNeedsMfa(true);return}}
      await adminCommand({action:'session',version:0});if(!active)return
      await syncAdminCookie();if(!active)return
      router.replace('/admin');router.refresh()
    }catch{if(active)setMessage('기존 세션의 활성 관리자 권한을 확인하지 못했습니다.')}})()},0)
    return()=>{active=false;clearTimeout(timer)}
  },[router,origin,desktop])
  async function finishLogin(){await adminCommand({action:'session',version:0});await syncAdminCookie();setPassword('');setVisible(false);setNeedsMfa(false);router.push('/admin');router.refresh()}
  async function passwordLogin(){
    if(pending.current)return
    pending.current=true;setBusy(true);setMessage('')
    try{
      if(window.location.origin!==origin)throw new Error('승인된 로그인 주소에서 접속해 주세요.')
      if(useUsername){
        const response=await fetch('/api/admin/login',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,password})})
        if(!response.ok)throw new Error(response.status===429?'로그인 시도가 많습니다. 15분 후 다시 시도해 주세요.':'아이디와 비밀번호 또는 계정 이용 상태를 확인해 주세요.')
        const result=await response.json()
        const {error}=await supabase.auth.setSession(result.session)
        if(error)throw new Error('로그인을 확인하지 못했습니다. 다시 시도해 주세요.')
      }else{
        const {error}=await supabase.auth.signInWithPassword({email:email.trim(),password})
        if(error)throw new Error('이메일과 비밀번호를 확인해 주세요.')
      }
      if(desktop){const {data:level,error}=await supabase.auth.mfa.getAuthenticatorAssuranceLevel();if(error)throw Error('추가 인증 상태를 확인하지 못했습니다.');if(level?.currentLevel==='aal1'&&level.nextLevel==='aal2'){setPassword('');setVisible(false);setNeedsMfa(true);return}}
      await finishLogin()
    }catch(e){setMessage(e instanceof Error?e.message:'로그인을 확인하지 못했습니다.')}
    finally{pending.current=false;setBusy(false)}
  }
  async function run(login: boolean) {
    if (pending.current) return
    pending.current = true; setBusy(true); setMessage('')
    try {
      if (window.location.origin !== origin) throw new Error('승인된 로그인 주소에서 접속해 주세요.')
      if (login) {
        const { error } = await supabase.auth.signInWithOAuth({ provider: 'github', options: { redirectTo: `${origin}/admin/login` } })
        if (error) throw new Error('로그인을 시작하지 못했습니다.')
      } else {
        await adminCommand({ action: 'session', version: 0 })
        const {data}=await supabase.auth.getSession()
        const response=await fetch('/api/admin/session',{method:'POST',headers:{Authorization:`Bearer ${data.session?.access_token??''}`}})
        if (!response.ok) throw new Error('관리자 세션을 확인하지 못했습니다.')
        router.push('/admin'); router.refresh()
      }
    } catch (error) { setMessage(error instanceof Error ? error.message : '로그인을 확인하지 못했습니다.') }
    finally { pending.current = false; setBusy(false) }
  }
  return <section className="admin-login space-y-6" aria-label={uiText("관리자 로그인")}>
    <p className="text-xs font-semibold tracking-widest text-zinc-500">OaZ · ADMIN</p>
    <h1 className="text-2xl font-bold"><T text="관리자 로그인"/></h1>
    <p><T text="각자의 독립 관리자 계정으로 로그인합니다. 공개 회원가입은 운영하지 않습니다. 최고관리자는 추가 MFA 인증이 필요합니다."/></p>
    {needsMfa?<AdminSecurity general onVerified={finishLogin}/>:<form className="space-y-4" onSubmit={e=>{e.preventDefault();void passwordLogin()}}>
      {useUsername?<label className="block">관리자 아이디<input className="mt-1 w-full rounded-lg border p-3" type="text" autoComplete="username" autoCapitalize="none" spellCheck={false} minLength={4} maxLength={32} pattern="[a-z](?:[a-z0-9._]|-){3,31}" value={username} onChange={e=>setUsername(e.target.value)} disabled={busy} required/></label>:<label className="block"><T text="관리자 이메일"/><input className="mt-1 w-full rounded-lg border p-3" type="email" autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)} disabled={busy} required/></label>}
      <label className="block"><T text="비밀번호"/><input id="admin-login-password" className="mt-1 w-full rounded-lg border p-3" type={visible?'text':'password'} autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} disabled={busy} required/></label>
      <button type="button" aria-controls="admin-login-password" aria-pressed={visible} disabled={busy} className="min-h-11 rounded-lg border px-3 text-sm" onClick={()=>setVisible(!visible)}>{visible?'비밀번호 숨기기':'비밀번호 보기'}</button>
      <button className="w-full rounded-lg bg-slate-900 p-3 text-white" disabled={busy} type="submit"><T text={busy?'로그인 확인 중…':'관리자 로그인'}/></button>
    </form>}
    {usernameReady&&!desktop&&<button type="button" disabled={busy} className="text-sm underline" onClick={()=>{setLegacy(!legacy);setPassword('');setVisible(false);setMessage('')}}>{legacy?'아이디로 로그인':'기존 로컬 이메일 로그인'}</button>}
    {!desktop&&<details className="border-t pt-4"><summary className="cursor-pointer text-sm font-semibold"><T text="기존 GitHub 계정으로 이용"/></summary><div className="mt-4 flex flex-wrap gap-3"><button disabled={busy} onClick={() => void run(true)}><T text="기존 GitHub로 로그인"/></button>
    <button disabled={busy} onClick={() => void run(false)}><T text="로그인 후 관리자 권한 확인"/></button></div></details>}
    {message && <p role="alert"><T text={message}/></p>}
    <Link className="block text-sm underline" href="/" prefetch={false}><T text="공개 홈페이지로 돌아가기"/></Link>
  </section>
}
