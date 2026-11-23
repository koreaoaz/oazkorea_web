'use client'
import {useCallback,useSyncExternalStore} from 'react'

/** SSR stays identical to the existing desktop markup; CSS reserves mobile space. */
export function useMediaQuery(query:string){
 const subscribe=useCallback((notify:()=>void)=>{
  const media=window.matchMedia?.(query)
  media?.addEventListener('change',notify)
  return()=>media?.removeEventListener('change',notify)
 },[query])
 const snapshot=useCallback(()=>window.matchMedia?.(query).matches??false,[query])
 return useSyncExternalStore(subscribe,snapshot,()=>false)
}
export const useMobileViewport=()=>useMediaQuery('(max-width: 767px)')
