// app/layout.tsx

import "./globals.css";
import "./mobile-ui.css";
import { ReactNode } from "react";
import {headers} from "next/headers";
import {LocaleProvider} from "@/components/LocaleProvider";
import {parseLocale,localeURL} from "@/lib/locale";
import Navigation from "@/components/home/Navigation";
import {TrafficProvider} from "@/components/TrafficProvider";
import Footer from "@/components/home/Footer";
import {APP_VERSION} from '@/lib/version';


export async function generateMetadata(){
 const h=await headers(),locale=parseLocale(h.get("x-oaz-locale")),path=h.get("x-oaz-path")||"/";
 const description=locale==="en"?"OaZ academic society: studies, projects and activities.":"OaZ의 소식과 프로젝트를 확인할 수 있는 공식 페이지입니다.";
 const base=process.env.OAZ_ADMIN_ORIGIN||"https://www.oazkorea.co.kr";
 const pages:Record<string,[string,string]>={
  '/':['하나와영','One and Zero'], '/about/who-we-are':['학회 소개','Who We Are'],
  '/about/notice':['공지·홍보','Notices and Recruitment'], '/projects/archives':['프로젝트 기록','Project Records'],
  '/studies/records':['스터디 기록','Study Records'], '/studies/schedule':['학회방 시간표','Room Schedule'],
  '/news':['학회 소식','News'], '/admin/login':['관리자 로그인','Administrator Login']
 }
 const label=pages[path]?.[locale==='en'?1:0]
 const title=label?label+' | OaZ':'OaZ'
 return {metadataBase:new URL(base),title,description,generator:`OaZ local review ${APP_VERSION}`,alternates:{canonical:localeURL(path,locale),languages:{ko:localeURL(path,"ko"),en:localeURL(path,"en")}},openGraph:{title,description,images:["/oaz_w_bg.png"]}};
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale=parseLocale((await headers()).get("x-oaz-locale"));
  return (
    <html lang={locale}>
      <body className="min-h-screen bg-white ">
        {/* 공통 배경 */}
        <div className="fixed inset-0 bg-gradient-to-br from-gray-50 via-white to-gray-50 pointer-events-none" />
        <div className="fixed top-0 left-1/2 transform -translate-x-1/2 w-[800px] h-[600px] bg-gradient-to-r from-blue-50/50 via-purple-50/30 to-pink-50/50 rounded-full blur-3xl pointer-events-none" />
        
        <LocaleProvider locale={locale}><TrafficProvider><div className="relative">
          <Navigation />
          <main className="relative z-10 pt-16 px-4 sm:px-6 lg:px-8">
            {process.env.OAZ_FINAL_INTEGRATION==='true'&&<aside role="note" className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-950">{process.env.OAZ_FINAL_ACCEPTANCE==='true'?(locale==='en'?'Local acceptance · Public content copies · Separate test accounts · No production changes':'로컬 인수 검수 · 공개 자료 사본 · 별도 테스트 계정 · 운영 환경 변경 없음'):(locale==='en'?'Isolated local review · Synthetic content · No production changes':'격리 로컬 검수 · 합성 테스트 자료 · 운영 환경 변경 없음')}</aside>}
            {children}
          </main>
          <Footer />
        </div></TrafficProvider></LocaleProvider>
      </body>
    </html>
  );
}
