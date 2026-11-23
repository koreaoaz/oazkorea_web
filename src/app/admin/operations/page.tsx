
import {T} from '@/components/LocaleProvider';
import Link from 'next/link'
import {Monitor} from './Monitor'
import {OwnSessions} from './sessions'
import {AdminArea} from '../area'
export const dynamic='force-dynamic'
export default function Page(){return <AdminArea superOnly><div className="space-y-6"><h1><T text="운영 관리"/></h1><p><T text="최고관리자의 추가 인증으로 보호되는 관리 기능입니다."/></p><div className="admin-grid"><Link prefetch={false} className="admin-card" href="/admin/operations/accounts"><h2><T text="관리자 계정 관리"/></h2><p><T text="독립 계정의 상태와 콘텐츠 편집 권한을 관리합니다."/></p><span><T text="관리 화면 열기 →"/></span></Link><Link prefetch={false} className="admin-card" href="/admin/operations/activity"><h2><T text="전체 작업 이력"/></h2><p><T text="작업자·기간·콘텐츠별 확정 이력을 검색합니다."/></p><span><T text="작업 이력 열기 →"/></span></Link></div><Monitor/><OwnSessions/></div></AdminArea>}
