
import {T} from '@/components/LocaleProvider';
import Link from 'next/link'
import {cookies} from 'next/headers'
import {ADMIN_COOKIE,verifiedAdminPage} from '@/lib/admin/server'
import {AdminResume} from './resume'
import {AdminShell} from './shell'
import {AdminSecurity} from './security'
export async function AdminArea({children,superOnly=false}:{children:React.ReactNode;superOnly?:boolean}){
 const s=await verifiedAdminPage((await cookies()).get(ADMIN_COOKIE)?.value)
 if(!s)return <AdminResume/>
 if(superOnly&&(!('role' in s)||s.role!=='SUPER_ADMIN'))return <AdminShell><h1><T text="운영 관리 권한이 없습니다"/></h1><p><T text="최고관리자만 사용할 수 있습니다."/></p><Link prefetch={false} href="/admin"><T text="대시보드로 돌아가기"/></Link></AdminShell>
 return <AdminShell>{'role' in s&&s.role==='SUPER_ADMIN'&&(!('aal' in s)||s.aal!=='aal2')?<AdminSecurity/>:children}</AdminShell>
}
