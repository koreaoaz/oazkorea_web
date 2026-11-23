'use client'
import {useRouter} from 'next/navigation'
import {AdminSecurity} from '../security'
import {supabase} from '@/lib/supabaseClient'
import {renewPasswordSession} from '@/lib/admin/password-client'
import {rolePasswordClient} from '@/lib/admin/role-password-policy'
export function PasswordMfaForm(){
 const router=useRouter()
 if(!rolePasswordClient)return <p>이 경로는 활성화되지 않았습니다.</p>
 return <AdminSecurity onVerified={async()=>{
  const s=(await supabase.auth.getSession()).data.session;if(!s)throw Error('다시 로그인해 주세요.')
  const activated=await fetch('/api/admin/password-enrollment',{method:'POST',headers:{Authorization:'Bearer '+s.access_token}})
  if(!activated.ok)throw Error('최고관리자 등록 상태를 확인해 주세요.')
  const next=await renewPasswordSession(true);if(!next||next==='/admin/mfa')throw Error('추가 인증을 확인하지 못했습니다.')
  router.replace(next);router.refresh()
 }}/>
}
