'use client'
import {useCallback,useEffect,useRef,useState} from 'react'
import {useUnsavedChanges} from '../unsaved'
import Link from 'next/link'
import {passwordCommand} from '@/lib/admin/password-client'
import {supabase} from '@/lib/supabaseClient'
import {CONTENT_TABLES} from '@/lib/admin/policy'
type Row={slot:string;username:string;revision:number;role:string;status:string;state:string}
export function PasswordManagement({tab,onCreated}:{tab:string;onCreated?:()=>Promise<unknown>}){
 const [rows,setRows]=useState<Row[]>([]),[username,setUsername]=useState(''),[name,setName]=useState(''),[scopes,setScopes]=useState<string[]>([]),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[temporary,setTemporary]=useState(''),[audit,setAudit]=useState<{id:number;slot:string;action:string;created_at:string}[]>([])
 useUnsavedChanges(!!(username||name||scopes.length))
 const pending=useRef(false)
 const currentTab=useRef(tab)
 useEffect(()=>{currentTab.current=tab},[tab])
 const listRequest=useRef(0)
 const reload=useCallback(async()=>{
  const request=listRequest.current+1
  listRequest.current=request
  const [list,events]=await Promise.all([passwordCommand({action:'list'}),passwordCommand({action:'audit'})])
  if(request===listRequest.current){setRows(list.result);setAudit(events.result)}
 },[])
 useEffect(()=>{
  if(tab!=='list')return
  let live=true
  void reload().catch(()=>{if(live)setMessage('최근 최고관리자 인증을 확인해 주세요.')})
  return()=>{live=false;listRequest.current++}
 },[tab,reload])
 async function run(task:()=>Promise<void>){
  if(pending.current)return
  pending.current=true;setBusy(true);setMessage('');setTemporary('')
  try{
   await task()
   if(currentTab.current==='list'){
    try{await reload()}catch{setMessage(text=>[text,'목록을 갱신하지 못했습니다. 목록을 다시 열어 확인하세요.'].filter(Boolean).join(' '))}
   }
  }catch(e){setMessage(e instanceof Error?e.message:'처리하지 못했습니다.')}
  finally{pending.current=false;setBusy(false)}
 }
 async function rename(row:Row){const username=window.prompt('새 로그인 아이디',row.username);if(!username||username===row.username)return
  const s=(await supabase.auth.getSession()).data.session;if(!s)throw Error('다시 로그인해 주세요.')
  const r=await fetch('/api/admin/credentials',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+s.access_token},body:JSON.stringify({action:'rename',slot:row.slot,revision:row.revision,username,requestId:crypto.randomUUID()})});if(!r.ok)throw Error('아이디를 변경하지 못했습니다. 중복 또는 최근 인증을 확인하세요.')
 }
 return <section className="admin-panel space-y-4"><h2>아이디 및 비밀번호 관리</h2><p>일반 관리자에게 이메일이나 인증 앱을 요구하지 않습니다. 권한은 아래 목록에서 수정합니다.</p><Link href="/admin/mfa">최근 최고관리자 인증</Link>
 {tab==='create'&&<form className="admin-form-grid account-create-form" onSubmit={e=>{e.preventDefault();void run(async()=>{const r=await passwordCommand({action:'create',requestId:crypto.randomUUID(),username,displayName:name,scopes});setTemporary(r.temporaryPassword);setUsername('');setName('');setScopes([]);setMessage('일반 관리자를 생성했습니다. 임시 비밀번호를 안전하게 직접 전달하세요.');if(currentTab.current==='list')await onCreated?.().catch(()=>setMessage(text=>text+' 관리자 목록을 다시 열어 확인하세요.'))})}}>
 <label>새 관리자 아이디<input required pattern="[a-z][a-z0-9._\-]{3,31}" value={username} onChange={e=>setUsername(e.target.value)} disabled={busy}/></label><label>표시 이름<input required maxLength={80} value={name} onChange={e=>setName(e.target.value)} disabled={busy}/></label>
 <fieldset><legend>초기 편집 범위</legend>{CONTENT_TABLES.map((t,i)=><label className="admin-scope" key={t}><input type="checkbox" checked={scopes.includes(t)} disabled={busy} onChange={e=>setScopes(s=>e.target.checked?[...s,t]:s.filter(x=>x!==t))}/>{['공지','프로젝트','스터디','시간표','일정','행사'][i]}</label>)}</fieldset><button type="submit" disabled={busy}>일반 관리자 생성</button></form>}
 {message&&<p role="status">{message}</p>}{temporary&&<div className="rounded border p-4"><p>이번 응답에서만 표시합니다. 화면을 공유하거나 보고서에 저장하지 마세요.</p><label>임시 비밀번호<input type="password" readOnly value={temporary} autoComplete="off"/></label><button onClick={()=>setTemporary('')}>전달 완료 · 화면에서 지우기</button></div>}
 {tab==='list'&&<><ul>{rows.map(row=><li className="my-3 flex flex-wrap gap-3" key={row.slot}><span>{row.username} · {row.slot} · {row.status} · {row.state}</span>{row.slot!=='admin1'&&<><button disabled={busy} onClick={()=>void run(()=>rename(row))}>아이디 변경</button><button disabled={busy} onClick={()=>{if(window.confirm('기존 세션을 종료하고 임시 비밀번호를 발급할까요?'))void run(async()=>{const r=await passwordCommand({action:'reset',slot:row.slot,requestId:crypto.randomUUID()});setTemporary(r.temporaryPassword);setMessage('비밀번호를 초기화했습니다. 다음 로그인 시 변경해야 합니다.')})}}>비밀번호 초기화</button></>}</li>)}</ul>
 <details><summary>계정 변경 이력</summary><ul>{audit.map(a=><li key={a.id}>{a.created_at} · {a.slot} · {a.action}</li>)}</ul></details></>}</section>
}
