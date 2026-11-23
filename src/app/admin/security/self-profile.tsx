'use client'
import {useState} from 'react'
import {passwordCommand} from '@/lib/admin/password-client'
export function SelfProfile(){
 const [name,setName]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState('')
 return <form onSubmit={async e=>{e.preventDefault();if(busy)return;setBusy(true);setMessage('');try{await passwordCommand({action:'profile',requestId:crypto.randomUUID(),displayName:name});setMessage('내 표시 이름을 저장했습니다.')}catch(e){setMessage(e instanceof Error?e.message:'저장하지 못했습니다.')}finally{setBusy(false)}}}><label>내 표시 이름<input required maxLength={80} value={name} onChange={e=>setName(e.target.value)} disabled={busy}/></label><button disabled={busy}>내 정보 저장</button>{message&&<p role="status">{message}</p>}</form>
}
