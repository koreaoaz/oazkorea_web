'use client'
import Image, {type ImageProps} from 'next/image'
import {useState} from 'react'
import {imageURL} from '@/lib/image-delivery'
/** Neutral fallback, never an invented photo of the activity. */
export function ContentImage({src,alt,...props}:ImageProps){
 const [failed,setFailed]=useState<string|null>(null)
 const actual=typeof src==='string'&&/^https?:\/\//.test(src)?imageURL('project_img',src,src):src
 return <Image {...props} src={failed===String(actual)?'/placeholder.svg':actual} alt={alt} onError={()=>setFailed(String(actual))}/>
}
