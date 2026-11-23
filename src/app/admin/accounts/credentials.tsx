'use client'
import {useEffect,useRef,useState} from 'react'
import {credentialsCommand} from '@/lib/admin/credentials-client'
import {credentialName,passwordAllowed} from '@/lib/admin/credentials-policy'
import {supabase} from '@/lib/supabaseClient'
import {useRouter} from 'next/navigation'
type Row={slot:string;userId:string;username:string;revision:number;role:string;status:string;mfaEnrolled:boolean;lastAction:string|null;lastActionAt:string|null}
export function AccountCredentials(){
 const router=useRouter()
 const [rows,setRows]=useState<Row[]>([]),[message,setMessage]=useState(''),[busy,setBusy]=useState(false)
 const [selected,setSelected]=useState<Row|null>(null),[action,setAction]=useState('rename'),[name,setName]=useState(''),[password,setPassword]=useState(''),[current,setCurrent]=useState(''),[link,setLink]=useState('')
 const pending=useRef(false),attempt=useRef(crypto.randomUUID())
 async function reload(){setRows(await credentialsCommand({action:'list'}))}
 useEffect(()=>{let active=true;void credentialsCommand({action:'list'}).then(r=>{if(active)setRows(r)}).catch(()=>{if(active)setMessage('계정 아이디 관리 연결과 최고관리자 MFA 인증을 확인해 주세요.')});return()=>{active=false}},[])
 function select(row:Row,operation:string){if(busy)return;setSelected(row);setAction(operation);setName(row.username);setPassword('');setCurrent('');setLink('');setMessage('');attempt.current=crypto.randomUUID()}
 async function submit(){
  if(pending.current||!selected)return
  if(!window.confirm(`${selected.slot} 계정의 ${action==='rename'?'로그인 아이디 변경':action==='password'?'본인 비밀번호 변경':action==='reset'?'비밀번호 복구 링크 발급':action==='disable'?'비활성화':action==='enable'?'재활성화':action==='cancel'?'이전 복구 요청 취소':'세션 회수'}를 진행할까요?`))return
  pending.current=true;setBusy(true);setMessage('')
  try{
   const result=await credentialsCommand({action,requestId:attempt.current,slot:selected.slot,revision:selected.revision,...(action==='rename'?{username:name}:{}),...(action==='password'?{password,currentPassword:current}:{})})
   setPassword('');setCurrent('')
   if(result.recoveryLink){setLink(result.recoveryLink);setMessage('일회용 복구 링크를 발급했습니다. 본인 확인 후 대상 관리자에게 안전하게 전달하세요. 비밀번호 변경은 아직 완료되지 않았습니다.')}
   else if(result.status==='recovery-email-requested'){setLink('');setMessage('Auth에 복구 메일 발송을 요청했습니다. 실제 받은편지함에서 확인해야 하며, 수신이나 비밀번호 변경이 완료됐다는 뜻은 아닙니다.');setSelected(null)}
   else if(result.status==='completed'){setMessage('계정 작업이 완료되었습니다. 기존 콘텐츠와 MFA 등록은 유지됩니다.');setSelected(null)}
   else setMessage('진행 중인 요청입니다. 중복 발급하지 말고 상태를 확인하세요.')
   if(action==='password'||action==='revoke'&&selected.slot==='admin1'){await supabase.auth.signOut({scope:'local'});router.replace('/admin/login');router.refresh();return}
   await reload()
  }catch(e){setMessage(e instanceof Error?e.message:'처리를 확인하지 못했습니다.')}
  finally{pending.current=false;setBusy(false)}
 }
 return <section className="admin-panel space-y-4" aria-label="로그인 아이디와 계정 보안">
  <h2 className="text-xl font-bold">로그인 아이디와 계정 보안</h2>
  <p>내부 슬롯과 로그인 아이디는 별개입니다. 변경 작업은 최근 10분 이내의 최고관리자 MFA 인증이 필요합니다.</p>
  <p className="text-sm">비밀번호는 조회할 수 없습니다. 복구는 본인이 새 비밀번호를 설정하고, 등록된 MFA 인증을 유지하는 절차입니다.</p>
  <button disabled={busy} onClick={()=>void reload().catch(()=>setMessage('새로고침하지 못했습니다. MFA 상태를 확인하세요.'))}>아이디 목록 새로고침</button>
  <div className="grid gap-4 sm:grid-cols-2">{rows.map(row=><article key={row.slot} className="rounded-xl border p-4 space-y-2 min-w-0">
   <h3 className="font-bold">{row.slot} · {row.role==='SUPER_ADMIN'?'최고관리자':'일반관리자'}</h3>
   <p className="break-all">로그인 아이디: {row.username}</p><p>{row.status==='active'?'활성':'비활성'} · MFA {row.mfaEnrolled?'등록됨':'미등록'}</p>
   <p className="text-sm break-words">최근 작업: {row.lastAction??'기록 없음'}{row.lastActionAt?' · '+new Date(row.lastActionAt).toLocaleString('ko-KR'):''}</p>
   <div className="admin-actions"><button disabled={busy} onClick={()=>select(row,'rename')}>아이디 변경</button>
    <button disabled={busy} onClick={()=>select(row,row.slot==='admin1'?'password':'reset')}>{row.slot==='admin1'?'비밀번호 변경':'비밀번호 초기화'}</button>
    {row.slot!=='admin1'&&<button disabled={busy} onClick={()=>select(row,row.status==='active'?'disable':'enable')}>{row.status==='active'?'비활성화':'재활성화'}</button>}
    <button disabled={busy} onClick={()=>select(row,'revoke')}>세션 회수</button>
    {row.slot!=='admin1'&&<button disabled={busy} onClick={()=>select(row,'cancel')}>복구 요청 취소</button>}
   </div>
  </article>)}</div>
  {selected&&<form className="space-y-3 border-t pt-4" onSubmit={e=>{e.preventDefault();void submit()}}>
   <p>{selected.slot} · 현재 아이디: <span className="break-all">{selected.username}</span></p>
   {action==='rename'&&<label className="block">새 로그인 아이디<input value={name} disabled={busy} autoComplete="off" autoCapitalize="none" spellCheck={false} pattern="[a-z](?:[a-z0-9._]|-){3,31}" minLength={4} maxLength={32} required onChange={e=>{setName(e.target.value);attempt.current=crypto.randomUUID()}}/></label>}
   {action==='password'&&<><label className="block">현재 비밀번호<input type="password" value={current} autoComplete="current-password" required disabled={busy} onChange={e=>setCurrent(e.target.value)}/></label><label className="block">새 비밀번호<input type="password" value={password} autoComplete="new-password" minLength={15} required disabled={busy} onChange={e=>setPassword(e.target.value)}/></label><p className="text-sm">15자 이상, UTF-8 72바이트 이내. 변경 후 다시 로그인해야 합니다. MFA는 유지됩니다.</p></>}
   {action==='reset'&&<p>메일 발송이 설정된 환경은 등록 주소로 복구 링크를 보냅니다. 그 외에는 한 번 표시되는 링크를 본인 확인 후 전달하세요. 요청 후 15분 이내에 완료해야 하며, 기기 분실에 따른 MFA 복구는 별도 운영자 확인이 필요합니다.</p>}
   <div className="admin-actions"><button type="submit" disabled={busy||action==='rename'&&!credentialName.test(name)||action==='password'&&(!current||!passwordAllowed(password))}>{busy?'처리 중…':'확인 후 실행'}</button><button type="button" disabled={busy} onClick={()=>{setSelected(null);setPassword('');setCurrent('');setLink('')}}>닫기</button></div>
  </form>}
  {link&&<div className="space-y-2"><p>복구 링크는 비밀 정보입니다. 채팅·공개 문서·스크린샷에 남기지 마세요.</p><button onClick={()=>void navigator.clipboard.writeText(link).then(()=>setMessage('복구 링크를 복사했습니다. 대상 관리자에게만 전달하세요.')).catch(()=>setMessage('클립보드에 접근할 수 없습니다. 브라우저 권한을 확인하세요.'))}>일회용 복구 링크 복사</button><button onClick={()=>setLink('')}>링크 표시 종료</button></div>}
  {message&&<p role="status">{message}</p>}
 </section>
}
