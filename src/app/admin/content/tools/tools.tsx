'use client'

import {NoticeEnglish} from './notice-english'
import {T} from '@/components/LocaleProvider';
import {useRef,useState} from 'react'
import {finalCommand} from '@/lib/admin/final-client'
import {BOARDS} from '@/lib/admin/boards'
type Translation={source:{title:string;body:string};sourceHash:string;revision:number;title:string|null;body:string|null}
export function ContentTools(){


 const [table,setTable]=useState('editor_1_projects'),[id,setId]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[history,setHistory]=useState<Record<string,unknown>[]>([]),[translation,setTranslation]=useState<Translation|null>(null),[title,setTitle]=useState(''),[body,setBody]=useState('')
 const pending=useRef(false),attempt=useRef<{intent:string;requestId:string}|null>(null)
 async function run(task:()=>Promise<void>){if(pending.current)return;pending.current=true;setBusy(true);setMessage('');try{await task()}catch(e){setMessage(e instanceof Error?e.message:'요청 실패')}finally{pending.current=false;setBusy(false)}}
 function recordId(){const n=Number(id);if(!/^\d+$/.test(id)||!Number.isSafeInteger(n))throw Error('게시물 ID를 입력해 주세요.');return n}
 function requestId(intent:string){if(attempt.current?.intent!==intent)attempt.current={intent,requestId:crypto.randomUUID()};return attempt.current.requestId}
 return <section className="space-y-6"><NoticeEnglish/><details className="space-y-4"><summary>기타 콘텐츠 번역 및 변경 이력</summary><h2><T text="번역 검수"/></h2><p><T text="번역은 현재 원문과 연결해 검수합니다. 원문이 수정되면 이전 영문은 공개되지 않습니다."/></p>{message&&<p role="status"><T text={message}/></p>}
 <div className="admin-panel admin-form-grid"><label><T text="콘텐츠"/><select value={table} disabled={busy} onChange={e=>{setTable(e.target.value);setHistory([]);setTranslation(null)}}>{BOARDS.filter((b,i,a)=>a.findIndex(x=>x.table===b.table)===i).map(b=><option key={b.table} value={b.table}><T text={b.name}/></option>)}</select></label><label><T text="게시물 ID"/><input inputMode="numeric" value={id} onChange={e=>{setId(e.target.value);setTranslation(null);setHistory([])}}/></label></div>
 <div className="admin-actions">{table!=='editor_0_noti'&&<button disabled={busy} onClick={()=>void run(async()=>{const data=await finalCommand<Translation>({action:'translation.get',table,id:recordId()});setTranslation(data);setTitle(data.title??'');setBody(data.body??'')})}><T text="원문과 번역 불러오기"/></button>}<button disabled={busy} onClick={()=>void run(async()=>setHistory(await finalCommand({action:'history.list',table,id:recordId()})))}><T text="변경 이력 조회"/></button></div>
 {translation&&table!=='editor_0_noti'&&<form className="admin-panel space-y-4" onSubmit={e=>{e.preventDefault();void run(async()=>{const command={action:'translation.save' as const,table,id:recordId(),revision:translation.revision,sourceHash:translation.sourceHash,title,body};const saved=await finalCommand<{revision:number}>({...command,requestId:requestId(JSON.stringify(command))});setTranslation({...translation,revision:saved.revision,title,body});attempt.current=null;setMessage('영문 검수본을 저장했습니다. 한국어 원문은 보존됩니다.')})}}><h2><T text="한국어 원문"/></h2><p className="font-semibold">{translation.source.title}</p><p className="whitespace-pre-wrap">{translation.source.body}</p><label className="block">English title<input value={title} maxLength={500} required disabled={busy} onChange={e=>setTitle(e.target.value)}/></label><label className="block">English body<textarea value={body} maxLength={40000} disabled={busy} onChange={e=>setBody(e.target.value)}/></label><label className="flex items-center gap-2"><input type="checkbox" required/><T text="날짜·인명·학기·수치·성과가 원문과 일치함을 검수했습니다."/></label><button disabled={busy}><T text="검수한 번역 저장"/></button></form>}
 {history.length>0&&<section className="admin-panel space-y-4"><h2><T text="변경 전후 기록"/></h2>{history.map((h,i)=><details key={i}><summary>{String(h.recorded_at)} · {String(h.operation)}</summary><pre className="whitespace-pre-wrap break-all text-xs">{JSON.stringify({before:h.before_row,after:h.after_row},null,2)}</pre></details>)}</section>}

 </details></section>
}
