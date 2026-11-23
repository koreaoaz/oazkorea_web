'use client'
import {recordCard,recordImage,recordTitle,recordGrid} from '@/lib/record-card'

import {imageURL} from '@/lib/image-delivery'
import {studyTopicCover} from '@/lib/study-cover'
import {ContentTitle} from '@/components/ContentTitle'
import {TranslatedContent} from '@/components/TranslatedContent'

import {T,useUIText,LocalizedText} from '@/components/LocaleProvider';
import {Skeleton} from '@/components/ui/skeleton'
import {useAsyncQuery} from '@/hooks/useAsyncQuery'
import {useRef,useState} from 'react'
import Link from 'next/link'
import {PublicDetailDialog} from '@/components/PublicDetailDialog'
import {ContentImage as Image} from '@/components/ContentImage'
import {supabase} from '@/lib/supabaseClient'
import {SemesterFilter} from '@/components/SemesterFilter'
import {activityTermLabel,compareStudyTerms,filterSemester} from '@/lib/semester'
type Study={_sections?:import('@/types/project').ProjectSection[];id:number;study_name:string|null;outline:string|null;leader:string|null;filename:string|null;year:number|null;semester:number|null;created_at:string|null}
const failureMessage='스터디를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.'
async function loadStudies(signal:AbortSignal):Promise<Study[]>{
  const requestSignal = AbortSignal.any([signal, AbortSignal.timeout(20000)])
  const rows: Study[] = []
  let lastId: number | undefined
  for (;;) {
    let query = supabase.from('editor_2_studies')
      .select('id,study_name,outline,leader,filename,year,semester,created_at', { count: 'exact' })
      .order('id', { ascending: true })
    if (lastId !== undefined) query = query.gt('id', lastId)
    const { data, error, count } = await query.abortSignal(requestSignal)
    if (error) throw error
    const batch: Study[] = data ?? []
    rows.push(...batch)
    // The public data proxy limits each response to 1,000 rows.
    if (!batch.length || (count == null ? batch.length < 1000 : batch.length >= count)) break
    lastId = batch[batch.length - 1].id
  }
  return rows.sort(compareStudyTerms)
}
function StudySkeleton(){
 return <div role="status" data-study-skeleton><span className="sr-only"><LocalizedText ko="스터디 목록을 불러오는 중…" en="Loading studies…"/></span><div aria-hidden="true"><div className="mb-6 flex flex-wrap items-center gap-3"><Skeleton className="h-6 w-24"/><Skeleton className="h-11 w-44"/></div><div className={`mobile-study-grid ${recordGrid}`}>{Array.from({length:6},(_,i)=><div key={i} className="min-h-[300px] min-w-0 rounded-lg border bg-white p-6"><Skeleton className="mx-auto aspect-square w-4/5 max-w-[200px]"/><Skeleton className="mx-auto mt-4 h-6 w-3/4"/><Skeleton className="mx-auto mt-2 h-5 w-24"/></div>)}</div></div></div>
}
export default function StudyArchiveGrid(){
 const uiText=useUIText();

 const trigger=useRef<HTMLButtonElement>(null)
 const {data:rows,loading,error,reload}=useAsyncQuery<Study[]>('study-archive',loadStudies,[],failureMessage)
 const [selected,setSelected]=useState<Study|null>(null),[semester,setSemester]=useState('all'),[page,setPage]=useState(0)
 const filtered=filterSemester(rows,semester),pages=Math.max(1,Math.ceil(filtered.length/6)),currentPage=Math.min(page,pages-1),initialLoading=loading&&rows.length===0
 const image=(r:Study)=>r.filename?imageURL('study-images',r.filename,supabase.storage.from('study-images').getPublicUrl(r.filename).data.publicUrl):studyTopicCover(r.study_name??'')
 return <section className="mx-auto w-full max-w-7xl py-8" aria-busy={loading}><h1 className="mb-6 text-3xl font-bold"><T text="스터디 목록"/></h1>
 {initialLoading?<StudySkeleton/>:<SemesterFilter termsOnly rows={rows} value={semester} onChange={v=>{setSemester(v);setPage(0);setSelected(null)}}/>}
 {loading&&!initialLoading&&<p role="status" className="mb-3 text-sm"><LocalizedText ko="스터디 목록을 갱신하는 중…" en="Refreshing studies…"/></p>}{error&&<p role="alert" className="mb-4"><T text={error}/> <button type="button" onClick={reload} className="min-h-11 px-2 underline"><LocalizedText ko="다시 시도" en="Try again"/></button></p>}{!loading&&!error&&!filtered.length&&<p className="rounded-xl border p-8"><T text="해당하는 스터디가 없습니다."/></p>}
 <div className={`mobile-study-grid ${recordGrid}`}>{filtered.slice(currentPage*6,(currentPage+1)*6).map((r,index)=><button data-study-card={r.id} type="button" key={r.id} className={recordCard} onClick={event=>{trigger.current=event.currentTarget;setSelected(r)}} aria-haspopup="dialog" aria-expanded={selected?.id===r.id}><Image loading={index<3||!r.filename?"eager":"lazy"} src={image(r)} alt={uiText(r.study_name??'스터디 이미지')} width={400} height={240} unoptimized className={recordImage}/><h3 className={recordTitle}><ContentTitle table="editor_2_studies" id={r.id} title={r.study_name??"Study"}/></h3><span className="mt-2 block text-sm text-gray-500">{activityTermLabel(r,false)?<><LocalizedText ko={activityTermLabel(r,false)} en={activityTermLabel(r,true)}/><span className="sr-only"> · <T text="상세 보기 →"/></span></>:<T text="상세 보기 →"/>}</span></button>)}</div>
 {selected&&<PublicDetailDialog returnFocusRef={trigger} title={<ContentTitle table="editor_2_studies" id={selected.id} title={selected.study_name??'Study'}/>} onClose={()=>setSelected(null)}>
    <Image loading="eager" src={image(selected)} alt={uiText(selected.study_name??'스터디 이미지')} width={600} height={400} unoptimized className="mx-auto max-h-64 w-auto max-w-full rounded-lg object-contain"/>
    <p className="my-4"><T text="스터디장:"/> {selected.leader||<T text="미정"/>}</p>
    <TranslatedContent table="editor_2_studies" id={selected.id} title={selected.study_name??'Study'} sections={selected._sections} body={selected.outline??''} heading={false}/>
    <Link className="mt-4 inline-block underline" href={`/studies/records/${selected.id}`}><T text="스터디 상세 보기"/></Link>
 </PublicDetailDialog>}
 {filtered.length>0&&<nav aria-label={uiText("스터디 페이지")} className="mt-6 flex flex-wrap items-center justify-center gap-4"><button aria-label="Previous page" className="min-h-11 rounded border px-4 disabled:opacity-40" disabled={currentPage===0} onClick={()=>{setPage(currentPage-1);setSelected(null)}}><T text="이전"/></button><span>{currentPage+1} / {pages}<T text="· 총"/>{filtered.length}<T text="개 스터디"/></span><button aria-label="Next page" className="min-h-11 rounded border px-4 disabled:opacity-40" disabled={currentPage+1>=pages} onClick={()=>{setPage(currentPage+1);setSelected(null)}}><T text="다음"/></button></nav>}
 </section>
}
