'use client'

import {T} from '@/components/LocaleProvider';
import {AdminSessionLoading} from '@/components/AdminSessionLoading'
import Link from 'next/link'
import {useEffect,useRef,useState} from 'react'
import {useRouter} from 'next/navigation'
import {supabase} from '@/lib/supabaseClient'
import {rolePasswordClient} from '@/lib/admin/role-password-policy'
import {renewPasswordSession} from '@/lib/admin/password-client'
import {syncAdminCookie} from '@/lib/admin/session'
export function AdminResume(){
 const router=useRouter(),task=useRef<Promise<boolean>|null>(null),[error,setError]=useState('')
 useEffect(()=>{let live=true;const timeout=setTimeout(()=>{if(live)setError('관리자 세션을 확인하지 못했습니다. 연결 상태와 현재 계정 권한을 확인해 주세요.')},20000);task.current??=(async()=>{if(rolePasswordClient)return !!await renewPasswordSession();const {data,error}=await supabase.auth.getSession();if(error)throw error;if(!data.session)return false;await syncAdminCookie();return true})();void task.current.then(ok=>{if(live){if(ok)router.refresh();else router.replace('/admin/login')}}).catch(()=>{if(live)setError('관리자 세션을 확인하지 못했습니다. 연결 상태와 현재 계정 권한을 확인해 주세요.')});return()=>{live=false;clearTimeout(timeout)}},[router])
 if (!error) return <AdminSessionLoading/>
 return <section className="admin-panel"><h1><T text="관리자 세션 확인"/></h1><p role="alert"><T text={error}/></p>{error&&<Link prefetch={false} href="/admin/login"><T text="로그인 화면으로 이동"/></Link>}</section>
}
