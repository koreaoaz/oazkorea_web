
import {T} from '@/components/LocaleProvider';
import Link from 'next/link'
export function PromotionNav({active}:{active:'board'|'approvals'}){return <nav aria-label="홍보 관리" className="flex flex-wrap gap-2"><Link prefetch={false} href="/admin/content/promotions" aria-current={active==='board'?'page':undefined} className={`admin-link-button ${active==='board'?'admin-primary':''}`}><T text="홍보 게시판"/></Link><Link prefetch={false} href="/admin/content/promotions/approvals" aria-current={active==='approvals'?'page':undefined} className={`admin-link-button ${active==='approvals'?'admin-primary':''}`}><T text="홍보 승인"/></Link></nav>}
