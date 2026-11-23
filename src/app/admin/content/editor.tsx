'use client'
import {RecordSectionEditor} from '@/components/RecordSectionEditor'
import {TechPicker} from '@/components/projects/TechPicker'
import {DocumentTools} from './tools/documents'

import {T,useUIText} from '@/components/LocaleProvider';
import {useEffect,useRef,useState} from 'react'
import {useRouter} from 'next/navigation'
import type {BOARDS,ChangeCategory} from '@/lib/admin/boards'
import {CATEGORY_OPTIONS} from '@/app/editor/constants'
import {Classification} from '../classification'
import {useUnsavedChanges} from '../unsaved'
import {adminCommand} from '@/lib/admin/client'
import {MediaEditor,type MediaEditorHandle} from '../media-editor'
import {MEDIA_BUCKETS} from '@/lib/admin/media-upload'
export type ContentRow=Record<string,unknown>&{id:number;_revision:number}
type Board=typeof BOARDS[number]
export function ContentEditor({board,row,onMediaSaved}:{board:Board;row?:ContentRow;onMediaSaved:()=>Promise<void>}){
 const uiText=useUIText();

 const router=useRouter(),[values,setValues]=useState<Record<string,unknown>>(()=>({...row,is_noti:row?row.is_noti:board.slug!=='promotions',year:row?.year??new Date().getFullYear(),semester:row?.semester??null,start_time:row?.start_time??'월요일 11:00',end_time:row?.end_time??'월요일 12:00',color:row?.color??'#334155'}))
 const [dirty,setDirty]=useState(false),[mediaDirty,setMediaDirty]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[category,setCategory]=useState<ChangeCategory>('content'),[reason,setReason]=useState('')
 const pending=useRef(false),attempt=useRef<{intent:string;command:Parameters<typeof adminCommand>[0]}|null>(null)
 const mediaRef=useRef<MediaEditorHandle>(null),mounted=useRef(true)
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false}},[])
 useUnsavedChanges(dirty||mediaDirty)
 const update=(key:string,value:unknown)=>{setValues(v=>({...v,[key]:value}));setDirty(true)}
 const field=(key:string,label:string,type='text',required=false)=><label className="block" key={key}><T text={label}/>{type==='textarea'?<textarea name={key} disabled={busy} value={String(values[key]??'')} onChange={e=>update(key,e.target.value)} required={required}/>:<input disabled={busy} name={key} type={type} value={String(values[key]??'')} onChange={e=>update(key,type==='number'?(e.target.value===''?null:Number(e.target.value)):e.target.value)} required={required}/>}</label>
 async function save(e:React.FormEvent){e.preventDefault();if(pending.current)return;if(row&&mediaDirty&&!window.confirm(uiText('저장하지 않은 이미지 연결이 있습니다. 본문을 저장하고 상세 화면으로 이동할까요?')))return;pending.current=true;setBusy(true);setError('');try{
  if(board.slug==='timetable'&&(String(values.start_time).split(' ')[0]!==String(values.end_time).split(' ')[0]||String(values.start_time).split(' ')[1]>=String(values.end_time).split(' ')[1]))throw Error('같은 요일에서 종료 시간이 시작 시간보다 뒤여야 합니다.')
  if(board.slug==='schedules'&&(!values.start_date||!values.end_date||String(values.start_date)>String(values.end_date)))throw Error('시작일과 종료일을 확인해 주세요.')
  if(['projects','studies'].includes(board.slug)&&![1,2].includes(Number(values.semester)))throw Error('근거가 확인된 학기를 선택해 주세요.');
  const media=!row&&MEDIA_BUCKETS[board.table]?await mediaRef.current?.prepare():undefined
  if(!mounted.current)return
  const keys=board.slug==='projects'?['project_name','description','duration','category','team_size','members','detailed_description','tech_stack','year','semester','github_url']:board.slug==='studies'?['study_name','leader','outline','year','semester']:board.slug==='timetable'?['study_name','leader','start_time','end_time','color']:board.slug==='schedules'?['description','start_date','end_date']:board.slug==='events'?['title','description']:['text','description','is_noti']
  const payload=Object.fromEntries(keys.filter(k=>values[k]!==undefined).map(k=>[k,values[k]]));if(media)Object.assign(payload,media);payload[board.title]=String(payload[board.title]??'').trim();if(!payload[board.title])throw Error('제목 또는 이름을 입력해 주세요.')
  const s=await adminCommand({action:'session',version:0}) as {version:number};const command={action:row?'content.update' as const:'content.create' as const,version:s.version,table:board.table,...(row?{id:row.id,revision:row._revision}:{}),payload,...(row?{changeCategory:category,changeReason:reason}:{})};const intent=JSON.stringify({...command,version:0});if(attempt.current?.intent!==intent)attempt.current={intent,command:{...command,requestId:crypto.randomUUID()}};const result=await adminCommand(attempt.current.command) as {id:number};setDirty(false);setMediaDirty(false);router.push(`/admin/content/${board.slug}/${row?.id??result.id}?saved=1`);router.refresh()
 }catch(e){setError(e instanceof Error?e.message:'저장하지 못했습니다.');setBusy(false)}finally{pending.current=false}}
 return <div className="space-y-6"><form onSubmit={e=>void save(e)} className="admin-panel space-y-5"><h2><T text={row?'콘텐츠 수정':'신규 작성'}/></h2>{error&&<p role="alert"><T text={error}/></p>}{dirty&&<p className="text-sm text-zinc-500"><T text="저장하지 않은 변경사항"/></p>}
 {field(board.title,board.slug==='projects'?'프로젝트명':board.slug==='studies'?'스터디명':board.slug==='schedules'?'일정 제목과 상세 안내 (첫 줄은 제목)':'제목 또는 이름',board.slug==='schedules'?'textarea':'text',true)}
 {!['schedules','studies'].includes(board.slug)&&field(board.body,board.slug==='timetable'?'스터디 담당자':'내용','textarea')}
 {['projects','studies'].includes(board.slug)&&<div className="admin-form-grid">{field('year','학년도','number',true)}<label><T text="학기"/><select value={values.semester==null?"":Number(values.semester)} disabled={busy} required onChange={e=>update('semester',e.target.value===''?null:Number(e.target.value))}><option value="" disabled><T text="학기를 확인한 뒤 선택"/></option><option value={1}><T text="1학기"/></option><option value={2}><T text="2학기"/></option></select></label></div>}
 {board.slug==='projects'&&<><div className="admin-form-grid">{field('duration','기간')}<label><T text="분류"/><select value={String(values.category??'')} disabled={busy} onChange={e=>update('category',e.target.value)}><option value=""><T text="선택 안 함"/></option>{CATEGORY_OPTIONS.map(c=><option key={c}>{c}</option>)}{values.category&&!CATEGORY_OPTIONS.some(c=>c===values.category)?<option>{String(values.category)}</option>:null}</select></label>{field('team_size','팀 규모','number')}{field('members','팀원 (쉼표 구분)')}</div><RecordSectionEditor kind="project" value={String(values.detailed_description??'')} onChange={v=>update('detailed_description',v)} disabled={busy} seed={row?{id:row.id,title:String(row.project_name??''),summary:String(row.description??''),original:String(row.detailed_description??'')}:undefined}/>{field('github_url','GitHub URL','url')}<TechPicker value={values.tech_stack} descriptions={[values.project_name,values.description,values.detailed_description]} disabled={busy} onChange={next=>update('tech_stack',next)}/></>}
 {board.slug==='studies'&&<><RecordSectionEditor kind="study" value={String(values.outline??'')} disabled={busy} onChange={v=>update('outline',v)} seed={row?{id:row.id,title:String(row.study_name??''),original:String(row.outline??'')}:undefined}/>{field('leader','담당자')}<p className="text-xs text-zinc-500"><T text="공개 페이지에 표시할 담당자 이름만 입력하세요. 계정 정보는 자동으로 가져오지 않습니다. 요일·시간은 시간표 게시판에서 같은 스터디 이름으로 관리합니다."/></p></>}
 {board.slug==='notices'&&<><label className="block"><T text="게시물 종류"/><select aria-label={uiText("게시물 종류")} value={values.is_noti===true?'notice':values.is_noti===false?'promotion':'unknown'} disabled={busy} onChange={e=>update('is_noti',e.target.value==='notice')} required>{values.is_noti==null&&<option value="unknown" disabled><T text="기존 분류 미지정"/></option>}<option value="notice"><T text="공지"/></option><option value="promotion"><T text="홍보"/></option></select></label><p className="text-sm text-zinc-500"><T text="저장하면 선택한 종류의 공개 게시판과 홈페이지에 게시됩니다. 공지와 홍보의 편집 권한은 별개입니다. 종류를 바꾸려면 두 권한이 모두 필요합니다."/></p></>}
 {board.slug==='promotions'&&<p className="text-sm text-zinc-500"><T text="홍보 게시물로 저장되어 공개 홍보 목록과 홈페이지에 표시됩니다. 초안 승인 권한과 작성 권한은 별개입니다."/></p>}
 {board.slug==='timetable'&&<><div className="admin-form-grid">{(['start_time','end_time'] as const).map((k,i)=><div key={k} className="space-y-2"><label><T text={i?'종료 요일':'시작 요일'}/><select disabled={busy} value={String(values[k]).split(' ')[0]} onChange={e=>update(k,e.target.value+' '+String(values[k]).split(' ')[1])}>{['월요일','화요일','수요일','목요일','금요일','토요일'].map(d=><option key={d}>{d}</option>)}</select></label><label><T text={i?'종료 시간':'시작 시간'}/><input type="time" step={1800} min="09:00" max="23:00" required disabled={busy} value={String(values[k]).split(' ')[1]} onChange={e=>update(k,String(values[k]).split(' ')[0]+' '+e.target.value)}/></label></div>)}</div>{field('color','시간표 색상','color')}</>}
 {board.slug==='schedules'&&<div className="admin-form-grid">{field('start_date','시작일','date',true)}{field('end_date','종료일','date',true)}</div>}
 {!row&&MEDIA_BUCKETS[board.table]&&<MediaEditor ref={mediaRef} table={board.table} draft locked={busy} onDirty={setMediaDirty}/>}
 {board.table==='editor_0_noti'&&<p className="text-sm text-zinc-600">공개한 제목과 본문은 자동으로 번역됩니다. <a href="/admin/content/tools" target="_blank" rel="noreferrer" className="underline">영어 번역 관리</a>에서 번역 상태를 확인하고 영문을 수정할 수 있습니다.</p>}
 {row&&<Classification category={category} reason={reason} onCategory={setCategory} onReason={setReason} disabled={busy}/>}<div className="admin-actions"><button type="submit" disabled={busy}><T text={busy?'저장 중…':row?'저장':'작성 완료'}/></button><a className="admin-link-button" href={row?`/admin/content/${board.slug}/${row.id}`:`/admin/content/${board.slug}`}><T text="취소"/></a></div>
 </form>{row&&MEDIA_BUCKETS[board.table]&&<><p className="text-sm text-zinc-600"><T text="본문과 이미지 연결은 각각 저장합니다. 본문 변경을 저장하거나 취소한 뒤 이미지를 연결하세요."/></p><MediaEditor key={`${row.id}:${row._revision}`} table={board.table} row={row} onSaved={onMediaSaved} locked={dirty||busy} onDirty={setMediaDirty} classification={{changeCategory:category,changeReason:reason}}/></>}{row&&['editor_0_noti','editor_1_projects','editor_2_studies','editor_6_events'].includes(board.table)&&<DocumentTools key={board.table+row.id} table={board.table} id={String(row.id)}/>}</div>
}
