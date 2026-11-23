'use client'

import {AdminSessionLoading} from '@/components/AdminSessionLoading'
import {T,useUIText} from '@/components/LocaleProvider';
import {useEffect,useState} from 'react'
import {adminCommand} from '@/lib/admin/client'

type Event={request_id:string;actor_slot:string|null;committed_at:string;action:string;target_table:string|null;record_id:number|null;target_slot:string|null;changed_fields:string[];before_status?:string|null;after_status?:string|null}
const tables:Record<string,string>={editor_0_noti:'공지',editor_1_projects:'프로젝트',editor_2_studies:'스터디',editor_3_study_timetable:'시간표',editor_4_schedules:'일정',editor_6_events:'행사',editor_5_donators:'명예의 전당'}
const actions:Record<string,string>={'content.create':'작성','content.update':'수정','content.delete':'삭제','order.save':'순서 저장','accounts.upsert':'관리자 정보·권한 변경','accounts.prepare':'관리자 생성 준비','accounts.complete':'관리자 생성 완료','admins.assign':'관리자 상태 변경','honor.create':'명예의 전당 원본 추가','honor.save':'명예의 전당 표시 이름 수정','honor.approve':'명예의 전당 공개 승인','honor.revoke':'명예의 전당 공개 회수','honor.order':'명예의 전당 순서 저장'}
const statuses:Record<string,string>={draft:'미승인',approved:'공개 중',revoked:'승인 회수',scheduled:'공개 예정',active:'활성',disabled:'비활성'}
export function AdminActivity(){
 const uiText=useUIText();

 const [rows,setRows]=useState<Event[]>([]),[error,setError]=useState(''),[loading,setLoading]=useState(true),[filter,setFilter]=useState('all'),[page,setPage]=useState(0)
 useEffect(()=>{let active=true;void(async()=>{try{const s=await adminCommand({action:'session',version:0}) as {version:number};const result=await adminCommand({action:'audit.list',version:s.version});if(!Array.isArray(result))throw Error();if(active)setRows(result)}catch{if(active)setError('이력을 불러오지 못했습니다. 추가 인증과 최고관리자 권한을 확인해 주세요.')}finally{if(active)setLoading(false)}})();return()=>{active=false}},[])
 if(loading)return <AdminSessionLoading/>
 const filtered=rows.filter(e=>filter==='all'||(filter==='honor'?e.action.startsWith('honor.'):filter==='accounts'?e.action.startsWith('accounts.')||e.action.startsWith('admins.'):e.action.startsWith('content.')||e.action.startsWith('order.')))
 const visible=filtered.slice(page*10,(page+1)*10)
 return <section className="space-y-5"><div><h1><T text="관리자 작업 이력"/></h1><p className="mt-2 text-sm text-zinc-600"><T text="최근 확정된 100건을 조회합니다. 비밀번호·토큰·콘텐츠 본문은 표시하지 않습니다."/></p></div>
 <div className="admin-actions"><label><T text="작업 유형"/><select value={filter} onChange={e=>{setFilter(e.target.value);setPage(0)}}><option value="all"><T text="전체 작업"/></option><option value="content"><T text="콘텐츠"/></option><option value="accounts"><T text="관리자 계정"/></option><option value="honor"><T text="명예의 전당"/></option></select></label><span className="text-sm text-zinc-500">{filtered.length}<T text="건 · 페이지당 10건"/></span></div>
 {error&&<p role="alert"><T text={error}/></p>}{!loading&&!error&&!filtered.length&&<p className="admin-panel"><T text="해당하는 작업 이력이 없습니다."/></p>}
 <div className="space-y-3">{visible.map(e=><article key={e.request_id} className="admin-panel space-y-3" data-action={e.action}><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="!text-base"><T text={e.action.startsWith('content.')?`${tables[e.target_table??'']??'콘텐츠'} `:''}/><T text={actions[e.action]??'관리 작업'}/></h2><span className="admin-badge"><T text="확정 완료"/></span></div><dl className="admin-form-grid text-sm"><div><dt className="text-zinc-500"><T text="작업 시각"/></dt><dd><time dateTime={e.committed_at}>{new Date(e.committed_at).toLocaleString('ko-KR')}</time></dd></div><div><dt className="text-zinc-500"><T text="관리자 계정"/></dt><dd><T text={e.actor_slot??'기존 관리자'}/></dd></div><div><dt className="text-zinc-500"><T text="대상"/></dt><dd><T text={e.target_slot??`${tables[e.target_table??'']??'관리 항목'}${e.record_id?` #${e.record_id}`:''}`}/></dd></div><div><dt className="text-zinc-500"><T text="변경 내용"/></dt><dd>{e.changed_fields.length}<T text="개 항목"/><T text={e.before_status||e.after_status?` · ${statuses[e.before_status??'']??'없음'} → ${statuses[e.after_status??'']??'없음'}`:''}/></dd></div></dl></article>)}</div>
 {!!filtered.length&&<nav className="admin-actions" aria-label={uiText("작업 이력 페이지")}><button disabled={page===0} onClick={()=>setPage(p=>p-1)}><T text="이전"/></button><span aria-live="polite">{page+1} / {Math.ceil(filtered.length/10)}{' '}<T text="페이지"/></span><button disabled={(page+1)*10>=filtered.length} onClick={()=>setPage(p=>p+1)}><T text="다음"/></button></nav>}
 </section>
}
