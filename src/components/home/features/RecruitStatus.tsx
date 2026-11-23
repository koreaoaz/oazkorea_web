'use client'

import Link from 'next/link'
import {T} from '@/components/LocaleProvider';
import {useEffect,useState} from 'react'
import {RECRUITMENT,recruitmentStatus} from '@/lib/recruitment'
export function RecruitStatus(){
 const [now,setNow]=useState<number|null>(null)
 useEffect(()=>{const tick=()=>setNow(Date.now());const first=setTimeout(tick,0),timer=setInterval(tick,30000);return()=>{clearTimeout(first);clearInterval(timer)}},[])
 const status=now===null?'unknown':recruitmentStatus(now,RECRUITMENT.start,RECRUITMENT.end)
 return <section data-recruit-status={status} className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 rounded-xl border border-gray-200 px-4 py-3 text-sm"><h2 className="font-semibold"><T text={status==='closed'?'이번 학기 모집이 마감되었습니다':status==='open'?'신규 학회원을 모집하고 있습니다':'모집 일정을 확인해 주세요'}/></h2><p className="text-gray-500"><T text="모집 마감"/> <time dateTime={RECRUITMENT.end}><T text="2026년 9월 8일 23:59"/></time></p>{status==='open'?<a href="https://forms.gle/g8br3LNXoi13bidf7" target="_blank" rel="noopener noreferrer" className="font-semibold underline underline-offset-4"><T text="지원하기"/></a>:<Link href="/about/notice" className="font-semibold underline underline-offset-4"><T text="모집 공지 확인하기"/></Link>}</section>
}
