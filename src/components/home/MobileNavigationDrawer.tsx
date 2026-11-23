'use client'
import * as Dialog from '@radix-ui/react-dialog'
import Link from 'next/link'
import {X,ChevronDown} from 'lucide-react'
import {useEffect,useState,type RefObject,type MouseEvent} from 'react'
import {usePathname} from 'next/navigation'
import {PUBLIC_NAV_ITEMS,isPublicNavActive,isPublicLinkActive} from '@/lib/public-navigation'
import {T,LocalizedText,useLocale,useUIText} from '@/components/LocaleProvider'

type Props={open:boolean;onOpenChange:(open:boolean)=>void;trigger:RefObject<HTMLButtonElement|null>;isAdmin:boolean;isLoggedIn:boolean;authPending:boolean;onAdmin:(e:MouseEvent<HTMLAnchorElement>)=>Promise<void>;onLogout:()=>Promise<void>}
export function MobileNavigationDrawer({open,onOpenChange,trigger,isAdmin,isLoggedIn,authPending,onAdmin,onLogout}:Props){
 const english=useLocale()==='en'
 const [expanded,setExpanded]=useState<string|null>(null),uiText=useUIText(),path=usePathname()
 // Also close when navigation happens outside a menu click (back/forward).
 useEffect(()=>()=>onOpenChange(false),[path,onOpenChange])
 return <Dialog.Root open={open} onOpenChange={onOpenChange}>
  <Dialog.Portal>
   <Dialog.Overlay className="mobile-drawer-overlay"/>
   <Dialog.Content className="mobile-drawer" aria-describedby={undefined} onCloseAutoFocus={e=>{e.preventDefault();trigger.current?.focus()}}>
    <div className="mobile-drawer-heading"><Dialog.Title className="font-bold"><LocalizedText ko="전체 메뉴" en="Navigation"/></Dialog.Title><Dialog.Close aria-label={uiText('메뉴 닫기')}><X aria-hidden="true"/></Dialog.Close></div>
    <div className="mobile-drawer-scroll">
     <nav aria-label={uiText('주요 메뉴')}>
      {PUBLIC_NAV_ITEMS.map((item,index)=><div key={item.name} className="mobile-drawer-group">
       {item.subItems.length>1?<>
        <button type="button" data-active={isPublicNavActive(item.name,path)} aria-expanded={expanded===item.name} aria-controls={`drawer-submenu-${index}`} onClick={()=>setExpanded(expanded===item.name?null:item.name)}><T text={item.name}/><ChevronDown aria-hidden="true" className={expanded===item.name?'rotate-180':''}/></button>
        <div id={`drawer-submenu-${index}`} hidden={expanded!==item.name} className="mobile-drawer-submenu">{item.subItems.map(sub=><Link key={sub.href} href={sub.href} aria-current={isPublicLinkActive(sub.href,path)?'page':undefined} onClick={()=>onOpenChange(false)}><T text={sub.name}/></Link>)}</div>
       </>:<Link href={item.href} data-active={isPublicNavActive(item.name,path)} aria-current={isPublicLinkActive(item.href,path)?'page':undefined} onClick={()=>onOpenChange(false)}><T text={item.name}/></Link>}
      </div>)}
     </nav>
     <div className="mobile-drawer-auth"><Link href={isAdmin?'/admin':'/admin/login'} aria-label={isAdmin?(english?'Go to admin page':'관리 페이지로 이동'):undefined} aria-disabled={authPending} onClick={e=>{onOpenChange(false);if(isAdmin)void onAdmin(e)}}><LocalizedText ko={isAdmin?'관리':'관리자 로그인'} en={isAdmin?'Admin':'Admin login'}/></Link>{isLoggedIn&&<button type="button" disabled={authPending} onClick={()=>{onOpenChange(false);void onLogout()}}>Log out</button>}</div>
    </div>
   </Dialog.Content>
  </Dialog.Portal>
 </Dialog.Root>
}
