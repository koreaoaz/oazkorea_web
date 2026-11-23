'use client'
import {AdminSessionLoading} from '@/components/AdminSessionLoading'
import {LocalizedText,useLocale} from '@/components/LocaleProvider'
import {useEffect,useState} from 'react'
import {usePathname,useRouter} from 'next/navigation'
import {renewPasswordSession} from '@/lib/admin/password-client'

export function PasswordBootstrap({children}:{children:React.ReactNode}) {
  const [readyPath,setReadyPath]=useState<string|null>(null)
  const [unavailable,setUnavailable]=useState<string|null>(null)
  const router=useRouter(), path=usePathname(), en=useLocale()==='en'
  useEffect(()=>{
    if(path==='/admin/recover')return
    let live=true
    const timeout=setTimeout(()=>{if(live)setUnavailable(path)},20000)
    async function renew() {
      try {
        const next=await renewPasswordSession()
        if(!live)return
        if(next&&next!=='/admin'&&path!==next){router.replace(next);return}
        if(!next&&path!=='/admin/login'){
          const saved=JSON.parse(sessionStorage.getItem('oaz-clock-deadline')??'null')
          if(saved?.id && saved.id===localStorage.getItem('oaz-active-admin-session') && Number(saved.at)<=Date.now()){
            window.dispatchEvent(new Event('oaz-admin-expired'))
          }else router.replace('/admin/login')
          return
        }
        setUnavailable(null)
        setReadyPath(path)
        clearTimeout(timeout)
      } catch {
        if(live){
          if(path==='/admin/login')setReadyPath(path)
          else setUnavailable(path)
        }
      }
    }
    void renew()
    const resume=()=>{if(document.visibilityState==='visible')void renew()}
    document.addEventListener('visibilitychange',resume)
    window.addEventListener('online',resume)
    const timer=setInterval(()=>void renew(),4*60*1000)
    return ()=>{live=false;document.removeEventListener('visibilitychange',resume);window.removeEventListener('online',resume);clearInterval(timer);clearTimeout(timeout)}
  },[path,router])
  if(path==='/admin/recover'||readyPath===path){
    const credentialPage=['/admin/recover','/admin/mfa','/admin/enrollment','/admin/invite','/admin/password-reset','/admin/password-setup'].includes(path)
    return <>{credentialPage&&<a href="/admin/login" className="mx-auto flex min-h-11 max-w-xl items-center gap-2 px-4 text-sm underline"><span aria-hidden="true">←</span><LocalizedText ko="관리자 로그인" en="Admin sign-in"/></a>}{children}</>
  }
  if(unavailable===path)return <p role="alert">{en?'Session check timed out.':'세션 확인 시간이 초과되었습니다.'} <a href="/admin/login" className="underline">{en?'Sign in again':'다시 로그인'}</a></p>
  return <AdminSessionLoading/>
}
