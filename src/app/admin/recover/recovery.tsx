'use client'
import {useEffect,useRef,useState} from 'react'
export function SelfRecovery(){
 const token=useRef(''),pending=useRef(false)
 const [stage,setStage]=useState('request'),[code,setCode]=useState(''),[password,setPassword]=useState(''),[confirm,setConfirm]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false)
 useEffect(()=>{
  const read=()=>{const url=new URL(window.location.href),incoming=new URLSearchParams(url.hash.slice(1)).get('token');if(incoming){token.current=incoming;setStage('verify');setMessage('')}window.history.replaceState(null,'',url.pathname)}
  read();window.addEventListener('hashchange',read);return()=>window.removeEventListener('hashchange',read)
 },[])
 async function act(action:string){
  if(pending.current)return;pending.current=true;setBusy(true);setMessage('')
  try{
   if(action==='finish'&&password!==confirm)throw Error('새 비밀번호 확인이 일치하지 않습니다.')
   const body={action,...(action==='verify'?{token:token.current}:action==='challenge'?{code}:action==='finish'?{password}:{})}
   const r=await fetch('/api/admin/self-recovery',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})
   const data=await r.json();if(!r.ok)throw Error(data.error==='OWNER_RECOVERY_REQUIRED'?'MFA 분실은 학회 복구 담당자의 별도 신원 확인이 필요합니다.':data.error==='OWNER_RECONCILIATION_REQUIRED'?'계정은 보호 상태입니다. 복구 담당자에게 확인을 요청하세요.':'복구를 확인하지 못했습니다. 링크 만료·사용 여부와 기존 TOTP를 확인하세요.')
   if(action==='request')setMessage(data.message)
   else if(action==='finish'){setPassword('');setConfirm('');setCode('');setStage('done');setMessage('비밀번호를 변경하고 세션을 회수했습니다. 새 비밀번호와 기존 TOTP로 다시 로그인하세요.')}
   else {setStage(data.stage);if(action==='verify')token.current='';setCode('')}
  }catch(e){setMessage(e instanceof Error?e.message:'복구를 확인하지 못했습니다.')}finally{pending.current=false;setBusy(false)}
 }
 return <main className="admin-panel mx-auto my-10 max-w-xl space-y-5"><h1>최고관리자 비밀번호 복구</h1>
 <p>admin1 전용입니다. 등록된 학회 이메일과 기존 인증 앱의 TOTP가 모두 필요합니다. 일반 관리자는 admin1에게 비밀번호 초기화를 요청하세요.</p>
 {stage==='request'&&<button disabled={busy} onClick={()=>void act('request')}>복구 메일 요청</button>}
 {stage==='verify'&&<button disabled={busy} onClick={()=>void act('verify')}>복구 링크 확인</button>}
 {stage==='totp'&&<form onSubmit={e=>{e.preventDefault();void act('challenge')}}><label>기존 인증 앱 번호<input value={code} onChange={e=>setCode(e.target.value)} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" required disabled={busy}/></label><button disabled={busy}>TOTP 확인</button></form>}
 {stage==='password'&&<form onSubmit={e=>{e.preventDefault();void act('finish')}}><label>새 비밀번호<input type="password" autoComplete="new-password" minLength={15} required disabled={busy} value={password} onChange={e=>setPassword(e.target.value)}/></label><label>새 비밀번호 확인<input type="password" autoComplete="new-password" required disabled={busy} value={confirm} onChange={e=>setConfirm(e.target.value)}/></label><p>15자 이상, UTF-8 72바이트 이하로 입력하세요.</p><button disabled={busy}>비밀번호 재설정</button></form>}
 <p>MFA를 잃었다면 이메일로 해제할 수 없습니다. 학회 복구 담당자의 신원 확인과 보호된 Supabase 소유자 절차를 이용하세요.</p>
 {message&&<p role="status">{message}</p>}<a href="/admin/login">아이디 로그인으로 돌아가기</a></main>
}
