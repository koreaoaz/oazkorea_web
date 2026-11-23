'use client'
/* eslint-disable @next/next/no-img-element -- 인증 SDK의 메모리 내 SVG QR을 이미지로만 표시한다. */

import {T,useUIText} from '@/components/LocaleProvider';
import { useRef,useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { syncAdminCookie } from '@/lib/admin/session'

export function AdminSecurity({general=false,enrollment=false,onVerified}:{general?:boolean;enrollment?:boolean;onVerified?:()=>Promise<void>}={}) {
 const uiText=useUIText();

  const [factor,setFactor]=useState(''),[qr,setQr]=useState(''),[code,setCode]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false)
  const pending=useRef(false),router=useRouter()
  async function run(verify:boolean){
    if(pending.current)return
    pending.current=true;setBusy(true);setMessage('')
    try{
      if(verify){
        const {error}=await supabase.auth.mfa.challengeAndVerify({factorId:factor,code})
        if(error)throw new Error('인증번호를 다시 확인해 주세요.')
        if(onVerified)await onVerified();else if(!enrollment)await syncAdminCookie();setCode('');setQr('');setMessage('추가 인증이 완료됐습니다.');if(!enrollment&&!onVerified)router.refresh()
      }else{
        const {data,error}=await supabase.auth.mfa.listFactors()
        if(error)throw new Error('인증 수단을 확인하지 못했습니다.')
        const existing=data.totp.find(f=>f.status==='verified')
        if(existing){setFactor(existing.id);setQr('')}
        else{
          const result=await supabase.auth.mfa.enroll({factorType:'totp',friendlyName:'OAZ 관리자 인증'})
          if(result.error)throw new Error('인증 수단을 등록하지 못했습니다.')
          setFactor(result.data.id)
          const raw=result.data.totp.qr_code.replace(/^data:image\/svg\+xml;utf-8,/, '')
          setQr('data:image/svg+xml;charset=utf-8,'+encodeURIComponent(raw))
        }
      }
    }catch(e){setMessage(e instanceof Error?e.message:'인증을 확인하지 못했습니다.')}
    finally{pending.current=false;setBusy(false)}
  }
  return <section className="admin-panel mx-auto max-w-xl space-y-5" aria-label={uiText("추가 인증")}><p className="text-xs font-semibold tracking-widest text-zinc-500"><T text="OaZ · 보안 확인"/></p><h2 className="text-xl font-bold"><T text={general?'내 계정 추가 인증':'최고관리자 추가 인증'}/></h2>
    <p><T text="계정 관리와 전체 작업 이력은 인증 앱의 6자리 번호로 한 번 더 확인합니다."/></p>
    <button className="rounded-lg bg-slate-900 px-4 py-2 text-white" disabled={busy||!!factor} onClick={()=>void run(false)}><T text="인증 앱 연결·확인"/></button>
    {qr&&<><p><T text="개인 인증 앱으로 QR을 스캔하세요. 화면을 공유하거나 저장하지 마세요."/></p>{/* 인증 SDK가 생성한 QR이며 HTML로 삽입하지 않는다. */}
      <img width={220} height={220} src={qr} alt={uiText("인증 앱 등록 QR")}/></>}
    {factor&&<form className="space-y-4" onSubmit={e=>{e.preventDefault();void run(true)}}><p className="text-sm text-zinc-600"><T text="인증 앱에 표시되는 현재 6자리 번호를 입력하세요."/></p><label className="block"><T text="인증번호"/><input className="block rounded border p-2" autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,''))} required disabled={busy}/></label><button disabled={busy||code.length!==6}><T text={busy?'인증 확인 중…':'인증 완료'}/></button></form>}
    {message&&<p role="status"><T text={message}/></p>}
  </section>
}
