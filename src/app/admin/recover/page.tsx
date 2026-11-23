import {rolePasswordEnabled} from '@/lib/admin/role-password-policy'
import {SelfRecovery} from './recovery'
export const dynamic='force-dynamic'
export default function Page(){return rolePasswordEnabled()?<SelfRecovery/>:<p>현재 이 복구 경로는 활성화되지 않았습니다.</p>}
