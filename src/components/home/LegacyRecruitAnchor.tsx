'use client'
import {useEffect} from 'react'
import {useRouter} from 'next/navigation'

// Fragments are not sent to the server. Keep historical FAQ bookmarks useful
// without passing any client-supplied redirect destination to the router.
export function LegacyRecruitAnchor(){
 const router=useRouter()
 useEffect(()=>{
  const follow=()=>{if(['#faq','#recruit-faq'].includes(window.location.hash.toLowerCase()))router.replace('/recruit/faq'+window.location.search+'#faq')}
  follow();window.addEventListener('hashchange',follow)
  return()=>window.removeEventListener('hashchange',follow)
 },[router])
 return null
}
