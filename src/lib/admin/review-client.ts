'use client'
import {supabase} from '@/lib/supabaseClient'
export async function reviewRequest(endpoint:'gmail-review'|'gmail-publication'|'gmail-autofill',command:unknown){
 const {data}=await supabase.auth.getSession();if(!data.session)throw Error('AUTH_REQUIRED')
 const response=await fetch('/api/admin/'+endpoint,{method:'POST',cache:'no-store',headers:{'Content-Type':'application/json',Authorization:'Bearer '+data.session.access_token},body:JSON.stringify(command)})
 if(!response.ok){const result=await response.json().catch(()=>({}));throw Error(result.error??'REVIEW_REQUEST_FAILED')}return response
}
export async function reviewCall(endpoint:'gmail-review'|'gmail-publication'|'gmail-autofill',command:unknown){return (await reviewRequest(endpoint,command)).json()}
export const reviewError=(code:string)=>({PUBLICATION_REVIEW_REQUIRED:'현재 저장본의 영문 검수·공개 확인이 필요합니다. 수정했다면 다시 저장하고 검수하세요.',EXISTING_SOURCE_REVIEW_REQUIRED:'이 메일은 기존 초안 또는 다른 검수본에 연결되어 있습니다. 중복 게시하지 말고 기존 승인 목록을 확인하세요.',DOCUMENT_CONFLICT:'선택한 PDF가 검증 대기 상태가 아니거나 다른 글에 연결되어 있습니다. 첨부 목록을 다시 확인하세요.',PUBLIC_DOCUMENT_REVIEW_REQUIRED:'PDF의 공개 권한과 문서 제목·크기·내용을 확인하세요.',RETRY_CONFLICT:'이전 요청과 수정 내용이 다릅니다. 최신 저장본을 확인하세요.',PRIVATE_SELECTION:'게시용 문안에 개인정보·기밀·인증정보 또는 잘못된 입력이 있습니다. 선택 영역과 수정본을 확인하세요.',SOURCE_CHANGED:'원문·승인 라벨 또는 저장 revision이 변경됐습니다. 새로 불러와 다시 검수하세요.',GMAIL_REAUTH_REQUIRED:'Gmail 인증이 만료되었습니다. 기존 연결의 재인증이 필요합니다.',SUPER_ADMIN_AAL2_REQUIRED:'최고관리자 추가 인증이 필요합니다.',INVALID_SELECTION:'공개할 원문 부분을 먼저 선택하고 확인하세요.',REVIEW_REQUEST_FAILED:'요청을 완료하지 못했습니다. 현재 권한·검수 상태·수정 충돌·연결을 확인하세요.'} as Record<string,string>)[code]??'검토 요청을 완료하지 못했습니다. 입력은 유지됩니다.'
