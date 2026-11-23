'use client'
import {useRef,useState} from 'react'
import {supabase} from '@/lib/supabaseClient'
import {invitationCommand} from '../accounts/invitations'
import {passwordAllowed} from '@/lib/admin/credentials-policy'
export default function InvitePage(){
 const id=useRef(''),pending=useRef(false);const [ready,setReady]=useState(false),[password,setPassword]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false)
 async function run(accept:boolean){if(pending.current)return;pending.current=true;setBusy(true);try{
  if(!accept){const url=new URL(location.href);id.current=url.searchParams.get('id')??'';const hash=new URLSearchParams(url.hash.slice(1)).get('token');history.replaceState(null,'',url.pathname);if(!hash||!id.current)throw Error();const result=await supabase.auth.verifyOtp({type:'recovery',token_hash:hash});if(result.error)throw Error();setReady(true);setMessage('초대가 확인되었습니다. 본인만 아는 비밀번호를 설정하세요.')}
  else{await invitationCommand({action:'accept',id:id.current,password});await supabase.auth.signOut({scope:'local'});setPassword('');setReady(false);setMessage('비밀번호 설정이 완료되었습니다. 초기 등록 화면에서 아이디와 새 비밀번호로 로그인하고 MFA를 등록하세요.')}
 }catch{setMessage('초대 만료·사용 여부와 입력을 확인하세요. 필요하면 최고관리자에게 재발급을 요청하세요.')}finally{pending.current=false;setBusy(false)}}
 return <main className="mx-auto max-w-xl space-y-4 p-5"><h1 className="text-2xl font-bold">관리자 초대 수락</h1>{!ready?<button disabled={busy} onClick={()=>void run(false)}>초대 링크 확인</button>:<form onSubmit={e=>{e.preventDefault();void run(true)}}><label>초기 비밀번호<input type="password" autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)} minLength={15} required disabled={busy}/></label><button disabled={busy||!passwordAllowed(password)}>비밀번호 설정</button></form>}{message&&<p role="status">{message}</p>}<a href="/admin/enrollment">초기 등록 및 MFA 설정</a></main>
}
