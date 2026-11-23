'use client'
import {useCallback,useEffect,useRef,useState} from 'react'
import {renewPasswordSession} from '@/lib/admin/password-client'
import {supabase} from '@/lib/supabaseClient'
import {useLocale} from './LocaleProvider'

type Clock = {sessionId:string;expiresAt:string;serverNow:string;state:'active'|'expired'}
const changed='oaz-admin-clock-change'
export function AdminSessionClock({visible=true,onActiveSession}:{visible?:boolean;onActiveSession?:(id:string|null)=>void}={}) {
  const en=useLocale()==='en'
  const [deadline,setDeadline]=useState<number|null>(null)
  const [now,setNow]=useState(0),[expired,setExpired]=useState(false)
  const [error,setError]=useState(false),[busy,setBusy]=useState(false)
  const generation=useRef(0),pending=useRef(false)
  const sync=useCallback(async(operation:'status'|'extend'='status')=>{
    if(operation==='extend'&&pending.current)return
    if(operation==='extend'){pending.current=true;setBusy(true)}
    const request=++generation.current
    try{
      const session=(await supabase.auth.getSession()).data.session
      if(request!==generation.current)return
      if(!session){onActiveSession?.(null);setDeadline(null);setError(false);return}
      const r=await fetch('/api/admin/session-clock',{method:'POST',cache:'no-store',credentials:'same-origin',
        headers:{Authorization:'Bearer '+session.access_token,'x-oaz-clock':operation}})
      if(request!==generation.current)return
      if(r.status===403||r.status===401){
        onActiveSession?.('unavailable')
        if(operation==='extend')setError(true)
        else setDeadline(null)
        return
      }
      if(!r.ok)throw Error('unavailable')
      const clock:Clock=await r.json()
      if(request!==generation.current)return
      onActiveSession?.(clock.state==='active'?clock.sessionId:null)
      const received=Date.now()
      setDeadline(received+Date.parse(clock.expiresAt)-Date.parse(clock.serverNow))
      if(localStorage.getItem('oaz-active-admin-session')===clock.sessionId){
        sessionStorage.setItem('oaz-clock-deadline',JSON.stringify({id:clock.sessionId,at:received+Date.parse(clock.expiresAt)-Date.parse(clock.serverNow)}))
      }
      setNow(received);setExpired(clock.state==='expired' && location.pathname!=='/admin/login');setError(false)
      if(clock.state==='expired' && location.pathname==='/admin/login')setDeadline(null)
      if(operation==='extend')localStorage.setItem(changed,crypto.randomUUID())
    }catch{if(request===generation.current){onActiveSession?.('unavailable');setError(true)}}
    finally{if(operation==='extend'){pending.current=false;setBusy(false)}}
  },[onActiveSession])
  useEffect(()=>{
    const refresh=()=>{if(!document.hidden&&!pending.current)void sync()}
    const storage=(event:StorageEvent)=>{
      if(event.key===changed)refresh()
      if(event.key==='oaz-active-admin-session')location.reload()
    }
    const {data}=supabase.auth.onAuthStateChange(()=>{setTimeout(refresh,0)})
    const restore=()=>{if(!location.pathname.startsWith('/admin') && !document.hidden && localStorage.getItem('oaz-active-admin-session')){
      void renewPasswordSession().then(next=>{if(!next){localStorage.removeItem('oaz-active-admin-session');setDeadline(null)}}).catch(()=>setError(true))
    }}
    const invalidatePending=()=>{generation.current++}
    const onExpiry=()=>{invalidatePending();setExpired(true);setDeadline(0)}
    window.addEventListener('oaz-admin-expired',onExpiry)
    restore()
    const keep=setInterval(restore,240000)
    window.addEventListener('pageshow',restore)
    refresh();window.addEventListener('storage',storage)
    window.addEventListener('online',refresh);document.addEventListener('visibilitychange',refresh)
    return ()=>{window.removeEventListener('oaz-admin-expired',onExpiry);clearInterval(keep);window.removeEventListener('pageshow',restore);invalidatePending();data.subscription.unsubscribe();window.removeEventListener('storage',storage);window.removeEventListener('online',refresh);document.removeEventListener('visibilitychange',refresh)}
  },[sync])
  useEffect(()=>{
    if(deadline===null||expired)return
    const tick=()=>setNow(Date.now())
    const id=setInterval(tick,1000);return ()=>clearInterval(id)
  },[deadline,expired])
  const seconds=deadline===null?null:Math.max(0,Math.ceil((deadline-now)/1000))
  const dialog=useRef<HTMLDialogElement>(null)
  // A suspended tab can miss another tab's extension. Recheck the server at zero.
  useEffect(()=>{
    if(seconds!==0||expired)return
    const check=setTimeout(()=>void sync(),0)
    return ()=>clearTimeout(check)
  },[seconds,expired,sync])
  const elapsed=expired||seconds===0
  useEffect(()=>{if(elapsed)dialog.current?.showModal();else dialog.current?.close()},[elapsed])
  if(deadline===null&&!expired)return null
  return <>
    {visible&&<span className="flex shrink-0 items-center gap-1 text-xs font-medium">
     <time aria-label={en?'Admin session time remaining':'관리자 세션 남은 시간'} className={'tabular-nums '+((seconds??0)<=300?'text-red-700':'')}>{String(Math.floor((seconds??0)/60)).padStart(2,'0')}:{String((seconds??0)%60).padStart(2,'0')}</time>
     <button type="button" className="min-h-8 rounded border px-1.5" disabled={elapsed||busy} onClick={()=>void sync('extend')}>{en?'Extend':'연장'}</button>
     {error&&<span role="status">{en?'Check connection':'연결 확인'}</span>}
    </span>}
    <dialog ref={dialog} aria-labelledby="admin-expiry" className="m-auto max-w-sm rounded-xl border bg-white p-6 shadow-lg backdrop:bg-black/40" onCancel={e=>e.preventDefault()}>
      <p id="admin-expiry">{!expired?(en?'Verifying your session. Editing is paused.':'세션을 확인하는 동안 편집을 잠시 중지합니다.'):en?'Your administrator session has expired. You have been signed out for security. Please sign in again to continue.':'관리자 세션이 만료되었습니다. 보안을 위해 로그아웃되었습니다. 계속하려면 다시 로그인해 주세요.'}</p>
      <a autoFocus onClick={()=>{sessionStorage.removeItem('oaz-clock-deadline')}} className="mt-4 inline-block rounded bg-black px-4 py-2 text-white" href="/admin/login">{en?'Go to sign in':'로그인 화면으로 이동'}</a>
    </dialog>
  </>
}
