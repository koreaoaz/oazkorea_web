'use client'
import {useEffect,useState} from 'react'
import {publicContentRpc} from '@/lib/public-content-rpc'

export type ContentMeta={translationStatus?:string;fallbackTitle?:string;translation?:{title:string;body:string}|null;closesOn?:string|null;opensOn?:string|null;activityOn?:string|null;receivedAt?:string|null}

export function noticeEnglishStatus(meta: ContentMeta | null | undefined) {
  if (meta === undefined) return 'Loading English translation…'
  if (meta?.translationStatus === 'pending') return 'English translation is in progress.'
  if (meta?.translationStatus === 'retry') return 'English translation will be retried.'
  return 'English translation is unavailable.'
}

export function usePublicContentMeta(table:string,id:number,sourceKey:string,enabled=true){
 const [result,setResult]=useState<{key:string;meta:ContentMeta|null}|null>(null)
 useEffect(()=>{
   if(!enabled)return
   let live=true,running=false
   let timer:ReturnType<typeof setTimeout>
   async function refresh(){
     if(!live||running)return
     running=true
     clearTimeout(timer)
     const {data,error}=await publicContentRpc<ContentMeta>('oaz_public_content_meta_v1',{tbl:table,rid:id})
     running=false
     if(!live)return
     setResult({key:sourceKey,meta:error?null:data})
     if(table==='editor_0_noti'&&(error||data?.translationStatus==='pending'||data?.translationStatus==='retry')){
       timer=setTimeout(()=>{if(!document.hidden)void refresh()},data?.translationStatus==='pending'?5000:30000)
     }
   }
   const onVisible=()=>{if(!document.hidden)void refresh()}
   void refresh()
   if(table==='editor_0_noti')document.addEventListener('visibilitychange',onVisible)
   return ()=>{live=false;clearTimeout(timer);document.removeEventListener('visibilitychange',onVisible)}
 },[table,id,sourceKey,enabled])
 return enabled&&result?.key===sourceKey?result.meta:undefined
}
