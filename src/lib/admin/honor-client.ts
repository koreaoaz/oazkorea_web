'use client'
import {supabase} from '@/lib/supabaseClient'
import type {HonorCommand} from './honor-http'
export async function honorCommand(command:HonorCommand){
 const {data}=await supabase.auth.getSession()
 if(!data.session)throw Error('관리자 로그인이 필요합니다.')
 const response=await fetch('/api/admin/honor',{method:'POST',cache:'no-store',headers:{'Content-Type':'application/json',Authorization:`Bearer ${data.session.access_token}`},body:JSON.stringify({...command,requestId:command.requestId??crypto.randomUUID()})})
 if(!response.ok)throw Error(response.status===403?'최고관리자 권한과 MFA 인증을 확인해 주세요.':response.status===409?'다른 변경이 있습니다. 목록을 새로고침해 주세요.':'요청을 완료하지 못했습니다. 입력을 유지하고 다시 시도해 주세요.')
 return (await response.json()).result
}
