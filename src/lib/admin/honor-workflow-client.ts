'use client'
import {supabase} from '@/lib/supabaseClient'
import type {HonorWorkflowCommand} from './honor-workflow'
export async function honorWorkflow(command:HonorWorkflowCommand){
 const {data}=await supabase.auth.getSession();if(!data.session)throw Error('관리자 로그인이 필요합니다.')
 const response=await fetch('/api/admin/honor-workflow',{method:'POST',cache:'no-store',headers:{'Content-Type':'application/json',Authorization:`Bearer ${data.session.access_token}`},body:JSON.stringify({...command,requestId:command.requestId??crypto.randomUUID()})})
 const body=await response.json().catch(()=>null)
 if(!response.ok)throw Error(body?.error==='HONOR_DUPLICATE'?'이미 등록된 이름입니다.':response.status===409?'다른 변경이 있습니다. 새로고침 후 다시 시도해 주세요.':response.status===403?'현재 관리자 권한과 추가 인증을 확인해 주세요.':response.status===400?'입력값을 다시 확인해 주세요.':'요청을 완료하지 못했습니다. 입력은 유지됩니다.')
 if(body?.result?.policy!=='names-crud-v3')throw Error('명예의 전당 DB 업데이트가 필요합니다. 현재는 저장할 수 없습니다.')
 if(!['list','trash'].includes(command.action)&&typeof BroadcastChannel!=='undefined'){
  const channel=new BroadcastChannel('oaz-public-honor');channel.postMessage('refresh');channel.close()
 }
 return body.result
}
