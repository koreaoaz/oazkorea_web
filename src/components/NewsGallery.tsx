'use client'
import {useState,useSyncExternalStore} from 'react'
import {ChevronLeft,ChevronRight} from 'lucide-react'
import {useLocale} from './LocaleProvider'
import Image from 'next/image'

const subscribe=()=>()=>{}
const clientReady=()=>true
const serverReady=()=>false

export function NewsGallery({images,title}:{images:string[];title:string}) {
  const interactive=useSyncExternalStore(subscribe,clientReady,serverReady)
  const [index,setIndex]=useState(0)
  const [loaded,setLoaded]=useState('')
  const [failed,setFailed]=useState('')
  const en=useLocale()==='en'
  const urls=[...new Set(images)]
  const src=urls[index]
  if (!src) return null
  const move=(direction:number)=>setIndex(i=>Math.max(0, Math.min(urls.length-1, i+direction)))
  const label=en?'News images':'카드뉴스 이미지'
  return <section aria-label={label} data-news-gallery tabIndex={0} className="space-y-3" onKeyDown={e=>{
    if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();move(e.key==='ArrowLeft'?-1:1)}
  }}>
    {urls.length>1&&<div className="flex items-center justify-between gap-3"><button type="button" className="grid size-11 place-items-center rounded-lg border disabled:opacity-30" aria-label={en?'Previous image':'이전 이미지'} disabled={!interactive||index===0} onClick={()=>move(-1)}><ChevronLeft/></button><span aria-live="polite" className="text-sm tabular-nums">{index+1} / {urls.length}</span><button type="button" className="grid size-11 place-items-center rounded-lg border disabled:opacity-30" aria-label={en?'Next image':'다음 이미지'} disabled={!interactive||index===urls.length-1} onClick={()=>move(1)}><ChevronRight/></button></div>}
    {failed===src?<p role="status" className="rounded-xl bg-zinc-50 p-6">{en?'This image is unavailable.':'이미지를 불러오지 못했습니다.'}</p>:<div className="rounded-xl bg-zinc-50">{loaded!==src&&<span role="status" className="sr-only">{en?'Loading image':'이미지 로딩 중'}</span>}<Image key={src} unoptimized loading="eager" width={900} height={900} src={src} alt={title+' · '+label+' '+(index+1)} onLoad={()=>setLoaded(src)} onError={()=>setFailed(src)} className="mx-auto block h-auto max-h-[80dvh] w-auto max-w-full object-contain"/></div>}
  </section>
}

