'use client'
import {AdminSessionLoading} from '@/components/AdminSessionLoading'
import Link from 'next/link'
import {useEffect,useState} from 'react'
import {supabase} from '@/lib/supabaseClient'
import {useLocale} from './LocaleProvider'
import {ContentTitle} from './ContentTitle'
import {ContentExcerpt} from './ContentExcerpt'
type Entry={id:number;title:string;body:string;englishSummary?:string;year:number|null;semester:number|null}
/** Summarizes only rows returned by the existing public RLS path. */
export function ActivityOverview({kind}:{kind:'studies'|'projects'}){
 const en=useLocale()==='en',study=kind==='studies';
 const [rows,setRows]=useState<Entry[]|null>(null),[failed,setFailed]=useState(false);
 useEffect(()=>{let live=true;const q=study?supabase.from('editor_2_studies').select('id,study_name,outline,year,semester').order('created_at',{ascending:false}).limit(6):supabase.from('editor_1_projects').select('id,project_name,description,year,semester').order('created_at',{ascending:false}).limit(6);
 void q.then(({data,error})=>{if(!live)return;if(error){setFailed(true);console.warn('[overview] public content unavailable');return}setRows((data??[]).map(x=>{const r=x as unknown as Record<string,unknown>;return {id:Number(r.id),title:String(r.study_name??r.project_name??''),body:String(r.outline??r.description??''),englishSummary:(r._english as Record<string,string>|undefined)?.description,year:r.year as number|null,semester:r.semester as number|null}}))});return()=>{live=false}},[study]);
 const title=study?(en?'Study activities':'스터디 활동 소개'):(en?'Project activities':'프로젝트 활동 소개');
 return <main className="mx-auto max-w-6xl space-y-8 px-4 py-12"><header className="rounded-2xl bg-slate-50 p-6 sm:p-10"><h1 className="text-3xl font-bold">{title}</h1><p className="mt-4 text-slate-600">{en?'Explore the activities documented in our public archive. Details reflect the published records; unconfirmed dates are left unspecified.':'공개 기록에 등록된 활동을 소개합니다. 각 활동의 내용과 확인된 학기는 상세 기록에서 확인할 수 있습니다.'}</p></header>
 {failed?<p role="alert">{en?'Activities are temporarily unavailable.':'활동을 불러오지 못했습니다. 잠시 후 다시 확인해 주세요.'}</p>:rows===null?<AdminSessionLoading/>:rows.length?<div className="grid gap-5 md:grid-cols-2">{rows.map(r=><article key={r.id} className="rounded-xl border p-6"><h2 className="text-xl font-semibold"><ContentTitle table={study?'editor_2_studies':'editor_1_projects'} id={r.id} title={r.title}/></h2><p className="mt-2 text-sm text-slate-500">{r.year&&r.semester?`${r.year}-${r.semester}`:en?'Semester unconfirmed':'학기 미확인'}</p><p className="mt-3 line-clamp-4 whitespace-pre-wrap break-words"><ContentExcerpt table={study?'editor_2_studies':'editor_1_projects'} id={r.id} body={r.body} automaticBody={r.englishSummary}/></p><Link href={study?`/studies/records/${r.id}`:`/projects/archives?project=${r.id}${en?'&lang=en':''}`} className="mt-4 inline-block underline">{en?'View record':'활동 기록 보기'}</Link></article>)}</div>:<p className="rounded-xl border p-6">{en?'No published activities are available yet.':'현재 공개된 활동 기록이 없습니다.'}</p>}
 <Link className="inline-flex rounded-lg bg-black px-5 py-3 text-white" href={study?'/studies/records':'/projects/archives'}>{en?'Browse all activities':'전체 활동 기록 보기'}</Link></main>
}
