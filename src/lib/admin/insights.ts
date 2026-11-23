'use client'
import {supabase} from '@/lib/supabaseClient'
export async function insights(command:Record<string,unknown>,signal?:AbortSignal){const {data}=await supabase.auth.getSession();if(!data.session)throw Error('로그인이 필요합니다.');const r=await fetch('/api/admin/insights',{method:'POST',cache:'no-store',signal,headers:{'Content-Type':'application/json',Authorization:`Bearer ${data.session.access_token}`},body:JSON.stringify(command)});if(!r.ok)throw Error(r.status===403?'이 통계를 조회할 권한이 없습니다.':'통계를 불러오지 못했습니다. 기간과 로컬 개발 환경을 확인해 주세요.');return (await r.json()).result}
