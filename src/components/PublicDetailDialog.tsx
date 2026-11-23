'use client'

import {useUIText} from '@/components/LocaleProvider';
import {useEffect,useId,useRef,type KeyboardEvent,type RefObject} from 'react'
export function PublicDetailDialog({title,children,onClose,returnFocusRef}:{title:React.ReactNode;children:React.ReactNode;onClose:()=>void;returnFocusRef?:RefObject<HTMLElement|null>}){
 const uiText=useUIText()
 const dialog=useRef<HTMLDialogElement>(null),previous=useRef<HTMLElement|null>(null),id=useId()
 // StrictMode의 효과 재실행 때 close 이벤트로 선택 상태가 지워지지 않도록 한다.
 // 제거된 dialog는 브라우저가 top layer에서 해제하며 기존 초점은 복원한다.
 useEffect(()=>{const node=dialog.current;previous.current??=returnFocusRef?.current??document.activeElement as HTMLElement|null;if(node&&!node.open)node.showModal()
 const priorOverflow=document.body.style.overflow
 document.body.style.overflow='hidden'
 return()=>{document.body.style.overflow=priorOverflow;previous.current?.focus()}},[returnFocusRef])
 const keepFocus=(event:KeyboardEvent<HTMLDialogElement>)=>{
  if(event.key!=='Tab')return
  const items=Array.from(event.currentTarget.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),summary,[tabindex]:not([tabindex="-1"])')).filter(element=>element.getClientRects().length>0)
  if(!items.length){event.preventDefault();event.currentTarget.focus();return}
  const current=items.indexOf(document.activeElement as HTMLElement)
  if(event.shiftKey&&current<=0){event.preventDefault();items[items.length-1].focus()}
  else if(!event.shiftKey&&(current===-1||current===items.length-1)){event.preventDefault();items[0].focus()}
 }
 return <dialog ref={dialog} tabIndex={-1} aria-labelledby={id} onClose={onClose} onClick={event=>{
   if(event.target!==event.currentTarget)return
   const rect=event.currentTarget.getBoundingClientRect()
   if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)event.currentTarget.close()
 }} onKeyDown={keepFocus} className="m-auto max-h-[85dvh] w-[calc(100%_-_2rem)] max-w-xl overflow-y-auto rounded-2xl border border-gray-200 bg-white p-5 shadow-xl backdrop:bg-black/40 sm:p-7"><div className="mb-5 flex items-start justify-between gap-4"><h2 id={id} className="min-w-0 break-words text-xl font-bold">{title}</h2><button type="button" onClick={()=>dialog.current?.close()} aria-label={uiText("닫기")} className="grid size-11 shrink-0 place-items-center rounded-lg border text-xl focus-visible:outline-2"><span aria-hidden="true">×</span></button></div>{children}</dialog>
}
