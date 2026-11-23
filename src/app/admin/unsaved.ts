'use client'
import {useEffect,useRef} from 'react'
import {useLocale,translateUI} from '@/components/LocaleProvider'
export function useUnsavedChanges(dirty:boolean){
 const locale=useLocale()
 const allowed=useRef(false)
 useEffect(()=>{if(!dirty)return;let timer:ReturnType<typeof setTimeout>|undefined
 const unload=(e:BeforeUnloadEvent)=>{if(!allowed.current){e.preventDefault();e.returnValue=''}}
 const click=(e:MouseEvent)=>{const a=(e.target as Element)?.closest?.('a[href]');if(!a||a.getAttribute('target')==='_blank'||e.defaultPrevented)return;const url=new window.URL((a as HTMLAnchorElement).href,window.location.href);if(url.href===window.location.href)return;if(!window.confirm(translateUI('저장하지 않은 변경사항이 있습니다. 이동할까요?',locale))){e.preventDefault();e.stopImmediatePropagation()}else{allowed.current=true;timer=setTimeout(()=>{allowed.current=false},2000)}}
 window.addEventListener('beforeunload',unload);document.addEventListener('click',click,true);return()=>{window.removeEventListener('beforeunload',unload);document.removeEventListener('click',click,true);if(timer)clearTimeout(timer);allowed.current=false}
 },[dirty,locale])
}
