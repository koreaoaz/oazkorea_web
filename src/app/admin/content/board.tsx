'use client'


import {AdminSessionLoading} from '@/components/AdminSessionLoading'
import {T,useUIText,useLocale} from '@/components/LocaleProvider';
import {imageURL} from '@/lib/image-delivery'
import Link from 'next/link'
import {useCallback,useEffect,useRef,useState} from 'react'
import {useRouter} from 'next/navigation'
import Image from 'next/image'
import {ProjectDetail} from './ProjectDetail'
import {VisibilityControl} from './visibility'
import {Pin} from 'lucide-react'
import {compareNotices} from '@/lib/notice-order'
import {adminCommand} from '@/lib/admin/client'
import {boardFor,type ChangeCategory} from '@/lib/admin/boards'
import {useUnsavedChanges} from '../unsaved'
import {ContentEditor,type ContentRow} from './editor'
import {Classification} from '../classification'
import {supabase} from '@/lib/supabaseClient'
import {MEDIA_BUCKETS} from '@/lib/admin/media-upload'
import {getEventImages} from '@/app/editor/utils/parsing_first'
import {schedulePreview} from '@/lib/public-schedules'
type Mode='list'|'detail'|'new'|'edit'
export function ContentBoard({type,id,mode,saved=false}:{type:string;id?:number;mode:Mode;saved?:boolean}){
 const uiText=useUIText(),locale=useLocale();

 const board=boardFor(type),router=useRouter(),[rows,setRows]=useState<ContentRow[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[busy,setBusy]=useState(false),[denied,setDenied]=useState(false),[query,setQuery]=useState(''),[page,setPage]=useState(0),[category,setCategory]=useState<ChangeCategory>('content'),[reason,setReason]=useState(''),[order,setOrder]=useState<{revision:number;ids:number[]}>({revision:0,ids:[]}),pending=useRef(false),[originalOrder,setOriginalOrder]=useState('[]'),retry=useRef<{intent:string;command:Parameters<typeof adminCommand>[0]}|null>(null)
 useUnsavedChanges(mode==='list'&&JSON.stringify(order.ids)!==originalOrder)
 async function mutate(command:Parameters<typeof adminCommand>[0]){const intent=JSON.stringify({...command,version:0});if(retry.current?.intent!==intent)retry.current={intent,command:{...command,requestId:crypto.randomUUID()}};return adminCommand(retry.current.command)}
 const load=useCallback(async()=>{
  if(!board)return
  const s=await adminCommand({action:'session',version:0}) as {version:number;role:string;scopes:string[];promotion?:{manualEdit:boolean}}
  if(s.role!=='SUPER_ADMIN'&&!(board.slug==='promotions'?s.promotion?.manualEdit:s.scopes.includes(board.table))){setDenied(true);return}
  setDenied(false)
  // 같은 권한 버전의 독립 조회만 병렬화한다. 각 API의 인증·권한 검사는 유지한다.
  const [data,next]=await Promise.all([
   adminCommand({action:'content.list',version:s.version,table:board.table,...(board.table==='editor_0_noti'?{kind:mode==='list'?(board.slug==='promotions'?'promotion' as const:'notice' as const):'all' as const}:{})}) as Promise<ContentRow[]>,
   mode==='list'&&board.table!=='editor_0_noti'?adminCommand({action:'order.list',version:s.version,table:board.table}) as Promise<typeof order>:Promise.resolve(null),
  ])
  setRows(data)
  if(next){setOriginalOrder(JSON.stringify(next.ids));setOrder(next)}
 },[board,mode])
 useEffect(()=>{let live=true;const timer=setTimeout(()=>{void load().catch(()=>{if(live)setError('콘텐츠를 불러오지 못했습니다. 현재 권한과 연결 상태를 확인해 주세요.')}).finally(()=>{if(live)setLoading(false)})},0);return()=>{live=false;clearTimeout(timer)}},[load])
 if(!board)return <h1><T text="존재하지 않는 콘텐츠입니다."/></h1>
 if(loading)return <AdminSessionLoading/>
 if(denied)return <section><h1><T text="콘텐츠 편집 권한이 없습니다"/></h1><Link prefetch={false} href="/admin/content"><T text="콘텐츠 관리로 돌아가기"/></Link></section>
 if(error&&rows.length===0)return <p role="alert"><T text={error}/></p>
 const row=rows.find(r=>r.id===id),base=`/admin/content/${type}`
 if(['detail','edit'].includes(mode)&&!row)return <section><h1><T text="게시물을 찾을 수 없습니다"/></h1><Link prefetch={false} href={base}><T text="목록으로 돌아가기"/></Link></section>
 const filtered=rows.filter(r=>String(r[board.title]??'').toLowerCase().includes(query.toLowerCase()))
 const display=[...filtered].sort(board.table==='editor_0_noti'?compareNotices:(a,b)=>String(b.created_at??'').localeCompare(String(a.created_at??''))||b.id-a.id)
 const date=(v:unknown)=>typeof v==='string'&&Number.isFinite(Date.parse(v))?new Date(v).toLocaleString(locale==='en'?'en-US':'ko-KR',{timeZone:'Asia/Seoul'}):'기록 없음'
 async function togglePin(target:ContentRow){
  if(!board||pending.current)return
  pending.current=true;setBusy(true);setError('')
  try{const session=await adminCommand({action:'session',version:0}) as {version:number};await mutate({action:'content.pin',version:session.version,table:board.table,id:target.id,revision:target._revision,pinned:!target.pinned_at});await load();setPage(0);retry.current=null}
  catch(e){setError(e instanceof Error?e.message:'상단 고정을 변경하지 못했습니다. 다시 시도해 주세요.')}
  finally{pending.current=false;setBusy(false)}
 }
 async function remove(){if(!row||!board||pending.current||!window.confirm(uiText('이 콘텐츠를 삭제할까요? 이미지 원본 파일은 보존됩니다.')))return;pending.current=true;setBusy(true);try{const s=await adminCommand({action:'session',version:0}) as {version:number};await mutate({action:'content.delete',version:s.version,table:board.table,id:row.id,revision:row._revision,changeCategory:category,changeReason:reason});router.push(base+'?deleted=1');router.refresh()}catch(e){setError(e instanceof Error?e.message:'삭제하지 못했습니다.');setBusy(false)}finally{pending.current=false}}
 return <div className="space-y-6">{saved&&<p role="status"><T text="콘텐츠가 저장되었습니다."/></p>}{error&&<p role="alert"><T text={error}/></p>}<nav aria-label={uiText("콘텐츠 경로")} className="admin-breadcrumb"><Link prefetch={false} href="/admin/content"><T text="콘텐츠 관리"/></Link><span>/</span><Link prefetch={false} href={base}><T text={board.name}/></Link>{mode!=='list'&&<><span>/</span><span><T text={mode==='new'?'신규 작성':mode==='edit'?'수정':'상세 조회'}/></span></>}</nav><h1><T text={mode==='list'?`${board.name} 게시판`:mode==='new'?`${board.name} 신규 작성`:type==='schedules'?schedulePreview(String(row?.description??board.name)).title:String(row?.[board.title]??board.name)}/></h1>
 {mode==='list'&&<><div className="admin-actions"><Link prefetch={false} className="admin-link-button admin-primary" href={base+'/new'}><T text="신규 작성"/></Link><label className="min-w-0 flex-1"><T text="제목 검색"/><input aria-label={uiText("제목 검색")} value={query} onChange={e=>{setQuery(e.target.value);setPage(0)}}/></label><span><T text="총"/>{filtered.length}<T text="개"/></span></div>
 <ol className="admin-board-list" data-pin-board={board.table==='editor_0_noti'}>{display.slice(page*15,(page+1)*15).map((r,i)=><li key={r.id}><span className="flex items-center gap-2 text-sm text-zinc-500">{board.table==='editor_0_noti'&&<button type="button" className="admin-pin" data-pin-id={r.id} aria-pressed={!!r.pinned_at} aria-label={uiText(String(r[board.title])+(r.pinned_at?' 상단 고정 해제':' 상단 고정'))} disabled={busy} onClick={()=>void togglePin(r)}><Pin size={16} fill={r.pinned_at?'currentColor':'none'}/></button>}{page*15+i+1}</span><Link prefetch={false} href={`${base}/${r.id}`} className="min-w-0 break-words font-semibold">{board.table==='editor_0_noti'&&!!r.pinned_at&&<span className="admin-badge mr-2"><T text="상단 고정됨"/></span>}{type==='projects'&&<VisibilityControl table={board.table} id={r.id} mode="badge"/>}<T text={String((type==='schedules'?schedulePreview(String(r.description??'')).title:r[board.title])??'제목 없음')}/></Link><span className="text-xs text-zinc-500"><T text="작성"/>{date(r.created_at)} · <T text={board.table==='editor_0_noti'?`수정 ${date(r.updated_at)}`:`수정 버전 ${r._revision}`}/></span></li>)}</ol>{!filtered.length&&<p className="admin-panel"><T text="등록된 콘텐츠가 없거나 검색 결과가 없습니다."/></p>}
 <nav className="admin-actions" aria-label={uiText("게시판 페이지")}><button disabled={page===0} onClick={()=>setPage(p=>p-1)}><T text="이전"/></button><span>{page+1} / {Math.max(1,Math.ceil(filtered.length/15))}</span><button disabled={(page+1)*15>=filtered.length} onClick={()=>setPage(p=>p+1)}><T text="다음"/></button></nav><p className="text-xs text-zinc-500"><T text={board.table==='editor_0_noti'?'최대 1,000개 범위에서 고정 시각·작성일·ID 내림차순입니다. 현재 게시판 종류만 표시합니다. 기존 공지·홍보의 ID와 공개 URL은 유지합니다.':'최대 1,000개 조회 범위의 최신순 목록입니다. 공개 표시 순서는 아래 수동 순서를 유지합니다.'}/></p>
 {board.table!=='editor_0_noti'&&<details className="admin-panel space-y-3"><summary className="cursor-pointer font-semibold"><T text="공개 수동 순서 관리"/></summary><p className="text-sm"><T text="ID와 본문은 바꾸지 않습니다. 현재"/>{order.ids.length}<T text="개 항목의 전체 순서입니다."/></p>{order.ids.map((rid,i)=><div key={rid} className="admin-actions"><span className="min-w-0 flex-1 break-words">{String(rows.find(r=>r.id===rid)?.[board.title]??`#${rid}`)}</span><button disabled={busy||i===0} onClick={()=>setOrder(o=>{const ids=[...o.ids];[ids[i-1],ids[i]]=[ids[i],ids[i-1]];return {...o,ids}})}><T text="위로"/></button></div>)}<Classification category={category} reason={reason} onCategory={setCategory} onReason={setReason} disabled={busy}/><button disabled={busy||!order.ids.length||order.ids.length>1000} onClick={()=>{if(pending.current)return;pending.current=true;setBusy(true);void(async()=>{try{const s=await adminCommand({action:'session',version:0}) as {version:number};await mutate({action:'order.save',version:s.version,table:board.table,revision:order.revision,ids:order.ids,changeCategory:category,changeReason:reason});await load();retry.current=null}catch{setError('순서를 저장하지 못했습니다. 목록을 다시 확인해 주세요.')}finally{pending.current=false;setBusy(false)}})()}}><T text="순서 저장"/></button></details>}</>}
 {mode==='detail'&&row&&<>{type==='projects'?<div className="admin-actions flex-wrap" data-project-actions><Link prefetch={false} className="admin-link-button" href={base}><T text="돌아가기"/></Link><Link prefetch={false} className="admin-link-button admin-primary" href={`${base}/${row.id}/edit`}><T text="수정"/></Link><VisibilityControl key={row.id} table={board.table} id={row.id} mode="compact"/></div>:<VisibilityControl table={board.table} id={row.id}/>}<article className="admin-panel space-y-5"><p className="text-sm text-zinc-500"><T text="작성일"/>{date(row.created_at)}<T text="· 수정 버전"/>{row._revision}</p>{type==='schedules'&&<p className="whitespace-pre-wrap break-words">{String(row.description??'')}</p>}{type==='projects'?<ProjectDetail row={row}/>:Object.entries(row).filter(([key,value])=>![board.title,'id','_revision','created_at','filename','image_url','filenames'].includes(key)&&['description','outline','leader','year','semester','duration','category','team_size','members','detailed_description','tech_stack','github_url','start_time','end_time','start_date','end_date','color','is_noti','achievements'].includes(key)&&value!==null&&value!=='').map(([key,value])=><div key={key}><h2 className="!text-base"><T text={({description:'내용',outline:'소개',leader:'담당자',year:'학년도',semester:'학기',duration:'기간',category:'분류',team_size:'팀 규모',members:'팀원',detailed_description:'상세 설명',tech_stack:'기술스택',github_url:'GitHub URL',start_time:'시작',end_time:'종료',start_date:'시작일',end_date:'종료일',color:'색상',is_noti:'게시물 종류',achievements:'성과'} as Record<string,string>)[key]??'추가 정보'}/></h2><p className="whitespace-pre-wrap break-words"><T text={key==='is_noti'?(value?'공지':'홍보'):typeof value==='object'?JSON.stringify(value):typeof value==='boolean'?(value?'예':'아니요'):String(value)}/></p></div>)}{(type==='events'?getEventImages(row.filenames).map(i=>i.filename):typeof row.image_url==='string'&&row.image_url?[row.image_url]:typeof row.filename==='string'&&row.filename?[row.filename]:[]).map((path,i)=><Image key={`${path}-${i}`} src={imageURL(MEDIA_BUCKETS[board.table]??'',path,/^https?:\/\//.test(path)?path:supabase.storage.from(MEDIA_BUCKETS[board.table]??'').getPublicUrl(path).data.publicUrl)} alt={uiText(`${board.name} 이미지 ${i+1}`)} width={800} height={450} unoptimized className="h-auto max-h-[480px] w-full rounded-lg object-contain"/>)}</article>{type!=='projects'&&<div className="admin-actions"><Link prefetch={false} className="admin-link-button" href={base}><T text="목록으로 돌아가기"/></Link><Link prefetch={false} className="admin-link-button admin-primary" href={`${base}/${row.id}/edit`}><T text="수정하기"/></Link></div>}<details className="admin-panel"><summary className="cursor-pointer font-semibold"><T text="삭제하기"/></summary><div className="mt-4 space-y-4"><Classification category={category} reason={reason} onCategory={setCategory} onReason={setReason} disabled={busy}/><button disabled={busy} onClick={()=>void remove()}><T text="삭제 확인"/></button><p className="text-sm"><T text="삭제는 서버 권한을 다시 검사하고 작업 이력을 남깁니다. 이미지 원본은 자동 삭제하지 않습니다."/></p></div></details></>}
 {(mode==='new'||mode==='edit')&&<ContentEditor key={`${type}:${row?.id??'new'}:${row?._revision??0}`} board={board} row={row} onMediaSaved={load}/>}
 </div>
}
