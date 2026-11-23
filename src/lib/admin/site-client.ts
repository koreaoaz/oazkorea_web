'use client'
import {supabase} from '@/lib/supabaseClient'
import type {SiteCommand} from './site-management'
export async function siteCommand<T>(command:Omit<SiteCommand,'requestId'>&{requestId?:string}):Promise<T>{
 const {data,error}=await supabase.auth.getSession()
 if(error||!data.session)throw Error('로그인과 MFA 인증을 확인해 주세요.')
 const response=await fetch('/api/admin/site-management',{method:'POST',cache:'no-store',headers:{'Content-Type':'application/json',Authorization:'Bearer '+data.session.access_token},body:JSON.stringify({...command,requestId:command.requestId??crypto.randomUUID()})})
 if(!response.ok)throw Error(response.status===409?'다른 변경과 충돌했습니다. 새로고침 후 다시 확인해 주세요.':response.status===403?'편집 권한 또는 MFA 인증이 필요합니다.':response.status===400?'입력값 또는 이미지 공개 승인을 확인해 주세요.':'저장 결과를 확인하지 못했습니다. 같은 내용으로 다시 시도해 주세요.')
 return (await response.json()).result as T
}
