'use client'

import {RecordSectionEditor} from '@/components/RecordSectionEditor'
import {TechPicker} from '@/components/projects/TechPicker'
import {T,useUIText} from '@/components/LocaleProvider';
import { useEffect, useRef, useState } from 'react'
import { adminCommand } from '@/lib/admin/client'
import { supabase } from '@/lib/supabaseClient'
import type { AdminCommand } from '@/lib/admin/protocol'
import {AdminShell} from './shell'
import {CATEGORY_OPTIONS} from '@/app/editor/constants'
import {MediaEditor} from './media-editor'
import {MEDIA_BUCKETS} from '@/lib/admin/media-upload'

type Session = { role: 'SUPER_ADMIN' | 'ADMIN'; slot: string; version: number; schemaVersion: number; contentReady:boolean; lifecycleVersion?:number;scopes?:string[] }
type Assignment = { slot: string; user_id: string; role: string; status: string; revision: number }
type Row = Record<string, unknown> & { id: number; _revision: number }
const boards = [
  ['editor_0_noti','공지','text','description'], ['editor_1_projects','프로젝트','project_name','description'],
  ['editor_2_studies','스터디','study_name','outline'], ['editor_3_study_timetable','시간표','study_name','leader'],
  ['editor_4_schedules','일정','description','start_date'], ['editor_6_events','행사','title','description'],
] as const
export function AdminWorkspace() {
 const uiText=useUIText();

  const [session, setSession] = useState<Session | null>(null), [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false), pending = useRef(false)
  const [failed,setFailed]=useState(false)
  const [assignments, setAssignments] = useState<Assignment[]>([]), [audit, setAudit] = useState<Record<string, unknown>[]>([])
  const [slot, setSlot] = useState('admin2'), [uid, setUid] = useState(''), [status, setStatus] = useState<'active'|'disabled'>('active')
  const [board, setBoard] = useState<string>(boards[0][0]), [rows, setRows] = useState<Row[]>([])
  const [editing, setEditing] = useState<Row | null>(null), [title, setTitle] = useState(''), [body, setBody] = useState('')
  const [year,setYear]=useState(new Date().getFullYear()),[semester,setSemester]=useState(1)
  const [day,setDay]=useState('월요일'),[startTime,setStartTime]=useState('11:00'),[endTime,setEndTime]=useState('12:00'),[endDate,setEndDate]=useState('')
  const [orderRevision, setOrderRevision] = useState(0), [orderIds, setOrderIds] = useState<number[]>([])
  const [details,setDetails]=useState<Record<string,unknown>>({})
  const [dirty,setDirty]=useState(false)
  useEffect(()=>{if(!dirty)return;const leave=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue=''};window.addEventListener('beforeunload',leave);return()=>window.removeEventListener('beforeunload',leave)},[dirty])
  function discard(){return !dirty||window.confirm(uiText('저장하지 않은 변경사항이 있습니다. 버리고 계속할까요?'))}
  function resetForm(){setEditing(null);setTitle('');setBody('');setDetails({});setDirty(false)}
  function chooseBoard(value:string){if(!discard())return;setBoard(value);setRows([]);setOrderIds([]);resetForm()}
  const descriptor = boards.find(b => b[0] === board) ?? boards[0]
  const retryRequest = useRef<{ serialized: string; id: string } | null>(null)
  useEffect(() => {
    let active = true
    let timer:ReturnType<typeof setTimeout>|undefined
    const load=()=>adminCommand({ action: 'session', version: 0 }).then(result => { if (active) {const value=result as Session;setSession(value);if(value.role!=='SUPER_ADMIN'&&value.scopes?.length&&!value.scopes.includes(board))setBoard(value.scopes[0])} })
      .catch(() => { if (active) setMessage('로그인 또는 활성 관리자 권한을 확인해 주세요.') })
    void load()
    const { data } = supabase.auth.onAuthStateChange((event, current) => {
      if (active && (!current || event==='SIGNED_IN' || event==='PASSWORD_RECOVERY')) {
        setSession(null); setRows([]); setAssignments([]); setAudit([]); setOrderIds([])
      }
      if(active&&current){if(timer)clearTimeout(timer);timer=setTimeout(()=>void load(),0)}
    })
    return () => { active = false;if(timer)clearTimeout(timer); data.subscription.unsubscribe() }
  // 최초 진입과 인증 갱신에만 구독을 관리한다.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  async function run(task: () => Promise<void>) {
    if (pending.current) return
    pending.current = true; setBusy(true); setMessage('');setFailed(false)
    try { await task() } catch (e) { setFailed(true);setMessage(e instanceof Error ? e.message : '요청을 확인하지 못했습니다.') }
    finally { pending.current = false; setBusy(false) }
  }
  async function fresh() { const value = await adminCommand({ action: 'session', version: 0 }) as Session; setSession(value); return value }
  async function mutate(command: Omit<AdminCommand,'requestId'>) {
    const serialized = JSON.stringify(command)
    if (retryRequest.current?.serialized !== serialized) retryRequest.current = { serialized, id: crypto.randomUUID() }
    const result = await adminCommand({ ...command, requestId: retryRequest.current.id })
    retryRequest.current = null
    return result
  }
  async function reload() {
    const current = await fresh()
    const list = await adminCommand({ action: 'content.list', version: current.version, table: board }) as Row[]
    setRows(list)
    const order = await adminCommand({ action: 'order.list', version: current.version, table: board }) as { revision: number; ids: number[] }
    setOrderRevision(order.revision); setOrderIds(order.ids)
  }
  async function management() {
    const current = await fresh()
    setAssignments(await adminCommand({ action: 'admins.list', version: current.version }) as Assignment[])
    setAudit(await adminCommand({ action: 'audit.list', version: current.version }) as Record<string, unknown>[])
  }
  if (!session) return <main className="p-8 space-y-4"><h1><T text="관리자 권한 확인"/></h1><a href="/admin/login"><T text="관리자 로그인"/></a>{message && <p role="alert"><T text={message}/></p>}</main>
  return <AdminShell slot={session.slot} superAdmin={session.role==='SUPER_ADMIN'}><div className="space-y-8">
    <h1 className="text-2xl font-bold"><T text="관리자 작업 공간"/></h1><p>{session.slot} · <T text={session.role === 'SUPER_ADMIN' ? '최고관리자' : '일반관리자'}/></p>
    <section className="space-y-4" aria-label={uiText("콘텐츠 관리 바로가기")}><h2><T text="콘텐츠 관리"/></h2><p className="text-sm text-zinc-600"><T text="편집할 항목을 선택하세요. 권한이 있는 콘텐츠만 표시됩니다."/></p><div className="admin-grid">{boards.filter(b=>session.role==='SUPER_ADMIN'||!session.scopes||session.scopes.includes(b[0])).map(b=><button key={b[0]} disabled={busy} className="admin-card" onClick={()=>{chooseBoard(b[0]);document.getElementById('content-editor')?.scrollIntoView({behavior:'smooth'})}}><strong>{b[1]}</strong><p>{({'editor_0_noti':'학회 소식을 작성하고 공개합니다.','editor_1_projects':'프로젝트 기록과 대표 이미지를 관리합니다.','editor_2_studies':'스터디 소개와 활동 이미지를 관리합니다.','editor_3_study_timetable':'학회실 사용 요일과 시간을 관리합니다.','editor_4_schedules':'중요한 날짜와 기간을 관리합니다.','editor_6_events':'행사 기록과 여러 이미지를 관리합니다.'} as Record<string,string>)[b[0]]}</p><span><T text="콘텐츠 편집 →"/></span></button>)}</div></section>
    {session.role==='SUPER_ADMIN'&&<section className="space-y-4"><h2><T text="운영 관리"/></h2><div className="admin-grid">{[['/admin/accounts','관리자 계정 관리','독립 계정의 상태와 콘텐츠 편집 권한'],['/admin/honor','명예의 전당','공개 표시 이름의 동의 확인과 승인·회수'],['/admin/activity','전체 작업 이력','관리자 작업과 변경 결과 확인']].map(([href,name,description])=><a className="admin-card" href={href} key={href}><strong><T text={name}/></strong><p><T text={description}/></p><span><T text="관리 화면 열기 →"/></span></a>)}</div></section>}
    {message && <p role={failed?'alert':'status'}><T text={message}/></p>}
    {session.role==='ADMIN'&&session.scopes?.length===0?<p role="status"><T text="현재 배정된 편집 범위가 없습니다. 최고관리자에게 문의하세요."/></p>:<section id="content-editor" className="space-y-5 scroll-mt-24"><h2 className="text-xl"><T text="콘텐츠 편집"/></h2>
      <p className="text-sm text-zinc-600"><T text="기본 정보 저장 후 이미지를 연결할 수 있습니다. 기존"/><a className="underline" href="/editor"><T text="전체 편집기"/></a><T text="도 계속 이용할 수 있습니다."/></p>
      {!session.contentReady && <p role="status"><T text="쓰기 전환이 준비되지 않았습니다. 변경 요청은 서버에서 거부됩니다."/></p>}
      <div className="admin-tabs" aria-label={uiText("콘텐츠 빠른 선택")}>{boards.filter(b=>session.role==='SUPER_ADMIN'||!session.scopes||session.scopes.includes(b[0])).map(b=><button key={b[0]} disabled={busy} aria-pressed={board===b[0]} onClick={()=>chooseBoard(b[0])}>{b[1]}</button>)}</div>
      <select aria-label={uiText("콘텐츠 종류")} disabled={busy} value={board} onChange={e => chooseBoard(e.target.value)}>{boards.filter(b=>session.role==='SUPER_ADMIN'||!session.scopes||session.scopes.includes(b[0])).map(b => <option key={b[0]} value={b[0]}>{b[1]}</option>)}</select>
      <div className="admin-actions"><button disabled={busy} onClick={()=>{if(discard()){resetForm();document.getElementById('content-title')?.focus()}}}><T text="새 콘텐츠 작성"/></button><button disabled={busy} onClick={() => void run(reload)}><T text="목록 새로고침"/></button><span className="text-sm text-zinc-500">{rows.length}<T text="개 불러옴"/></span></div>
      {busy&&<p role="status"><T text="요청을 처리하는 중… 입력 내용은 유지됩니다."/></p>}
      {!busy&&rows.length===0&&<p className="text-sm text-slate-500"><T text="불러온 게시물이 없습니다. 목록을 새로고침하거나 새 글을 작성하세요."/></p>}
      <ul className="admin-records">{rows.map(row => <li key={row.id} className="admin-record"><span>{String(row[descriptor[2]] ?? '')}</span>
        <button disabled={busy} onClick={() => { if(!discard())return;setDetails(row);setDirty(false);setEditing(row); setTitle(String(row[descriptor[2]] ?? '')); setBody(String(row[descriptor[3]] ?? ''));setYear(Number(row.year)||new Date().getFullYear());setSemester(Number(row.semester)||1);setDay(String(row.start_time??'월요일 11:00').split(' ')[0]);setStartTime(String(row.start_time??'월요일 11:00').split(' ')[1]);setEndTime(String(row.end_time??'월요일 12:00').split(' ')[1]);setEndDate(String(row.end_date??'')) }}><T text="수정"/></button>
        <button disabled={busy} onClick={() => { if (window.confirm(uiText('이 게시물을 삭제할까요?'))) void run(async () => { const s=await fresh(); await mutate({ action:'content.delete',version:s.version,table:board,id:row.id,revision:row._revision }); setMessage('삭제되었습니다. 목록을 확인해 주세요.'); await reload() }) }}><T text="삭제"/></button>
      </li>)}</ul>
      <form className="admin-panel space-y-5" onChange={()=>setDirty(true)} onSubmit={e => { e.preventDefault(); void run(async () => {
        const current=await fresh()
        if(board==='editor_3_study_timetable'&&startTime>=endTime)throw new Error('종료 시간은 시작 시간보다 뒤여야 합니다.')
        if(board==='editor_4_schedules'&&(!body||!endDate||body>endDate))throw new Error('일정의 시작일과 종료일을 확인해 주세요.')
        const extra=board==='editor_1_projects'||board==='editor_2_studies'?{year,semester}:board==='editor_3_study_timetable'?{start_time:`${day} ${startTime}`,end_time:`${day} ${endTime}`,color:typeof editing?.color==='string'?editing.color:'#334155'}:board==='editor_4_schedules'?{end_date:endDate}:{}
        const extended:Record<string,unknown>={}
        const fields=board==='editor_1_projects'?['duration','category','team_size','members','detailed_description','tech_stack']:board==='editor_2_studies'?['leader']:[]
        for(const field of fields)if(details[field]!==undefined)extended[field]=details[field]
        await mutate({ action:editing?'content.update':'content.create',version:current.version,table:board,
          ...(editing?{id:editing.id,revision:editing._revision}:{}),payload:{[descriptor[2]]:title.trim(),[descriptor[3]]:body,...extra,...extended} })
        resetForm(); setMessage('저장되었습니다. 목록을 확인해 주세요.'); await reload()
      }) }}>
        <div className="flex flex-wrap justify-between gap-3"><h3>{descriptor[1]} <T text={editing?'수정':'새로 작성'}/></h3>{dirty&&<span className="text-sm text-zinc-500"><T text="저장하지 않은 변경사항"/></span>}</div>
        <label className="block"><T text="제목 또는 이름"/><input id="content-title" required disabled={busy} value={title} onChange={e=>setTitle(e.target.value)} /></label>
        {board==='editor_2_studies'?<RecordSectionEditor kind="study" seed={editing?{id:editing.id,title:String(editing.study_name??''),original:String(editing.outline??'')}:undefined} value={body} onChange={setBody} disabled={busy}/>:<label className="block"><T text={board==='editor_4_schedules'?'시작일':board==='editor_3_study_timetable'?'스터디 담당자':'내용'}/>{board==='editor_4_schedules'?<input type="date" required disabled={busy} value={body} onChange={e=>setBody(e.target.value)}/>:<textarea disabled={busy} value={body} onChange={e=>setBody(e.target.value)} />}</label>}
        {(board==='editor_1_projects'||board==='editor_2_studies')&&<div className="flex gap-4"><label><T text="연도"/><input type="number" min={2000} max={2100} value={year} disabled={busy} onChange={e=>setYear(Number(e.target.value))} required/></label><label><T text="학기"/><select value={semester} disabled={busy} onChange={e=>setSemester(Number(e.target.value))}><option value={1}><T text="1학기"/></option><option value={2}><T text="2학기"/></option></select></label></div>}
        {board==='editor_2_studies'&&<label className="block"><T text="스터디장"/><input disabled={busy} value={String(details.leader??'')} onChange={e=>setDetails(d=>({...d,leader:e.target.value}))}/></label>}
        {board==='editor_1_projects'&&<><div className="admin-form-grid"><label><T text="기간"/><input disabled={busy} value={String(details.duration??'')} onChange={e=>setDetails(d=>({...d,duration:e.target.value}))}/></label><label><T text="분류"/><select disabled={busy} value={String(details.category??'')} onChange={e=>setDetails(d=>({...d,category:e.target.value}))}><option value=""><T text="선택 안 함"/></option>{CATEGORY_OPTIONS.map(c=><option key={c}>{c}</option>)}{details.category&&!CATEGORY_OPTIONS.some(c=>c===details.category)?<option>{String(details.category)}</option>:null}</select></label><label><T text="팀 규모"/><input type="number" min={1} disabled={busy} value={String(details.team_size??'')} onChange={e=>setDetails(d=>({...d,team_size:e.target.value===''?null:Number(e.target.value)}))}/></label><label><T text="팀원 (쉼표 구분)"/><input disabled={busy} value={String(details.members??'')} onChange={e=>setDetails(d=>({...d,members:e.target.value}))}/></label></div><RecordSectionEditor kind="project" seed={editing?{id:editing.id,title:String(editing.project_name??''),summary:String(editing.description??''),original:String(editing.detailed_description??'')}:undefined} value={String(details.detailed_description??'')} onChange={v=>setDetails(d=>({...d,detailed_description:v}))} disabled={busy}/><TechPicker value={details.tech_stack} descriptions={[details.project_name,details.description,details.detailed_description]} disabled={busy} onChange={next=>setDetails(d=>({...d,tech_stack:next}))}/></>}
        {board==='editor_3_study_timetable'&&<div className="flex flex-wrap gap-4"><label><T text="요일"/><select disabled={busy} value={day} onChange={e=>setDay(e.target.value)}>{['월요일','화요일','수요일','목요일','금요일','토요일'].map(d=><option key={d}>{d}</option>)}</select></label><label><T text="시작"/><input type="time" step={1800} min="09:00" max="22:30" required disabled={busy} value={startTime} onChange={e=>setStartTime(e.target.value)}/></label><label><T text="종료"/><input type="time" step={1800} min="09:30" max="23:00" required disabled={busy} value={endTime} onChange={e=>setEndTime(e.target.value)}/></label></div>}
        {board==='editor_4_schedules'&&<label><T text="종료일"/><input type="date" disabled={busy} required value={endDate} onChange={e=>setEndDate(e.target.value)}/></label>}
        <button disabled={busy || !title.trim()} type="submit"><T text={editing?'수정 저장':'새 글 저장'}/></button>
        <button disabled={busy} type="button" onClick={()=>{if(discard())resetForm()}}><T text="취소"/></button>
      </form>
      {editing&&MEDIA_BUCKETS[board]&&<MediaEditor key={`${board}:${editing.id}:${editing._revision}`} table={board} row={editing} onSaved={async()=>{await reload();resetForm();setMessage('이미지 연결을 저장했습니다.')}}/>}
      <h3><T text="게시판 전체 순서"/></h3><p><T text="고유 ID를 유지하며 이 게시판 전체 순서를 저장합니다."/></p>
      {orderIds.map((id,index)=><div key={id}>#{id} <button disabled={busy||index===0} onClick={()=>setOrderIds(ids=>{const next=[...ids];[next[index-1],next[index]]=[next[index],next[index-1]];return next})}><T text="위로"/></button></div>)}
      <button disabled={busy||!orderIds.length} onClick={()=>void run(async()=>{const s=await fresh();await mutate({action:'order.save',version:s.version,table:board,revision:orderRevision,ids:orderIds});await reload();setMessage('순서가 저장되었습니다.')})}><T text="순서 저장"/></button>
    </section>}
    {session.role==='SUPER_ADMIN' && session.lifecycleVersion!==3 && <section className="space-y-3"><h2 className="text-xl"><T text="관리자 관리"/></h2>
      <button disabled={busy} onClick={()=>void run(management)}><T text="관리자와 최근 이력 조회"/></button>
      <ul>{assignments.map(a=><li key={a.slot}>{a.slot} · {a.role} · {a.status} · {a.user_id}</li>)}</ul>
      <p><T text="이미 본인 확인된 독립 계정의 UUID를 등록합니다. 이메일 일치로 기존 계정을 연결하지 않습니다."/></p>
      <select disabled={busy} value={slot} onChange={e=>setSlot(e.target.value)}>{['admin2','admin3','admin4','admin5'].map(s=><option key={s}>{s}</option>)}</select>
      <label><T text="확인된 사용자 UUID"/><input disabled={busy} value={uid} onChange={e=>setUid(e.target.value)} /></label>
      <select disabled={busy} value={status} onChange={e=>setStatus(e.target.value as 'active'|'disabled')}><option value="active"><T text="활성"/></option><option value="disabled"><T text="비활성"/></option></select>
      <button disabled={busy||!uid||!assignments.length} onClick={()=>void run(async()=>{const s=await fresh();await mutate({action:'admins.assign',version:s.version,slot,userId:uid,status,revision:assignments.find(a=>a.slot===slot)?.revision??0});setUid('');await management();setMessage('관리자 상태가 변경되었습니다.')})}><T text="등록·상태 변경"/></button>
      <p><T text="새 계정 초대는 아직 활성화되지 않았습니다. 최고관리자 작업에는 추가 인증이 필요합니다."/></p>
      <ul>{audit.map(e=><li key={String(e.request_id)}>{String(e.committed_at)} · {String(e.actor_id)} · {String(e.action)} · {String(e.result)}</li>)}</ul>
    </section>}
    <section id="account" className="admin-panel admin-account-summary space-y-3"><h2><T text="내 계정"/></h2><p>{session.slot} · <T text={session.role==='SUPER_ADMIN'?'최고관리자':'일반관리자'}/></p><p className="text-sm text-zinc-600"><T text={session.role==='SUPER_ADMIN'?'전체 콘텐츠 편집과 추가 인증이 필요한 운영 관리가 가능합니다.':`현재 편집 범위: ${boards.filter(b=>!session.scopes||session.scopes.includes(b[0])).map(b=>b[1]).join(', ')||'없음'}`}/></p><p className="text-sm text-zinc-600"><T text="권한은 매 요청마다 서버에서 다시 확인합니다. 계정 정보 변경은 최고관리자에게 문의하세요."/></p></section>
  </div></AdminShell>
}
