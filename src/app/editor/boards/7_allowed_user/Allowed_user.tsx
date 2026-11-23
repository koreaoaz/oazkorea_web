"use client"

import { useEffect, useState } from "react"
import { EditorForm } from "../../components/common/EditorForm"
import { addApproval, privacySession } from "@/lib/privacy/client"
import { privacyFailure } from "@/lib/privacy/errors"

export function Allowed_user() {
  const [name,setName]=useState("")
  const [email,setEmail]=useState("")
  const [allowed,setAllowed]=useState(false)
  const [message,setMessage]=useState<string | null>(null)
  useEffect(()=>{
    let active=true
    privacySession().then(state=>{if(active)setAllowed(state.approvalWrite)})
      .catch(error=>{if(active)setMessage(privacyFailure(error))})
    return ()=>{active=false}
  },[])
  if(!allowed)return <p role="status">{message ?? "승인 이메일 추가는 별도 업무 승인과 보호 기능 활성화 전까지 제한됩니다."}</p>
  return <EditorForm onSubmit={async event=>{
    event.preventDefault()
    await addApproval(name,email)
    setName("");setEmail("")
  }}>
    <p>업무 승인된 권한으로만 이메일을 추가합니다. 승인 명단 전체를 내려받아 중복 검사하지 않습니다.</p>
    <label>이름<input required value={name} maxLength={200} onChange={e=>setName(e.target.value)} /></label>
    <label>이메일<input required type="email" value={email} maxLength={320} onChange={e=>setEmail(e.target.value)} /></label>
    <button type="submit">승인 이메일 추가</button>
  </EditorForm>
}
