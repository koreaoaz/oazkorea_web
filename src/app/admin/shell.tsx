'use client'

import {LocalizedText,T,useUIText} from '@/components/LocaleProvider';
import {useSyncExternalStore} from 'react'
const subscribe=(notify:()=>void)=>{window.addEventListener('popstate',notify);return()=>window.removeEventListener('popstate',notify)}
import {SessionKeeper} from './session-keeper'
function parentMenu(path:string) {
 const parts=path.split('/').filter(Boolean)
 if(parts.length<2)return null
 if(parts[1]==='content' && parts.length>2){
   const parent='/'+parts.slice(0,-1).join('/')
   return {href:parent,ko:'상위 콘텐츠 메뉴',en:'Parent content menu'}
 }
 if(parts[1]==='operations' && parts.length>2)return {href:'/admin/operations',ko:'운영 관리',en:'Operations'}
 return {href:'/admin',ko:'관리 홈',en:'Admin home'}
}
export function AdminShell({children}:{slot?:string;superAdmin?:boolean;children:React.ReactNode}){
 const uiText=useUIText();

 const path=useSyncExternalStore(subscribe,()=>window.location.pathname,()=>'/admin')
 const parent=parentMenu(path)
 return <div className="admin-shell"><a className="admin-skip" href="#admin-main"><T text="관리 영역으로 건너뛰기"/></a><nav className="admin-nav" aria-label={uiText("관리자 메뉴")}>{[['/admin','대시보드'],['/admin/content','콘텐츠 관리'],['/admin/content/tools','번역'],['/admin/operations','운영 관리'],['/admin/trash','휴지통'],['/admin/security','내 계정 보안']].map(([href,label])=><a key={href} href={href} aria-current={(href==='/admin'?path===href:href==='/admin/content'?path.startsWith(href)&&!path.startsWith('/admin/content/tools'):path.startsWith(href))?'page':undefined}><T text={label}/></a>)}</nav><SessionKeeper/><section id="admin-main" aria-label={uiText("관리 작업")} className="admin-main" tabIndex={-1}>{parent&&<a className="mb-4 inline-flex min-h-11 items-center gap-2 text-sm underline" href={parent.href}><span aria-hidden="true">←</span><LocalizedText ko={parent.ko} en={parent.en}/></a>}{children}</section></div>
}
