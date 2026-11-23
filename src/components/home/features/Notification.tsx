'use client'

import {ContentTitle} from '@/components/ContentTitle'
import {T,useUIText} from '@/components/LocaleProvider';
import {useEffect,useState} from 'react'
import Link from 'next/link'
import {supabase} from '@/lib/supabaseClient'
import {useMobileViewport} from '@/hooks/useMobileViewport'
import {PUBLIC_NOTICE_FEED,noticeDate} from '@/lib/notice-publication'
type Notice={id:number;text:string;publication_date:string;created_at:string;pinned_at:string|null}
type ListState={rows:Notice[];error:boolean}
export default function Notification(){
 const uiText=useUIText();
 const mobile=useMobileViewport(),[selected,setSelected]=useState(0)


 const [lists,setLists]=useState<ListState[]>([{rows:[],error:false},{rows:[],error:false}]),[loading,setLoading]=useState(true)
 useEffect(()=>{const c=new AbortController(),timer=setTimeout(()=>{
  void Promise.allSettled([true,false].map(isNotice=>supabase.from(PUBLIC_NOTICE_FEED).select('id,text,publication_date,created_at,pinned_at').eq('is_noti',isNotice).order('pinned_at',{ascending:false,nullsFirst:false}).order('publication_date',{ascending:false}).order('created_at',{ascending:false}).order('id',{ascending:false}).limit(5).abortSignal(c.signal))).then(results=>{
   if(c.signal.aborted)return
   setLists(results.map(result=>result.status==='fulfilled'&&!result.value.error?{rows:result.value.data??[],error:false}:{rows:[],error:true}));setLoading(false)
   if(results.some(result=>result.status==='rejected'||result.value.error))console.warn('공개 소식 일부 조회 실패')
  })
 },0);return()=>{clearTimeout(timer);c.abort()}},[])
 return <div data-news-lists className="flex flex-1 flex-col gap-4">
  {mobile&&<div role="tablist" aria-label={uiText('공지 및 홍보')} className="mobile-news-tabs">{(['공지','홍보'] as const).map((title,i)=><button key={title} type="button" role="tab" id={`home-news-tab-${i}`} aria-controls={`home-news-panel-${i}`} aria-selected={selected===i} tabIndex={selected===i?0:-1} onClick={()=>setSelected(i)} onKeyDown={e=>{
   if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return
   e.preventDefault();const next=e.key==='Home'?0:e.key==='End'?1:1-i;setSelected(next);document.getElementById(`home-news-tab-${next}`)?.focus()
  }}><T text={title}/></button>)}</div>}
  {(['공지','홍보'] as const).map((title,i)=><section key={title} id={`home-news-panel-${i}`} role={mobile?'tabpanel':undefined} aria-labelledby={mobile?`home-news-tab-${i}`:`home-news-${i}`} aria-hidden={mobile&&selected!==i?true:undefined} inert={mobile&&selected!==i?true:undefined} data-selected={selected===i} className="flex flex-1 flex-col">
   <h2 id={`home-news-${i}`} className="mb-1.5 text-lg font-bold"><T text={title}/></h2>
   {loading?<div role="status" className="mobile-news-skeleton flex flex-1 flex-col"><span className="sr-only"><T text="소식을 불러오는 중…"/></span><ul aria-hidden="true" className="home-news-rows flex flex-1 flex-col justify-evenly">{Array.from({length:5},(_,j)=><li key={j}><div data-news-row className="home-news-row flex min-w-0 items-center gap-2 py-1 text-sm"><span className="home-news-placeholder min-w-0 flex-1"/><span className="home-news-placeholder home-news-date"/></div></li>)}</ul></div>:lists[i].error?<p role="status" className="flex-1 py-3 text-xs text-gray-500"><T text="소식을 불러오지 못했습니다. 잠시 후 다시 확인해 주세요."/></p>:!lists[i].rows.length?<p className="flex-1 py-3 text-xs text-gray-500"><T text={i?'등록된 홍보 게시물이 없습니다.':'등록된 공지가 없습니다.'}/></p>:<ul className="home-news-rows flex flex-1 flex-col justify-evenly">{lists[i].rows.map(row=><li key={row.id} data-notice-id={row.id} data-pinned={!!row.pinned_at}><Link prefetch={false} href={`/about/notice/${row.id}`} data-news-row className="home-news-row flex min-w-0 items-center gap-2 py-1 text-sm hover:text-blue-700 focus-visible:outline-2"><span className="min-w-0 flex-1 truncate">{row.pinned_at&&<span className="sr-only"><T text="상단 고정: "/></span>}<ContentTitle table="editor_0_noti" id={row.id} title={row.text} isNotice={i===0}/></span><time dateTime={row.publication_date} className="home-news-date shrink-0 text-[11px] text-gray-500">{noticeDate(row.publication_date,true)}</time></Link></li>)}</ul>}
   <Link prefetch={false} href={`/about/notice?type=${encodeURIComponent(title)}`} className="mt-2 inline-flex min-h-8 items-center justify-center self-start rounded-md border px-3 text-xs font-medium hover:bg-gray-50 focus-visible:outline-2"><T text={title}/>{' '}<T text="전체 보기"/></Link>
  </section>)}
 </div>
}
