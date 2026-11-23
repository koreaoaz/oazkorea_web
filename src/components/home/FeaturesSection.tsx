'use client'

import {T,useUIText} from '@/components/LocaleProvider';
import VisitStatistics from './VisitStatistics'
import Timetable from './features/Timetable'
import Calendar01 from './features/Calender01'
import Donators from './features/Donators'
import Notification from './features/Notification'
import Image from 'next/image'
export default function FeaturesSection(){
 const uiText=useUIText();

 const card='min-w-0 rounded-xl border border-gray-200 bg-white p-4'
 const heading='mb-3 text-lg font-bold tracking-tight text-gray-900'
 return <section aria-label={uiText("학회 소식과 안내")} className="mx-auto max-w-7xl py-6"><div data-home-grid className="grid grid-cols-1 items-stretch gap-4 md:grid-cols-2 lg:grid-cols-3">
 <div className="flex min-w-0 flex-col gap-4 lg:row-span-2"><VisitStatistics/><section data-home-block="timetable" className={`${card} flex flex-1 flex-col`}><h2 className={heading}><T text="스터디 시간표"/></h2><Timetable/></section></div>
 <section data-home-block="news" className={`${card} flex flex-col`}><Notification/></section>
 <section data-home-block="calendar" className={card}><h2 className={heading}><T text="일정"/></h2><Calendar01/></section>
 <section data-home-block="map" className={card}><h2 className={heading}><T text="오시는 길"/></h2><Image src="/106b.jpg" alt={uiText("하나와영 학회실 안내 지도")} width={722} height={332} loading="eager" className="h-auto w-full rounded-lg object-contain"/><p className="mt-2 text-xs text-gray-600"><T text="신공학관 106B호 · 하나와영 학회실"/></p></section>
 <section data-home-block="honor" className={`${card} lg:self-start`}><h2 className={heading}><T text="명예의 전당"/></h2><Donators showHeading={false}/></section>
 </div></section>
}
