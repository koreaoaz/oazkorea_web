import {rolePasswordEnabled} from '@/lib/admin/role-password-policy'
import {credentialRpc,credentialsConfiguration} from '@/lib/admin/credentials-server'
import {passwordIdentity} from '@/lib/admin/password-session-server'
export async function POST(request:Request){
 if(!rolePasswordEnabled()||request.headers.get('origin')!==credentialsConfiguration()?.origin)return Response.json({error:'ORIGIN_DENIED'},{status:403})
 try{
  const token=request.headers.get('authorization')?.match(/^Bearer ([A-Za-z0-9._-]{20,8192})$/)?.[1];if(!token)throw Error()
  const identity=await passwordIdentity(token);if(identity?.role!=='SUPER_ADMIN')throw Error()
  // Existing enrollment RPC checks actual verified TOTP and AAL2 before activation.
  if(identity.pendingEnrollment)await credentialRpc('enrollment_self',{action:'activate'},token)
  return Response.json({ok:true},{headers:{'Cache-Control':'no-store'}})
 }catch{return Response.json({error:'MFA_REQUIRED'},{status:403})}
}
