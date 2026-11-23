import {verifiedAdminPage} from '@/lib/admin/server'
import {reply,trafficRpc} from '@/lib/traffic-server'
import {scheduledCheckLate} from '@/lib/traffic'
export const dynamic='force-dynamic'
export async function GET(request:Request){
 const token=request.headers.get('authorization')?.match(/^Bearer ([A-Za-z0-9._-]{20,8192})$/)?.[1]
 const session=await verifiedAdminPage(token)
 if(!session||!('role' in session)||session.role!=='SUPER_ADMIN'||!('aal' in session)||session.aal!=='aal2')return reply({error:'FORBIDDEN'},403)
 try{
  const s=await trafficRpc(process.env,token)('status') as {started:string;lastCron:string|null;latest:{at:string;result:string;ms:number}|null;lastOk:string|null}
  return reply({...s,late:scheduledCheckLate(s.lastCron,s.started),secretConfigured:(process.env.CRON_SECRET?.length??0)>=32})
 }catch{return reply({error:'DATABASE_UNAVAILABLE'},503)}
}
