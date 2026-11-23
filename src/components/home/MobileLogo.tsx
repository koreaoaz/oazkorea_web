'use client'
import {useEffect,useRef,useState} from 'react'
import Image from 'next/image'
import {useMediaQuery} from '@/hooks/useMobileViewport'
import {useUIText} from '@/components/LocaleProvider'

/** Same source animation, with opaque H.264 and a source-frame fallback. */
export function MobileLogo(){
 const video=useRef<HTMLVideoElement>(null),[playing,setPlaying]=useState(false)
 const reduced=useMediaQuery('(prefers-reduced-motion: reduce)'),uiText=useUIText()
 useEffect(()=>{
  const current=video.current
  if(!current)return
  if(reduced){current.pause();return}
  let active=true
  void current.play().catch(()=>{if(active)setPlaying(false)})
  return()=>{active=false;current.pause()}
 },[reduced])
 const replay=()=>{
  const current=video.current
  if(!current||reduced)return
  current.currentTime=0
  void current.play().catch(()=>setPlaying(false))
 }
 return <button type="button" className="mobile-logo" data-playing={playing&&!reduced} disabled={reduced} onClick={replay} aria-label={uiText(reduced?'OaZ 로고':'OaZ 로고 애니메이션 다시 재생')}>
  <Image src="/oaz-mobile-poster.png" alt="OaZ" width={1920} height={730} unoptimized loading="eager" className="mobile-logo-poster"/>
  <video ref={video} poster="/oaz-mobile-poster.png" muted playsInline autoPlay={!reduced} preload="auto" aria-hidden="true" onPlaying={()=>setPlaying(true)} onPause={()=>setPlaying(false)} onEnded={()=>setPlaying(false)} onError={()=>setPlaying(false)}>
   <source src="/oaz-mobile.mp4" type="video/mp4"/>
   <source src="/oaz.webm" type="video/webm"/>
  </video>
 </button>
}
