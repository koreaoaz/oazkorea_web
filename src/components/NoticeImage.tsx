'use client'

import {imageURL} from '@/lib/image-delivery'

import {T,useUIText} from '@/components/LocaleProvider';
import {useState} from 'react'
import Image from 'next/image'
import {supabase} from '@/lib/supabaseClient'
export function NoticeImage({filename,title}:{filename:string|null;title:string}){
 const uiText=useUIText();

 const [failedFor,setFailedFor]=useState<string|null>(null)
 if(!filename)return null
 if(failedFor===filename)return <p role="status" className="mb-6 text-sm text-gray-500"><T text="첨부 이미지를 불러오지 못했습니다. 본문은 아래에서 확인할 수 있습니다."/></p>
 const src=imageURL('notice-images',filename,supabase.storage.from('notice-images').getPublicUrl(filename).data.publicUrl)
 return <Image src={src} alt={uiText(`${title} 첨부 이미지`)} width={1200} height={800} unoptimized onError={()=>setFailedFor(filename)} className="mb-6 h-auto w-full max-w-full rounded-lg object-contain"/>
}
