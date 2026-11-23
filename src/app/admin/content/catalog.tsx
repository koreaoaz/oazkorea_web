'use client'

import {AdminSessionLoading} from '@/components/AdminSessionLoading'
import {T} from '@/components/LocaleProvider';
import Link from 'next/link'
import {useEffect,useState} from 'react'
import {adminCommand} from '@/lib/admin/client'
import type {PromotionRights} from '@/lib/admin/promotion-contract'
import {BOARDS} from '@/lib/admin/boards'
export function ContentCatalog(){
 const [session,setSession]=useState<{role:string;slot:string;scopes:string[];promotion?:PromotionRights}|null>(null),[error,setError]=useState('')
 useEffect(()=>{let live=true;void adminCommand({action:'session',version:0}).then(s=>{if(live)setSession(s as typeof session)}).catch(()=>{if(live)setError('현재 편집 권한을 확인하지 못했습니다.')});return()=>{live=false}},[])
 if(!session&&!error)return <AdminSessionLoading/>
 return <div className="space-y-6"><h1><T text="콘텐츠 관리"/></h1><p><T text="콘텐츠를 선택하면 해당 게시판으로 이동합니다."/></p>{error&&<p role="alert"><T text={error}/></p>}<div className="admin-grid">{BOARDS.map(b=>{const allowed=session&&(session.role==='SUPER_ADMIN'||(b.slug==='promotions'?(session.promotion?.manualEdit||session.promotion?.approveDrafts):session.scopes.includes(b.table)));return <article className="admin-card" key={b.slug}><h2><T text={b.name}/></h2><p><T text={b.description}/></p>{allowed?<Link prefetch={false} className="admin-link-button" href={`/admin/content/${b.slug}${b.slug==='promotions'&&session?.role!=='SUPER_ADMIN'&&!session?.promotion?.manualEdit?'/approvals':''}`}><T text="게시판 열기 →"/></Link>:<p className="text-sm"><T text={session?'편집 권한 없음':'권한 확인 중'}/></p>}</article>})}<article className="admin-card"><h2><T text="명예의 전당"/></h2><p><T text="명예의 전당 항목을 추가·수정·삭제합니다."/></p>{session?<Link prefetch={false} className="admin-link-button" href="/admin/content/honor"><T text="관리 화면 열기 →"/></Link>:<p className="text-sm"><T text="최고관리자·추가 인증 필요"/></p>}</article><article className="admin-card"><h2>학회 소개</h2><p>소개 문구와 대표 이미지, 편집 권한을 관리합니다.</p><Link prefetch={false} className="admin-link-button" href="/admin/content/about">관리 화면 열기</Link></article></div></div>
}
