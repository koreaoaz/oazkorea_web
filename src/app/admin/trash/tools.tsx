'use client'
import {useEffect,useRef,useState} from 'react'
import {T,useUIText} from '@/components/LocaleProvider'
import {PublicDetailDialog} from '@/components/PublicDetailDialog'
import {BOARDS} from '@/lib/admin/boards'
import {adminCommand} from '@/lib/admin/client'
import {finalCommand} from '@/lib/admin/final-client'
import {trashReview} from '@/lib/admin/trash-client'
import type {TrashRecord} from '@/lib/admin/trash-review'
import {NEWS_EVENT_IDS} from '@/lib/project-activities'

function kind(row:TrashRecord){return row.table==='editor_0_noti'?(row.isPromotion?'홍보':'공지사항'):row.table==='editor_6_events'?(NEWS_EVENT_IDS.includes(row.record_id)?'News':'Project Records'):row.table==='editor_1_projects'?'Project Records':row.table==='editor_2_studies'?'Study Records':row.table==='editor_3_study_timetable'?'시간표':'일정'}
function when(value:string|null|undefined){
 if(!value)return '기록 없음'
 // 날짜만 기록된 원문에 시각을 만들어 붙이지 않는다.
 if(/^\d{4}-\d{2}-\d{2}$/.test(value))return value
 const date=new Date(value)
 return Number.isNaN(date.getTime())?'기록 없음':date.toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})
}
function attachments(value:unknown):string[]{if(typeof value==='string'){try{return attachments(JSON.parse(value))}catch{return [value.split(/[\\/]/).pop()??value]}}if(Array.isArray(value))return value.flatMap(attachments);if(value&&typeof value==='object'&&'filename' in value&&typeof value.filename==='string')return attachments(value.filename);return []}
export function TrashTools(){
 const text=useUIText(),[allowed,setAllowed]=useState<string[]>([]),[table,setTable]=useState(''),[rows,setRows]=useState<TrashRecord[]>([]),[search,setSearch]=useState(''),[filter,setFilter]=useState('all'),[order,setOrder]=useState('desc'),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[detail,setDetail]=useState<TrashRecord|null>(null),[history,setHistory]=useState<Record<string,unknown>[]>([]),pending=useRef(false),retry=useRef<{intent:string;id:string}|null>(null)
 useEffect(()=>{let live=true;void adminCommand({action:'session',version:0}).then(value=>{const s=value as {role:string;scopes:string[];promotion?:{manualEdit:boolean}};if(live){const tables=BOARDS.filter(b=>s.role==='SUPER_ADMIN'||s.scopes.includes(b.table)||(b.table==='editor_0_noti'&&s.promotion?.manualEdit)).map(b=>b.table);setAllowed(tables);setTable(tables[0]??'')}}).catch(()=>{if(live)setMessage('현재 권한을 확인하지 못했습니다.')});return()=>{live=false}},[])
 async function run(task:()=>Promise<void>){if(pending.current)return;pending.current=true;setBusy(true);setMessage('');try{await task()}catch(e){setMessage(e instanceof Error?e.message:'요청 실패')}finally{pending.current=false;setBusy(false)}}
 async function load(){setRows(await trashReview<TrashRecord[]>({action:'list',table}))}
 async function restore(r:TrashRecord){if(!confirm(text('원래 ID로 복구할까요? 같은 ID가 사용 중이면 복구하지 않습니다.')))return;const intent=r.id+':'+r.revision;if(retry.current?.intent!==intent)retry.current={intent,id:crypto.randomUUID()};await finalCommand({action:'trash.restore',table:r.table,trashId:r.id,revision:r.revision,requestId:retry.current.id});retry.current=null;setDetail(null);await load();setMessage('원래 ID로 복구했습니다.')}
 const detailTrigger=useRef<HTMLButtonElement|null>(null)
 const detailAttachments=attachments(detail?.attachments)
 const shown=rows.filter(r=>(filter==='all'||kind(r)===filter)&&(`${r.title} ${r.record_id}`).toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())).sort((a,b)=>(order==='desc'?1:-1)*(Date.parse(b.deleted_at)-Date.parse(a.deleted_at)))
 return <section data-trash-review className="space-y-5"><h1><T text="휴지통"/></h1><p><T text="휴지통은 최소 90일 보관합니다. 원래 ID와 변경 이력을 유지하며 파일과 백업을 자동 삭제하지 않습니다."/></p>
 <div className="admin-panel admin-form-grid"><label><T text="콘텐츠"/><select value={table} disabled={busy} onChange={e=>{setTable(e.target.value);setRows([]);setHistory([]);setDetail(null);setFilter('all')}}>{BOARDS.filter((b,i,a)=>allowed.includes(b.table)&&a.findIndex(x=>x.table===b.table)===i).map(b=><option key={b.table} value={b.table}><T text={b.table==='editor_0_noti'?'공지·홍보':b.name}/></option>)}</select></label>
 <label><T text="제목 또는 ID 검색"/><input value={search} onChange={e=>setSearch(e.target.value)}/></label><label><T text="게시판 구분"/><select value={filter} onChange={e=>setFilter(e.target.value)}><option value="all"><T text="전체"/></option>{[...new Set(rows.map(kind))].map(k=><option key={k}>{k}</option>)}</select></label><label><T text="삭제 날짜 정렬"/><select value={order} onChange={e=>setOrder(e.target.value)}><option value="desc"><T text="최신순"/></option><option value="asc"><T text="오래된순"/></option></select></label></div>
 <button disabled={busy||!table} onClick={()=>void run(load)}><T text="휴지통 조회"/></button><p className="text-sm text-slate-500"><T text="테스트 출처가 확인된 항목을 제외한 최근 100건을 조회합니다."/></p><p data-trash-count className="text-sm text-slate-500">{text('검색 결과 {0}건 / 조회 {1}건').replace('{0}',String(shown.length)).replace('{1}',String(rows.length))}</p>{message&&<p role="status"><T text={message}/></p>}
 {shown.map(r=><article data-trash-row key={r.id} className="admin-panel space-y-3"><p className="text-sm text-slate-500">{kind(r)} · #{r.record_id}</p><h2 className="break-words">{r.title||text('제목 기록 없음')}</h2><p><T text="삭제 일시"/>: {when(r.deleted_at)} (KST)</p><p><T text={r.restored_at?'복구됨':'삭제됨'}/> · <T text={r.restorable?'복구 가능':'복구 불가 · 현재 상태 확인 필요'}/></p><div className="admin-actions">
 <button disabled={busy} onClick={e=>{detailTrigger.current=e.currentTarget;void run(async()=>setDetail(await trashReview<TrashRecord>({action:'detail',table:r.table,trashId:r.id})))}}><T text="상세보기"/></button><button disabled={busy||!r.restorable} onClick={()=>void run(()=>restore(r))}><T text="복구"/></button><button disabled={busy} onClick={()=>void run(async()=>setHistory(await finalCommand({action:'history.list',table:r.table,id:r.record_id})))}><T text="변경 이력 조회"/></button></div></article>)}
 {detail&&<PublicDetailDialog returnFocusRef={detailTrigger} title={detail.title||text('제목 기록 없음')} onClose={()=>setDetail(null)}><div data-trash-detail className="space-y-4 break-words"><p>{kind(detail)} · #{detail.record_id}</p><p><T text="공개 날짜 기록"/>: {when(detail.publicationDate)}</p><p><T text="삭제 일시"/>: {when(detail.deleted_at)}</p><p><T text="최소 보관 기한"/>: {when(detail.retain_until)}</p><section><h3><T text="원래 본문"/></h3><p className="mt-3 whitespace-pre-wrap [overflow-wrap:anywhere]">{detail.body||text('본문 기록 없음')}</p></section><section><h3><T text="첨부 정보"/></h3><ul>{detailAttachments.map((a,i)=><li className="break-all" key={i}>{a}</li>)}</ul>{!detailAttachments.length&&<p><T text="첨부 기록 없음"/></p>}<p className="mt-2 text-sm"><T text="첨부 이름만 표시합니다. 원본 다운로드 권한은 변경하지 않습니다."/></p></section><p className="rounded-lg bg-slate-50 p-3 text-sm"><T text="복구하면 원래 ID와 내용이 돌아옵니다. 같은 ID의 글이 있거나 권한·버전이 바뀌면 복구하지 않습니다. 공개 게시판의 글은 복구 후 다시 표시될 수 있으므로 본문과 첨부를 확인해 주세요."/></p><button disabled={busy||!detail.restorable} onClick={()=>void run(()=>restore(detail))}><T text="복구"/></button></div></PublicDetailDialog>}
 {history.length>0&&<section className="admin-panel"><h2><T text="변경 전후 기록"/></h2>{history.map((h,i)=><details key={i}><summary>{String(h.recorded_at)} · {String(h.operation)}</summary><pre className="whitespace-pre-wrap break-all text-xs">{JSON.stringify({before:h.before_row,after:h.after_row},null,2)}</pre></details>)}</section>}</section>
}
