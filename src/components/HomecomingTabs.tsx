'use client'

import Link from 'next/link'
import {Tabs,TabsList,TabsTrigger,TabsContent} from '@/components/ui/tabs'
import {LocalizedText,useLocale,T} from '@/components/LocaleProvider'
import {ALUMNI_INTRO,HOMECOMING_2026 as event,HOMECOMING_RECORDS} from '@/data/alumni'

const tabs=[['intro','홈커밍 소개','Introduction'],['year','올해 행사 안내','2026 event notice'],['records','지난 홈커밍 기록','Past notices & records']] as const
const panel='rounded-2xl border border-slate-200 bg-white p-5 leading-relaxed text-slate-700 sm:p-7 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-slate-900'
function safePublicURL(url:string){try{const u=new URL(url);return u.protocol==='https:'&&!u.username&&!u.password}catch{return false}}

export function HomecomingTabs(){
 const locale=useLocale()
 return <Tabs defaultValue="intro" data-homecoming-tabs className="gap-5">
  <TabsList aria-label={locale==='en'?'Homecoming content':'홈커밍 콘텐츠'} className="grid h-auto w-full grid-cols-1 gap-2 bg-slate-100 p-2 min-[375px]:grid-cols-3">
   {tabs.map(([id,ko,en])=><TabsTrigger key={id} value={id} className="min-h-12 h-auto whitespace-normal break-keep px-3 py-3 text-center leading-snug data-[state=active]:bg-slate-900 data-[state=active]:text-white"><LocalizedText ko={ko} en={en}/></TabsTrigger>)}
  </TabsList>
  <TabsContent value="intro" className={panel}>
   <h2 className="mb-5 text-xl font-semibold text-slate-900"><LocalizedText ko="배움과 경험을 나누는 자리" en="Sharing learning and experience"/></h2>
   <div lang={locale} className="space-y-4" data-homecoming-intro>
    <p><T text={ALUMNI_INTRO}/></p>
    <p><T text="OB 선배님들을 초청해 지난 1년간의 학회 활동과 스터디 및 기초 세션을 소개하고, 선배들의 졸업 후 진로 이야기를 듣습니다. 재학생과 졸업생이 서로의 경험을 나누며 소통하는 자리입니다."/></p>
    <p><T text="세미나에 이어 저녁식사와 네트워킹을 통해 대화를 이어갑니다. 학회에서 함께 배우고 활동해 온 경험을 나누며 재학생과 졸업생 사이의 교류를 이어가는 데 목적이 있습니다."/></p>
   </div>
  </TabsContent>
  <TabsContent value="year" className={panel}>
   <h2 className="mb-5 text-xl font-semibold text-slate-900" lang={locale}><T text={event.title}/></h2>
   <dl lang={locale} className="grid gap-4 sm:grid-cols-2">
    <div><dt className="font-semibold"><T text="일시"/></dt><dd><time dateTime="2026-09-11T18:00:00+09:00"><T text="2026년 9월 11일 금요일 · 오후 6시"/></time></dd></div>
    <div><dt className="font-semibold"><T text="장소"/></dt><dd><T text={event.venue}/></dd></div>
    <div className="sm:col-span-2"><dt className="font-semibold"><T text="대상"/></dt><dd><T text={event.audience}/></dd></div>
   </dl>
   <h3 className="mb-3 mt-6 font-semibold"><LocalizedText ko="공지된 프로그램" en="Announced program"/></h3>
   <ol lang={locale} className="space-y-2">{event.program.map(item=><li key={item}><T text={item}/></li>)}</ol>
   <p lang={locale} className="mt-4"><T text="이후 일정:"/> <T text={event.after}/></p>
   <SourceLink/>
  </TabsContent>
  <TabsContent value="records" className={panel}>
   <h2 className="mb-5 text-xl font-semibold text-slate-900"><LocalizedText ko="지난 홈커밍 기록" en="Past homecoming records"/></h2>
   <article className="rounded-xl border border-slate-200 p-4 sm:p-5">
    <h3 className="mb-3 text-lg font-semibold" lang={locale}><T text="2026년 홈커밍 세미나 안내 기록"/></h3>
    <p lang={locale}><T text="공지 일정: 2026년 9월 11일 오후 6시"/> · <T text={event.venue}/></p>
    <p lang={locale} className="mt-3"><T text="학회·스터디·세션 소개, OB 선배님 진로 발표, 퀴즈 및 기념품 배부와 이후 저녁식사·네트워킹이 진행되었습니다."/></p>
    <SourceLink/>
   </article>
   {HOMECOMING_RECORDS.map(record=><article key={record.year} className="mt-4 rounded-xl border p-4"><h3 className="font-semibold">{record.year} · {record.title}</h3><p>{record.date} · {record.venue}</p><p>{record.attendance}</p>{[...record.photos,...record.presentations].filter(a=>safePublicURL(a.url)).map(a=><a key={a.url} href={a.url} target="_blank" rel="noopener noreferrer" className="mr-4 underline">{a.label}</a>)}</article>)}
  </TabsContent>
 </Tabs>
}
function SourceLink(){return <Link href={`/about/notice/${event.sourceNoticeId}`} className="mt-5 inline-flex min-h-11 items-center rounded-lg text-sm font-medium text-blue-700 underline underline-offset-4 focus-visible:outline-2"><LocalizedText ko="관련 공지 확인하기" en="View the related notice"/></Link>}
