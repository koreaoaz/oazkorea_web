import './admin.css'
import {rolePasswordEnabled} from '@/lib/admin/role-password-policy'
import {PasswordBootstrap} from './password-bootstrap'
export default function AdminLayout({children}:{children:React.ReactNode}) {
  return <div className="oaz-admin" lang="ko">{rolePasswordEnabled()?<PasswordBootstrap>{children}</PasswordBootstrap>:children}</div>
}
