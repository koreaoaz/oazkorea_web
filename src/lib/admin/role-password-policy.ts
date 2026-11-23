/** Explicit migration/cutover opt-in. An unset flag retains the existing local profile. */
export const rolePasswordClient = process.env.NEXT_PUBLIC_OAZ_ADMIN_AUTH_POLICY === 'role-password-v1'
export function rolePasswordEnabled() {
 return process.env.OAZ_ADMIN_AUTH_POLICY === 'role-password-v1' && rolePasswordClient
}
export type PasswordIdentity = {userId:string;slot:string;role:'ADMIN'|'SUPER_ADMIN';username:string;mustChange:boolean;pendingEnrollment:boolean;mfaRequired:boolean}
export function passwordNext(identity:PasswordIdentity,aal:string) {
 return identity.mfaRequired && (aal!=='aal2'||identity.pendingEnrollment) ? '/admin/mfa' : identity.mustChange ? '/admin/password-setup' : '/admin'
}
