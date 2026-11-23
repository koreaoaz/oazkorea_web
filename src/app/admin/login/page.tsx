
import {rolePasswordEnabled} from '@/lib/admin/role-password-policy'
import {PasswordLogin} from './password-login'
import {T} from '@/components/LocaleProvider';
import { adminConfiguration } from '@/lib/admin/protocol'
import { AdminLogin } from './sign-in'
import {credentialRegistryReady,localLoginRegistry} from '@/lib/admin/username-server'
export const dynamic = 'force-dynamic'
export default async function Page() {
  const config = adminConfiguration(process.env)
  if(config&&rolePasswordEnabled())return <PasswordLogin/>
  return config ? <AdminLogin origin={config.origin} usernameReady={await credentialRegistryReady()||!!await localLoginRegistry()} /> : <main className="p-8"><T text="관리자 로그인이 아직 활성화되지 않았습니다."/></main>
}
