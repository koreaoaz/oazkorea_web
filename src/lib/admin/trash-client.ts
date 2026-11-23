'use client'
import {supabase} from '@/lib/supabaseClient'
import type {TrashReviewCommand,TrashRecord} from './trash-review'
export async function trashReview<T extends TrashRecord|TrashRecord[]>(command:TrashReviewCommand):Promise<T>{
 const {data,error}=await supabase.auth.getSession();if(error||!data.session)throw Error('관리자 로그인이 필요합니다.')
 const response=await fetch('/api/admin/trash-review',{method:'POST',cache:'no-store',headers:{'Content-Type':'application/json',Authorization:`Bearer ${data.session.access_token}`},body:JSON.stringify(command)})
 if(!response.ok)throw Error(response.status===403?'현재 편집 권한 또는 MFA를 확인해 주세요.':'휴지통을 불러오지 못했습니다. 다시 확인해 주세요.')
 return (await response.json()).result as T
}
