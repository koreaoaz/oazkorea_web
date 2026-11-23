'use client'
import {useEffect,useRef,useState} from 'react'
import {supabase} from '@/lib/supabaseClient'
import {CONTENT_TABLES} from '@/lib/admin/policy'
type Invite={id:string;slot:string;username:string;status:string;revision:number;expires_at:string}
const scopeLabels=['공지','프로젝트','스터디','시간표','일정','행사']
export async function invitationCommand(command:Record<string,unknown>){
 const {data}=await supabase.auth.getSession();if(!data.session)throw Error('로그인과 최근 MFA 인증을 확인하세요.')
 const r=await fetch('/api/admin/invitations',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+data.session.access_token},body:JSON.stringify(command)})
 if(!r.ok)throw Error(r.status===403?'최고관리자 권한과 최근 MFA 인증을 확인하세요.':r.status===409?'이미 등록되었거나 상태가 변경되었습니다. 목록을 확인하세요.':'초대 처리를 확인하지 못했습니다. 목록을 확인하고 재시도하세요.')
 return r.json()
}
export function AdminInvitations(){
 const [rows,setRows]=useState<Invite[]>([]),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[username,setUsername]=useState(''),[email,setEmail]=useState(''),[name,setName]=useState(''),[scopes,setScopes]=useState<string[]>([])
 const pending=useRef(false),request=useRef({intent:'',id:''})
 const reload=async()=>setRows((await invitationCommand({action:'list'})).invitations)
 useEffect(()=>{let active=true;void invitationCommand({action:'list'}).then(data=>{if(active)setRows(data.invitations)}).catch(()=>{if(active)setMessage('초대 목록을 확인하지 못했습니다. 최근 MFA 인증을 확인하세요.')});return()=>{active=false}},[])
 async function run(command:Record<string,unknown>){if(pending.current)return;pending.current=true;setBusy(true);setMessage('');try{await invitationCommand(command);await reload();setMessage(command.action==='cancel'?'초대가 취소되었습니다.':'초대 메일을 로컬 수신함에서 확인하세요.')}catch(e){setMessage(e instanceof Error?e.message:'초대 실패')}finally{pending.current=false;setBusy(false)}}
 return <section className="admin-panel space-y-4"><h2 className="text-xl font-bold">일반 관리자 초대</h2><p>초대 수락과 비밀번호 설정, MFA 등록 후 권한이 활성화됩니다. 로컬 테스트 주소만 사용할 수 있습니다.</p>
 <form className="space-y-3" onSubmit={e=>{e.preventDefault();const intent=JSON.stringify({username,email,name,scopes});if(request.current.intent!==intent)request.current={intent,id:crypto.randomUUID()};void run({action:'prepare',requestId:request.current.id,username,email,displayName:name,scopes})}}>
 <fieldset disabled={busy} className="admin-form-grid"><label>초대 아이디<input value={username} onChange={e=>setUsername(e.target.value)} pattern="[a-z](?:[a-z0-9._]|-){3,31}" required/></label><label>초대 이메일<input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="member@example.invalid" required/></label><label>초대 표시 이름<input value={name} onChange={e=>setName(e.target.value)} maxLength={80} required/></label>
 {CONTENT_TABLES.map((t,i)=><label key={t}><input type="checkbox" checked={scopes.includes(t)} onChange={e=>setScopes(s=>e.target.checked?[...s,t]:s.filter(x=>x!==t))}/>{scopeLabels[i]}</label>)}<button type="submit">{busy?'처리 중…':'초대 메일 보내기'}</button></fieldset></form>
 {message&&<p role="status">{message}</p>}<button disabled={busy} onClick={()=>void reload().catch(()=>setMessage('목록 조회 실패'))}>초대 목록 새로고침</button>
 {!rows.length&&<p>발급한 초대가 없습니다.</p>}{rows.map(i=><article key={i.id} className="rounded border p-3"><p>{i.slot} · {i.username} · {i.status} · 만료 {new Date(i.expires_at).toLocaleString()}</p>{['prepared','pending'].includes(i.status)&&<><button disabled={busy} onClick={()=>void run({action:'resend',id:i.id,revision:i.revision})}>초대 재발급</button><button disabled={busy} onClick={()=>void run({action:'cancel',id:i.id,revision:i.revision})}>초대 취소</button></>}</article>)}</section>
}
