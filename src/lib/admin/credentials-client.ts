import {supabase} from '@/lib/supabaseClient'
export async function credentialsCommand(command:Record<string,unknown>){
 const {data}=await supabase.auth.getSession();if(!data.session)throw Error('다시 로그인해 주세요.')
 const r=await fetch('/api/admin/credentials',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+data.session.access_token},body:JSON.stringify(command)})
 if(!r.ok)throw Error(r.status===403?'본인 인증과 최근 MFA 인증(10분 이내)을 확인해 주세요.':r.status===409?'아이디 중복 또는 변경 충돌입니다. 새로고침한 뒤 다시 확인해 주세요.':r.status===400?'아이디 형식과 비밀번호 규칙을 확인해 주세요.':'계정 작업을 확인하지 못했습니다. 중복 실행하지 말고 상태를 확인해 주세요.')
 return (await r.json()).result
}
