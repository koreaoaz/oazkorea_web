'use client'
import {useState} from 'react'
import {useUnsavedChanges} from '../unsaved'
import {useRouter} from 'next/navigation'
import {passwordCommand,endPasswordSession} from '@/lib/admin/password-client'
import {rolePasswordClient} from '@/lib/admin/role-password-policy'
export default function Page(){
 const router=useRouter(),[current,setCurrent]=useState(''),[password,setPassword]=useState(''),[confirm,setConfirm]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('')
 useUnsavedChanges(!!(current||password||confirm))
 if(!rolePasswordClient)return <p>이 경로는 활성화되지 않았습니다.</p>
 return <section className="admin-panel mx-auto my-10 max-w-xl"><h1>내 비밀번호 변경</h1><p>임시 비밀번호로 로그인한 경우 새 비밀번호를 설정해야 관리 기능을 사용할 수 있습니다. 변경하면 모든 기존 세션이 종료됩니다.</p>
 <form className="space-y-4" onSubmit={async e=>{e.preventDefault();if(busy)return;setBusy(true);setError('');try{if(password!==confirm)throw Error('새 비밀번호가 일치하지 않습니다.');await passwordCommand({action:'password',requestId:crypto.randomUUID(),currentPassword:current,password});setCurrent('');setPassword('');setConfirm('');await endPasswordSession();router.replace('/admin/login')}catch(e){setError(e instanceof Error?e.message:'변경하지 못했습니다.')}finally{setBusy(false)}}}>
 <label className="block">현재 또는 임시 비밀번호<input className="block w-full" type="password" autoComplete="current-password" value={current} onChange={e=>setCurrent(e.target.value)} required disabled={busy}/></label>
 <label className="block">새 비밀번호<input className="block w-full" type="password" autoComplete="new-password" minLength={15} value={password} onChange={e=>setPassword(e.target.value)} required disabled={busy}/></label>
 <label className="block">새 비밀번호 확인<input className="block w-full" type="password" autoComplete="new-password" value={confirm} onChange={e=>setConfirm(e.target.value)} required disabled={busy}/></label>
 <button disabled={busy}>비밀번호 변경 후 로그아웃</button>{error&&<p role="alert">{error}</p>}</form></section>
}
