"use client"

import {T,useUIText,useLocale} from '@/components/LocaleProvider';
import {RoomWeek} from './RoomWeek'
import {ContentExcerpt} from '@/components/ContentExcerpt'
import Link from 'next/link'
import {useState} from "react"
import {PublicDetailDialog} from "@/components/PublicDetailDialog"
import {useAsyncQuery} from "@/hooks/useAsyncQuery"
import {Loader2,AlertCircle} from "lucide-react"
import {supabase} from "@/lib/supabaseClient"
import {parseTimetableRows,type StudySlot} from "@/lib/timetable"
import {withStudyLeaders,type StudySessionLink} from "@/lib/study-schedule"
import {publicContentRpc} from '@/lib/public-content-rpc'
const DAYS=["월요일","화요일","수요일","목요일","금요일","토요일"]
const EMPTY_STUDIES:StudySlot[]=[]
const loadStudies=async():Promise<StudySlot[]>=>{
 const [times,studies,relations]=await Promise.all([
  supabase.from("editor_3_study_timetable").select("id,leader,color,start_time,end_time,created_at,study_name").order("start_time"),
  supabase.from("editor_2_studies").select("id,study_name,leader,outline,year,semester"),
  publicContentRpc<StudySessionLink[]>("oaz_public_study_sessions_v1"),
 ])
 if(times.error||studies.error)throw new Error("시간표를 불러오지 못했습니다.")
 const rows=(times.data??[]) as (NonNullable<typeof times.data>[number]&{_english?:{study_name?:string}})[]
 const records=studies.data??[]
 const verified=Array.isArray(relations.data)?relations.data:[]
 return withStudyLeaders(parseTimetableRows(rows),records,verified).map(slot=>{
  const study=records.find(row=>row.id===slot.studyId)
  return {...slot,outline:study?.outline,englishName:rows.find(row=>String(row.id)===slot.id)?._english?.study_name}
 })
}
function LoadedTimetable({wide=false,showHint=true}:{wide?:boolean;showHint?:boolean}){
 const {data:studies,loading,error}=useAsyncQuery("timetable",loadStudies,EMPTY_STUDIES,"시간표를 불러오지 못했습니다. 다시 시도해 주세요.")
 return <TimetableView studies={studies} isLoading={loading} error={error} wide={wide} showHint={showHint}/>
}
export function TimetableDemo({studies,wide=false,showHint=true}:{studies?:StudySlot[];wide?:boolean;showHint?:boolean}={}){return studies?<TimetableView studies={studies} wide={wide} showHint={showHint}/>:<LoadedTimetable wide={wide} showHint={showHint}/>}
function TimetableView({studies,isLoading=false,error=null,wide=false,showHint=true}:{studies:StudySlot[];isLoading?:boolean;error?:string|null;wide?:boolean;showHint?:boolean}){
 const uiText=useUIText(),locale=useLocale()
 const slotName=(slot:StudySlot)=>locale==='en'&&slot.englishName?slot.englishName:slot.name

 const [selected,setSelected]=useState<StudySlot|null>(null)
 if(isLoading)return <div role="status" className="flex items-center justify-center gap-2 p-8"><Loader2 className="h-5 w-5 animate-spin"/><span className="text-sm"><T text="시간표를 불러오는 중입니다…"/></span></div>
 return <div data-timetable-mode={wide?'schedule':'home'} className="flex min-h-0 w-full flex-1 flex-col">
  {showHint&&<p className="mb-3 text-xs text-gray-500"><T text="스터디를 누르면 전체 이름과 담당자·시간을 확인할 수 있습니다."/></p>}
  {selected&&<PublicDetailDialog title={slotName(selected)} onClose={()=>setSelected(null)}><p className="text-sm"><T text={selected.day}/> {selected.startTime} ~ {selected.endTime}</p><p className="mt-3 break-words text-sm"><T text="담당자:"/>{' '}<T text={selected.leader||"등록 정보 없음"}/></p>{selected.studyId!==undefined&&selected.outline&&<p className="mt-4 whitespace-pre-wrap break-words"><ContentExcerpt table="editor_2_studies" id={selected.studyId} body={selected.outline}/></p>}{selected.studyId!==undefined&&<Link className="mt-4 inline-flex min-h-11 items-center rounded-lg border px-4 text-sm underline" href={`/studies/records/${selected.studyId}`}><T text="스터디 상세 보기"/></Link>}</PublicDetailDialog>}
  {error&&<p role="status" className="mb-4 flex gap-2 rounded-lg border p-3 text-sm"><AlertCircle className="h-4 w-4"/><T text={error}/></p>}
  {!studies.length?<p className="p-8 text-center text-sm text-gray-500"><T text="아직 등록된 스터디 일정이 없습니다."/></p>:<>
   {wide?<RoomWeek studies={studies} days={DAYS} onSelect={setSelected}/>:(<div data-timetable-frame className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border bg-white">
    <div className="grid shrink-0 grid-cols-[0.3fr_repeat(6,minmax(0,1fr))] border-b"><span/><span className="sr-only"><T text="요일"/></span>{DAYS.map(day=><span key={day} className="border-l py-1 text-center text-[10px] font-semibold"><T text={day.slice(0,1)}/></span>)}</div>
    <div data-timetable-grid className="grid flex-1" style={{gridTemplateColumns:'0.3fr repeat(6,minmax(0,1fr))',gridTemplateRows:'repeat(28,minmax(20px,1fr))',minHeight:560}}>
     {Array.from({length:14},(_,i)=><span key={'hour-'+i} className="border-b pr-0.5 text-right text-[9px]" style={{gridColumn:1,gridRow:`${i*2+1} / span 2`}}>{(i+9)%12||12}</span>)}
     {DAYS.flatMap((day,d)=>Array.from({length:14},(_,i)=><span aria-hidden="true" key={day+i} className="border-b border-l" style={{gridColumn:d+2,gridRow:`${i*2+1} / span 2`}}/>))}
     {studies.map(s=><button key={s.id} data-timetable-study={s.id} type="button" onClick={()=>setSelected(s)} title={`${slotName(s)} · ${uiText('담당자:')} ${uiText(s.leader||'등록 정보 없음')} · ${uiText(s.day)} ${s.startTime}~${s.endTime}`} aria-label={uiText(`${slotName(s)} 시간표 상세`)} className={`z-10 min-h-0 min-w-0 overflow-hidden rounded-sm text-left text-white shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 p-1`} style={{gridColumn:DAYS.indexOf(s.day)+2,gridRow:`${s.startSlot+1} / span ${s.endSlot-s.startSlot}`,backgroundColor:s.color}}>
      <span className={`break-words font-medium leading-tight line-clamp-2 text-[11px]`}>{slotName(s)}</span>
      <span className={`block truncate leading-tight opacity-90 text-[10px]`}><T text={s.leader||'등록 정보 없음'}/></span>
     </button>)}
    </div>
   </div>)}
  </>}
 </div>
}
export default TimetableDemo
