'use client'
import {useEffect} from 'react'
import {syncAdminCookie} from '@/lib/admin/session'
import {supabase} from '@/lib/supabaseClient'
export function SessionKeeper(){
 useEffect(()=>{let live=true,pending=false;const renew=async()=>{if(!live||pending||document.visibilityState==='hidden')return;pending=true;try{await syncAdminCookie()}catch{/* 서버/API 권한은 매 요청 검증하며 세션을 임의 삭제하지 않는다. */}finally{pending=false}};const timer=setInterval(()=>void renew(),240000);const show=()=>{if(document.visibilityState==='visible')void renew()};document.addEventListener('visibilitychange',show);const {data}=supabase.auth.onAuthStateChange(event=>{if(event==='TOKEN_REFRESHED')setTimeout(()=>void renew(),0)});return()=>{live=false;clearInterval(timer);document.removeEventListener('visibilitychange',show);data.subscription.unsubscribe()}},[])
 return null
}
