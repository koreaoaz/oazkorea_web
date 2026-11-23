import {cookies} from 'next/headers'
import {ADMIN_COOKIE} from '@/lib/admin/server'
import {passwordIdentity} from '@/lib/admin/password-session-server'
import {rolePasswordEnabled} from '@/lib/admin/role-password-policy'
import {PasswordMfaForm} from './form'
export const dynamic='force-dynamic'
export default async function Page(){
 const token=(await cookies()).get(ADMIN_COOKIE)?.value
 if(!rolePasswordEnabled()||!token)return <p>최고관리자 로그인이 필요합니다.</p>
 const identity=await passwordIdentity(token).catch(()=>null)
 return identity?.role==='SUPER_ADMIN'?<PasswordMfaForm/>:<p>일반 관리자는 인증 앱 등록이 필요하지 않습니다.</p>
}
