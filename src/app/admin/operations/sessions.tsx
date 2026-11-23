'use client'
import {useRef,useState} from 'react'
import {TriangleAlert} from 'lucide-react'
import {useLocale} from '@/components/LocaleProvider'
import {PublicDetailDialog} from '@/components/PublicDetailDialog'
import {adminCommand} from '@/lib/admin/client'
import {finalCommand} from '@/lib/admin/final-client'

export function OwnSessions() {
  const en=useLocale()==='en'
  const [confirming,setConfirming]=useState<{userId:string;slot:string}|null>(null)
  const [busy,setBusy]=useState(false)
  const [message,setMessage]=useState('')
  const pending=useRef(false)
  const trigger=useRef<HTMLButtonElement>(null)
  const danger='inline-flex min-h-11 items-center justify-center gap-2 rounded-lg !border-red-800 !bg-red-800 px-4 !text-white hover:!bg-red-900 focus-visible:outline-2 focus-visible:outline-red-800 disabled:opacity-60'
  const title=en?'Revoke all sessions for this account':'현재 로그인 계정의 전체 세션 회수'
  async function confirmAccount() {
    if(pending.current)return
    pending.current=true
    setBusy(true)
    setMessage('')
    try {
      const account=await adminCommand({action:'session',version:0}) as {userId:string;slot:string}
      if(!account.userId || typeof account.slot!=='string' || !account.slot.trim())throw Error('SESSION')
      setConfirming(account)
    } catch {
      setMessage(en?'Could not verify the current account.':'현재 로그인 계정을 확인하지 못했습니다.')
    } finally {
      pending.current=false
      setBusy(false)
    }
  }
  async function revoke() {
    if(pending.current||!confirming)return
    pending.current=true
    setConfirming(null)
    setBusy(true)
    setMessage('')
    try {
      const session=await adminCommand({action:'session',version:0}) as {userId:string}
      if(session.userId!==confirming.userId) throw Error('SESSION_CHANGED')
      await finalCommand({action:'sessions.revoke',userId:session.userId})
      setMessage(en?'Sessions revoked. Sign in again on this device.':'서버에서 기존 세션을 회수했습니다. 이 기기에서도 새로 로그인해 주세요.')
    } catch {
      setMessage(en?'Could not confirm revocation. Check your session and MFA.':'세션 회수 결과를 확인하지 못했습니다. 현재 인증과 MFA를 확인해 주세요.')
    } finally {
      pending.current=false
      setBusy(false)
    }
  }
  return <section lang={en?'en':'ko'} className="admin-panel space-y-3"><h2>{en?'Account sessions':'현재 계정의 모든 세션 회수'}</h2>
    <p>{en?'This action may end all login sessions for your account.':'이 작업을 실행하면 현재 계정의 로그인 세션이 모두 종료될 수 있습니다.'}</p>
    <button type="button" ref={trigger} className={danger} disabled={busy} onClick={()=>void confirmAccount()}><TriangleAlert size={18} aria-hidden="true"/>{title}</button>
    {message&&<p role="status">{message}</p>}
    {confirming&&<PublicDetailDialog title={title+' · '+confirming.slot} returnFocusRef={trigger} onClose={()=>setConfirming(null)}>
      <p>{en?'This includes this device. You will need to sign in again. Your MFA registration is preserved.':'현재 기기도 포함됩니다. 다시 로그인해야 하며 기존 MFA 등록은 유지됩니다.'}</p>
      <div className="mt-4 flex flex-wrap justify-end gap-2"><button type="button" autoFocus onClick={()=>setConfirming(null)}>{en?'Cancel':'취소'}</button><button type="button" className={danger} onClick={()=>void revoke()}>{en?'Confirm revocation':'전체 세션 회수 확인'}</button></div>
    </PublicDetailDialog>}
  </section>
}
