import {publicStudySections} from '@/lib/public-study-sections'
import {ContentTitle} from '@/components/ContentTitle'
import {studyTopicCover} from '@/lib/study-cover'

import {imageURL} from '@/lib/image-delivery'

import {T} from '@/components/LocaleProvider';
import {TranslatedContent} from "@/components/TranslatedContent";
import {notFound} from 'next/navigation'
import Link from 'next/link'
import {ContentImage as Image} from '@/components/ContentImage'
import {supabase} from '@/lib/supabaseClient'
import {publicContentRpc} from '@/lib/public-content-rpc'
import {studyTimes,type StudySessionLink} from '@/lib/study-schedule'
import {parseTimetableRows} from '@/lib/timetable'
export const dynamic='force-dynamic'
export default async function StudyDetail({params}:{params:Promise<{id:string}>}){
 const {id}=await params
 if(!/^(0|[1-9][0-9]*)$/.test(id)||!Number.isSafeInteger(Number(id)))notFound()
 const result=await supabase.from('editor_2_studies').select('id,study_name,outline,leader,filename,year,semester').eq('id',Number(id)).maybeSingle().then(value=>value,()=>({data:null,error:true}))
 if(result.error){console.warn('공개 스터디 상세 조회 실패');return <p className="mx-auto max-w-3xl py-10" role="status"><T text="스터디를 불러오지 못했습니다. 잠시 후 다시 확인해 주세요."/></p>}
 const data=result.data
 if(!data)notFound()
 const [matching,timetable,relations]=await Promise.all([
  supabase.from('editor_2_studies').select('id').eq('study_name',data.study_name),
  supabase.from('editor_3_study_timetable').select('id,study_name,leader,color,start_time,end_time,created_at').order('start_time'),
  publicContentRpc<StudySessionLink[]>('oaz_public_study_sessions_v1'),
 ]).catch(()=>[{data:null,error:true},{data:null,error:true},{data:null,error:true}])
 const unique=!matching.error&&matching.data?.length===1&&matching.data[0].id===data.id
 const links=Array.isArray(relations.data)?relations.data as StudySessionLink[]:undefined
 const times=!timetable.error?(links?studyTimes(data,[data],parseTimetableRows(timetable.data??[]),links):unique?parseTimetableRows(timetable.data??[]).filter(t=>t.name===data.study_name):[]):[]
 if(matching.error||timetable.error)console.warn('공개 스터디 시간 조회 실패')
 const image=data.filename?imageURL('study-images',data.filename,supabase.storage.from('study-images').getPublicUrl(data.filename).data.publicUrl):studyTopicCover(data.study_name??'')
 return <article className="mx-auto max-w-3xl space-y-5 py-10"><Link href="/studies/schedule" className="text-sm underline"><T text="스터디 시간표와 목록"/></Link><h1 className="break-words text-3xl font-bold"><ContentTitle table="editor_2_studies" id={data.id} title={data.study_name||'스터디'}/></h1><p className="text-sm text-gray-500"><T text={data.year&&[1,2].includes(data.semester)?`${data.year}년 ${data.semester}학기`:'학기 정보 없음'}/></p><p className="break-words text-sm"><T text="담당자:"/>{' '}<T text={data.leader||'등록 정보 없음'}/></p>{times.length?<ul className="space-y-1 text-sm">{times.map(t=><li key={t.id}><T text={t.day}/> {t.startTime} ~ {t.endTime}</li>)}</ul>:<p className="text-sm text-gray-500"><T text="연결이 확인된 시간표 정보가 없습니다."/></p>}{image&&<Image loading="eager" src={image} alt={data.study_name||'스터디 이미지'} width={800} height={480} unoptimized className="h-auto w-full rounded-xl object-contain"/>}{!data.filename&&<p className="text-xs text-slate-500"><T text="주제 설명용 이미지입니다. 실제 활동 사진이 아닙니다."/> <a className="underline" href="/study-covers/NOTICE.txt"><T text="이미지 출처·라이선스"/></a></p>}<TranslatedContent table="editor_2_studies" id={data.id} title={data.study_name||"스터디"} sections={publicStudySections(data)} body={data.outline||""} heading={false}/><Link href="/studies/records" className="inline-block text-sm underline"><T text="전체 스터디 기록"/></Link></article>
}
