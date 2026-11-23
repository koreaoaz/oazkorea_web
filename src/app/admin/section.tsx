
import {T} from '@/components/LocaleProvider';
import {cookies} from 'next/headers'
import {AdminResume} from './resume'
import {ADMIN_COOKIE,verifiedAdminPage} from '@/lib/admin/server'
import {AdminSecurity} from './security'
import {AdminShell} from './shell'
export async function SuperAdminSection({children}:{children:React.ReactNode}){
 const session=await verifiedAdminPage((await cookies()).get(ADMIN_COOKIE)?.value)
 if(!session)return <AdminResume/>
 if(!('role' in session)||session.role!=='SUPER_ADMIN')return <main className="mx-auto max-w-4xl p-8"><h1><T text="접근 권한이 없습니다."/></h1><a href="/admin"><T text="콘텐츠 관리로 돌아가기"/></a></main>
 return <AdminShell slot={'slot' in session?String(session.slot):'관리자'} superAdmin>{'aal' in session&&session.aal==='aal2'?children:<AdminSecurity/>}</AdminShell>
}
