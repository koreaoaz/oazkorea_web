import {enrollmentConfiguration} from '@/lib/admin/enrollment-server'
import {Enrollment} from './enrollment'
export const dynamic='force-dynamic'
export default function Page(){
 if(!enrollmentConfiguration())return <main className="mx-auto max-w-xl p-6"><h1>관리자 초기 등록 준비 중</h1><p>현재는 초기 등록을 시작할 수 없습니다. 기존 로그인과 MFA는 변경되지 않았습니다.</p></main>
 return <Enrollment/>
}
