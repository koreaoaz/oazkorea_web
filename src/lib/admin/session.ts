'use client'
import {rolePasswordClient} from './role-password-policy'
import {renewPasswordSession} from './password-client'
import { supabase } from '@/lib/supabaseClient'

export async function syncAdminCookie() {
  if(rolePasswordClient){if(!await renewPasswordSession(true))throw Error('다시 로그인해 주세요.');return}
  const {data,error}=await supabase.auth.getSession()
  if(error||!data.session)throw new Error('로그인 세션을 확인해 주세요.')
  const response=await fetch('/api/admin/session',{method:'POST',credentials:'same-origin',headers:{Authorization:`Bearer ${data.session.access_token}`}})
  if(!response.ok)throw new Error('활성 관리자 세션을 확인하지 못했습니다.')
}
