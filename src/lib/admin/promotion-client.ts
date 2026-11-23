'use client'
import {supabase} from '@/lib/supabaseClient'
import type {PromotionCommand} from './promotion-contract'
export async function promotionCommand<T=unknown>(command:PromotionCommand):Promise<T>{
 const {data,error}=await supabase.auth.getSession();if(error||!data.session)throw Error('로그인이 필요합니다.')
 const r=await fetch('/api/admin/promotions',{method:'POST',cache:'no-store',headers:{'Content-Type':'application/json',Authorization:`Bearer ${data.session.access_token}`},body:JSON.stringify({...command,requestId:command.requestId??crypto.randomUUID()})});const value=await r.json()
 if(!r.ok&&value.error==='ENGLISH_REVIEW_REQUIRED')throw Error('현재 Gmail 초안의 영문 검수가 필요합니다. admin1이 먼저 확인해 주세요.');
 if(!r.ok&&value.error==='MANUAL_REVIEW_REQUIRED')throw Error('이 초안은 원문 검수 목록의 개별 화면에서 영문·PDF와 함께 승인해 주세요.');
 if(!r.ok)throw Error(r.status===403?'현재 홍보 권한 또는 최고관리자 MFA 인증을 확인해 주세요.':r.status===401?'세션이 만료되었습니다. 다시 로그인해 주세요.':r.status===409?'다른 변경과 충돌했습니다. 목록을 새로고침해 주세요.':'요청을 처리하지 못했습니다. 선택 내용을 확인하고 다시 시도해 주세요.')
 return value.result as T
}
