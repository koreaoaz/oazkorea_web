"use client";

import {endPasswordSession} from '@/lib/admin/password-client';
import {AdminSessionClock} from '@/components/AdminSessionClock';
import {rolePasswordClient} from '@/lib/admin/role-password-policy';
import {T,useLocale,useUIText} from '@/components/LocaleProvider';
import {PUBLIC_NAV_ITEMS,isPublicNavActive,isPublicLinkActive} from '@/lib/public-navigation'

import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { LogOut, Menu, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from '@/lib/supabaseClient';
import Link from "next/link";
import {usePathname} from 'next/navigation';

import { adminCommand } from '@/lib/admin/client';
import {syncAdminCookie} from '@/lib/admin/session';
import {LanguageSwitch,LocalizedText} from '@/components/LocaleProvider';
import {APP_VERSION} from '@/lib/version';
import {useMobileViewport} from '@/hooks/useMobileViewport';
import {MobileNavigationDrawer} from './MobileNavigationDrawer';

export default function Navigation() {
 const uiText=useUIText(),english=useLocale()==='en';
 const mobile=useMobileViewport(),menuTrigger=useRef<HTMLButtonElement>(null);
 const path=usePathname(),navigation=useRef<HTMLElement>(null),header=useRef<HTMLElement>(null);

  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [openMobileMenus, setOpenMobileMenus] = useState<{ [key: string]: boolean }>({});
  const [hoveredMenu, setHoveredMenu] = useState<string | null>(null);
  const hoverTimer = useRef<NodeJS.Timeout | null>(null);
  const [authKnown,setAuthKnown]=useState(false);
  const [roleChecked,setRoleChecked]=useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [activeClock,setActiveClock]=useState<string|null>(null);
  const [sessionId,setSessionId]=useState<string|null>(null);
  const readyToSignOut=isLoggedIn&&(!rolePasswordClient||(roleChecked&&(!isAdmin||sessionId===activeClock||activeClock==='unavailable')));
  const identity=useRef<string|null>(null);
  const showAdmin=isAdmin&&(!rolePasswordClient||(sessionId!==null&&sessionId===activeClock));
  

  const [authError, setAuthError] = useState<string | null>(null);
  const [authPending, setAuthPending] = useState(false);
  const authLock = useRef(false);
  const handleAdmin = async (event:React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();if(authLock.current)return;authLock.current=true;setAuthPending(true);setAuthError(null);
    try {await syncAdminCookie();
      // 서버가 검증한 새 접근 쿠키로 전체 페이지를 요청한다.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign('/admin');
    }catch{setAuthError('관리자 세션을 확인하지 못했습니다. 연결 상태와 권한을 확인해 주세요.');authLock.current=false;setAuthPending(false)}
  };
  const handleLogout = async () => {
    try {
      if(rolePasswordClient){
        await endPasswordSession();
        window.location.replace('/admin/login');
        return;
      }
      if (isAdmin) {
        const response = await fetch('/api/admin/session', {method:'DELETE'});
        if (!response.ok) throw new Error('ADMIN_LOGOUT_FAILED');
      }
      const { error } = await supabase.auth.signOut({scope:'local'});
      if (error) throw error;
      setIsLoggedIn(false);
      setIsAdmin(false);
    } catch { setAuthError("로그아웃하지 못했습니다. 연결 상태를 확인해 주세요."); }
  };

  useEffect(() => {
    let active = true, generation = 0;
    let adminTimer: ReturnType<typeof setTimeout> | undefined;
    const checkAdmin = (userId:string|null, id:string|null=null, assurance:string|null=null) => {
      const principal=userId ? JSON.stringify([userId,id,assurance]) : null;
      const signedIn=!!userId;
      if(!signedIn||identity.current!==principal){setIsAdmin(false);setRoleChecked(false)}
      setAuthKnown(true);
      identity.current=principal;
      setSessionId(id);
      setIsLoggedIn(signedIn);
      const current = ++generation;
      if (adminTimer) clearTimeout(adminTimer);
      if(process.env.NEXT_PUBLIC_OAZ_DESKTOP_INTEGRATION==='owned-v1'&&(path==='/admin/login'||path.startsWith('/admin/enrollment'))){setIsAdmin(false);setRoleChecked(true);return;}
      // 인증 콜백 안에서 Supabase 세션을 재조회하면 잠금이 걸릴 수 있어 다음 작업으로 미룬다.
      if (signedIn) adminTimer = setTimeout(() => { void (async()=>{
        if(!rolePasswordClient&&process.env.NEXT_PUBLIC_OAZ_DESKTOP_INTEGRATION==='owned-v1'){
          const {data}=await supabase.auth.mfa.getAuthenticatorAssuranceLevel();if(data?.currentLevel!=='aal2')return null;
        }
        return adminCommand({action:'session',version:0});
      })().then(value => {
        if (active && current === generation) {setRoleChecked(true);setIsAdmin(!!value && typeof value === 'object' && 'role' in value && ['ADMIN','SUPER_ADMIN'].includes(String(value.role)));}
      }).catch(() => { if(active && current === generation){setIsAdmin(false);setRoleChecked(true)} }); }, 0);
    };
    // Token claims identify session changes only. The server decides access on every check.
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      let id=null,aal=null;
      if(session){
        try {
          const payload=session.access_token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/');
          const claims=JSON.parse(window.atob(payload));
          id=typeof claims.session_id==='string'?claims.session_id:null;
          aal=typeof claims.aal==='string'?claims.aal:null;
        } catch { /* A malformed token cannot match a verified clock. */ }
      }
      if(active)checkAdmin(session?.user.id??null,id,aal);
    });
    // Password sessions hydrate from INITIAL_SESSION. Legacy callers also use getUser.
    if(!rolePasswordClient)void supabase.auth.getUser().then(({data:{user}})=>{
      if(active&&generation===0)checkAdmin(user?.id??null);
    }).catch(()=>{if(active&&generation===0)checkAdmin(null)});

    return () => {
      active = false; generation++; if(adminTimer) clearTimeout(adminTimer);
      authListener.subscription.unsubscribe();
    };
  }, [path]);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(()=>{
    const closeOutside=(event:PointerEvent)=>{
      if(!navigation.current?.contains(event.target as Node))setHoveredMenu(null);
      if(!header.current?.contains(event.target as Node)&&!(event.target instanceof Element&&event.target.closest('.mobile-drawer')))setIsMobileMenuOpen(false);
    };
    document.addEventListener('pointerdown',closeOutside);
    // Hover disclosures must also be dismissible when the keyboard focus is
    // outside the menu. The focused-menu handler still restores its trigger.
    const dismissHover=(event:KeyboardEvent)=>{if(event.key==='Escape'){if(hoverTimer.current)clearTimeout(hoverTimer.current);setHoveredMenu(null)}};
    document.addEventListener('keydown',dismissHover);
    return()=>{document.removeEventListener('pointerdown',closeOutside);document.removeEventListener('keydown',dismissHover);if(hoverTimer.current)clearTimeout(hoverTimer.current)};
  },[]);

  useEffect(()=>{
    const desktop=window.matchMedia?.('(min-width: 1200px)');
    const drawer=window.matchMedia?.('(max-width: 767px)');
    const resetMenus=()=>{setIsMobileMenuOpen(false);setOpenMobileMenus({});setHoveredMenu(null);if(hoverTimer.current)clearTimeout(hoverTimer.current)};
    desktop?.addEventListener('change',resetMenus);
    drawer?.addEventListener('change',resetMenus);
    return()=>{desktop?.removeEventListener('change',resetMenus);drawer?.removeEventListener('change',resetMenus)};
  },[]);

  const toggleMobileMenu = (menuName: string) => {
    setOpenMobileMenus((prev) => {
      if (prev[menuName]) {
        return {};
      }
      return { [menuName]: true };
    });
  };

  const handleMouseLeave = () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => {
      setHoveredMenu(null);
    }, 300); // 0.3초 뒤에 닫힘 (원하는 시간대로 조절)
  };

  const handleMouseEnter = (name: string) => {
    if (hoverTimer.current) {
      clearTimeout(hoverTimer.current);
    }
    setHoveredMenu(name);
  };

  const navItems = PUBLIC_NAV_ITEMS;

  return (
    <motion.header
      ref={header}
      onKeyDown={e=>{if(e.key==='Escape'&&isMobileMenuOpen){setIsMobileMenuOpen(false);menuTrigger.current?.focus()}}}
      className={`fixed top-0 w-full z-50 transition-all duration-300 ${isScrolled
          ? 'bg-white/80 backdrop-blur-xl border-b border-gray-200/50'
          : 'bg-transparent'
        }`}
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
    >
      {authError && <p role="alert" className="bg-white px-4 text-sm text-red-600">{authError}</p>}
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] min-[1200px]:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center h-16 gap-2">
          {/* Logo */}
          <div
            className="flex shrink-0 items-center space-x-2"
          >
            <Link href="/" data-home-logo aria-label={uiText('OaZ 홈')} className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-black rounded-md flex items-center justify-center">
                <div className="w-4 h-4 bg-white rounded-sm" />
              </div>
              <span className="text-xl font-bold tracking-tight text-gray-900">OaZ</span>
              <span className="hidden min-[360px]:inline text-xs font-medium text-gray-500" title={uiText('로컬 검수 버전 · 운영 배포 아님')} aria-label={uiText(`버전 ${APP_VERSION}`)}>v{APP_VERSION}</span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <nav ref={navigation} data-public-nav aria-label={uiText("주요 메뉴")} className="hidden min-[1200px]:flex flex-nowrap justify-center items-center gap-3 xl:gap-5 text-sm whitespace-nowrap">
            {navItems.map((item, index) => (
              <div
                key={item.name}
                className="relative group"
                onPointerEnter={event => {if(event.pointerType!=='touch')handleMouseEnter(item.name)}}
                onMouseLeave={handleMouseLeave}
                onBlur={e => {if(!e.currentTarget.contains(e.relatedTarget))setHoveredMenu(null)}}
                onKeyDown={e => {
                  if(e.key==='Escape'){e.preventDefault();e.currentTarget.querySelector('button')?.focus();setHoveredMenu(null)}
                  if(e.key==='ArrowDown'&&e.target===e.currentTarget.querySelector('button')){
                    e.preventDefault();handleMouseEnter(item.name);const group=e.currentTarget;
                    requestAnimationFrame(()=>group.querySelector<HTMLAnchorElement>('[data-public-submenu] a')?.focus());
                  }
                }}
              >
                <button type="button" data-active={isPublicNavActive(item.name,path)} onClick={()=>{if(hoverTimer.current)clearTimeout(hoverTimer.current);setHoveredMenu(current=>current===item.name?null:item.name)}} aria-expanded={hoveredMenu===item.name} aria-controls={`public-submenu-${index}`} className="text-gray-600 hover:text-gray-900 data-[active=true]:text-gray-950 data-[active=true]:underline underline-offset-8 font-medium transition-colors duration-200 relative rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4">
                  <motion.div
                    whileHover={{ y: -1 }}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 + 0.3 }}
                  >
                    <T text={item.name}/>
                  </motion.div>
                </button>
                {/* 조건부 렌더링*/}
                <AnimatePresence>
                {item.subItems && hoveredMenu === item.name && (
                  <motion.div id={`public-submenu-${index}`} data-public-submenu initial={{opacity:0,y:-4}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-4}} transition={{duration:0.12}} className="absolute left-0 top-full pt-2 w-48 z-50">
                    <div className="overflow-hidden bg-white border border-gray-200 rounded-md shadow-lg">
                    {item.subItems.map((subItem) => (
                        <Link
                          key={subItem.name}
                          href={subItem.href}
                          aria-current={isPublicLinkActive(subItem.href,path)?'page':undefined}
                          onClick={()=>setHoveredMenu(null)}
                          className="block px-4 py-2 text-gray-600 hover:bg-gray-100 hover:text-gray-900 aria-[current=page]:bg-gray-100 aria-[current=page]:text-gray-950"
                        >
                          <T text={subItem.name}/>
                        </Link>
                    ))}
                    </div>
                  </motion.div>
                )}
                </AnimatePresence>
              </div>
            ))}
          </nav>


          {/* Symmetric side tracks keep the menu at the viewport centre. */}
          <div className="flex items-center justify-end gap-1.5">
           {rolePasswordClient&&<AdminSessionClock visible={showAdmin} onActiveSession={setActiveClock}/>}
          {rolePasswordClient&&readyToSignOut&&<button type="button" onClick={handleLogout}
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-md bg-black text-white min-[1200px]:hidden">
            <LogOut size={16} aria-hidden="true"/><span className="sr-only"><LocalizedText ko="로그아웃" en="Log out"/></span>
          </button>}
          <div className="hidden min-[1200px]:flex items-center gap-1.5">

            {readyToSignOut ? (
              <Button onClick={handleLogout} variant="ghost" className="bg-black hover:bg-gray-800 text-white px-3">
                Log out
              </Button>
            ) : authKnown&&!isLoggedIn&&(
              <Link href="/admin/login" className="rounded-md bg-black px-2.5 py-2 whitespace-nowrap text-sm text-white"><LocalizedText ko="관리자 로그인" en="Admin login"/></Link>
            )}

            {showAdmin && <Link href="/admin" onClick={handleAdmin} aria-disabled={authPending} aria-label={english?'Go to admin page':'관리 페이지로 이동'} className="inline-flex h-9 items-center rounded-md bg-black px-3 text-sm font-medium text-white"><LocalizedText ko="관리" en="Admin"/></Link>}

          </div>

          <LanguageSwitch compact/>
          {/* Mobile Menu Button */}
          <Button
            ref={menuTrigger}
            data-menu-trigger
            variant="ghost"
            size="icon"
            className="min-[1200px]:hidden shrink-0"
            aria-label={uiText(isMobileMenuOpen?'메뉴 닫기':'메뉴 열기')}
            aria-expanded={isMobileMenuOpen}
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </Button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && !mobile && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="min-[1200px]:hidden max-h-[calc(100dvh-4rem)] overflow-y-auto bg-white border-t border-gray-200"
          >
            <div className="px-4 py-6 space-y-3">
              <div className="flex flex-wrap gap-3 border-b pb-4"><Link className="px-3 py-2" href={showAdmin?"/admin":"/admin/login"} aria-label={showAdmin?(english?"Go to admin page":"관리 페이지로 이동"):undefined} onClick={showAdmin?handleAdmin:undefined}><LocalizedText ko={showAdmin?"관리":"관리자 로그인"} en={showAdmin?"Admin":"Admin login"}/></Link>{readyToSignOut&&<Button onClick={handleLogout}>Log out</Button>}</div>
              {navItems.map((item) => (
                <div key={item.name}>
                  <button
                    aria-expanded={!!openMobileMenus[item.name]}
                    data-active={isPublicNavActive(item.name,path)}
                    aria-controls={`mobile-submenu-${item.name}`}
                    onClick={() => toggleMobileMenu(item.name)}
                    className="flex justify-between w-full text-gray-600 hover:text-gray-900 data-[active=true]:text-gray-950 data-[active=true]:underline font-medium"
                  >
                    <T text={item.name}/>
                  </button>
                  {item.subItems && (
                    <AnimatePresence>
                      {openMobileMenus[item.name] && (
                        <motion.div
                          id={`mobile-submenu-${item.name}`}
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.3 }}
                          className="overflow-hidden ml-4 mt-1 space-y-2"
                        >
                          {item.subItems.map((subItem) => (
                              <Link
                                key={subItem.name}
                                href={subItem.href}
                                aria-current={isPublicLinkActive(subItem.href,path)?'page':undefined}
                                onClick={()=>setIsMobileMenuOpen(false)}
                                className="block text-gray-500 hover:text-gray-800 text-sm"
                              >
                                <T text={subItem.name}/>
                              </Link>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {mobile&&<MobileNavigationDrawer open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen} trigger={menuTrigger} isAdmin={showAdmin} isLoggedIn={readyToSignOut} authPending={authPending} onAdmin={handleAdmin} onLogout={handleLogout}/>}
    </motion.header>
  );
}
