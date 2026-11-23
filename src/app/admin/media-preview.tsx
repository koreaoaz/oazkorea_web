'use client'

import {useUIText} from '@/components/LocaleProvider';
import {useEffect,useState} from 'react'
import Image from 'next/image'
import {imageURL} from '@/lib/image-delivery'
import {supabase} from '@/lib/supabaseClient'
export function MediaPreview({bucket,path,index}:{bucket:string;path:string;index:number}){
 const uiText=useUIText();

 const url=imageURL(bucket,path,/^https?:\/\//.test(path)?path:supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl)
 const [loaded,setLoaded]=useState<{key:string;url:string}|null>(null)
 useEffect(()=>{
  if(!url.startsWith('/api/images/'))return
  const controller=new AbortController();let object:string|undefined,live=true
  void(async()=>{try{const {data}=await supabase.auth.getSession();if(!data.session)return;const r=await fetch(url+'?preview=1',{headers:{Authorization:'Bearer '+data.session.access_token},cache:'no-store',signal:controller.signal});if(!r.ok)return;const blob=await r.blob();if(blob.size>5*1024*1024||!/^image\/(png|jpeg|webp)$/.test(blob.type)||!live)return;object=URL.createObjectURL(blob);setLoaded({key:url,url:object})}catch{/* Safe placeholder preserves editing. */}})()
  return()=>{live=false;controller.abort();if(object)URL.revokeObjectURL(object)}
 },[url])
 const src=url.startsWith('/api/images/')?(loaded?.key===url?loaded.url:'/placeholder.svg'):url
 return <Image src={src} alt={uiText(`이미지 미리보기 ${index+1}`)} width={240} height={135} unoptimized className="h-auto max-w-full object-contain"/>
}
