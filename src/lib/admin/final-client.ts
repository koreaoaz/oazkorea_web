'use client'
import {supabase} from '@/lib/supabaseClient'
import {adminCommand} from './client'
import type {FinalCommand} from './final-contract'
export async function finalCommand<T>(command:Omit<FinalCommand,'requestId'|'version'>&{requestId?:string}){
 const session=await adminCommand({action:'session',version:0}) as {version:number}
 const {data,error}=await supabase.auth.getSession();if(error||!data.session)throw Error('로그인이 필요합니다.')
 const mutation=['trash.restore','translation.save','metadata.save','sessions.revoke'].includes(command.action)
 const r=await fetch('/api/admin/integration',{method:'POST',cache:'no-store',headers:{'Content-Type':'application/json',Authorization:`Bearer ${data.session.access_token}`},body:JSON.stringify({...command,...(mutation?{version:session.version}:{}),requestId:command.requestId??crypto.randomUUID()})})
 if(!r.ok)throw Error(r.status===409?'다른 변경과 충돌했습니다. 원문을 다시 확인해 주세요.':r.status===403?'현재 편집 권한 또는 MFA를 확인해 주세요.':r.status===503?'통합 기능이 준비되지 않았습니다.':'요청을 확인하지 못했습니다.')
 return (await r.json()).result as T
}
