import {AdminArea} from '../area'
import {AdminSecurity} from '../security'
import {rolePasswordEnabled} from '@/lib/admin/role-password-policy'
import {cookies} from 'next/headers'
import {ADMIN_COOKIE} from '@/lib/admin/server'
import {passwordIdentity} from '@/lib/admin/password-session-server'
import {SelfProfile} from './self-profile'
import Link from 'next/link'
export default async function Page(){
 if(!rolePasswordEnabled())return <AdminArea><AdminSecurity general/></AdminArea>
 const token=(await cookies()).get(ADMIN_COOKIE)?.value
 const identity=token?await passwordIdentity(token).catch(()=>null):null
 return <AdminArea><section className="admin-panel space-y-4"><h1>내 계정 보안</h1><SelfProfile/><Link href="/admin/password-setup">내 비밀번호 변경</Link>{identity?.role==='SUPER_ADMIN'&&<Link href="/admin/mfa">최고관리자 추가 인증</Link>}</section></AdminArea>
}
