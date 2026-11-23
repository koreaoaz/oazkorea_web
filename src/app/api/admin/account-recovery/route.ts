import 'server-only'
import {createClient} from '@supabase/supabase-js'
import {serverClient} from '@/lib/admin/server-client'
import {isFinalLocalProfile} from '@/lib/security-profile'
export const dynamic='force-dynamic'
export async function POST(request:Request){
 if(process.env.OAZ_ACCOUNT_REGISTRY_V1==='true'||process.env.OAZ_ACCOUNTS_RELEASE==='reviewed-v1')return Response.json({error:'USE_REVIEWED_ACCOUNT_RECOVERY'},{status:409,headers:{'Cache-Control':'no-store'}})
 const fail=(status:number,error:string)=>Response.json({error},{status,headers:{'Cache-Control':'no-store'}});
 if(!isFinalLocalProfile(process.env))return fail(503,'LOCAL_RECOVERY_NOT_READY');
 if(request.headers.get('origin')!==process.env.OAZ_ADMIN_ORIGIN)return fail(403,'ORIGIN_DENIED');
 const token=request.headers.get('authorization')?.match(/^Bearer ([A-Za-z0-9._-]{20,8192})$/)?.[1];if(!token)return fail(401,'AUTH_REQUIRED');
 if(!request.headers.get('content-type')?.startsWith('application/json'))return fail(415,'JSON_REQUIRED');
 try{
  const reader=request.body?.getReader();if(!reader)return fail(400,'INVALID_INPUT');let size=0,text='';const decoder=new TextDecoder();
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>8192){await reader.cancel();return fail(413,'TOO_LARGE')}text+=decoder.decode(value,{stream:true})}
  const b=JSON.parse(text+decoder.decode());if(!b||Array.isArray(b)||Object.keys(b).some(k=>!['action','requestId','userId','slot','revision','password'].includes(k))||!['pending.list','password.reset'].includes(b.action))return fail(400,'INVALID_INPUT');
  const c=serverClient(token);
  const user=await c.auth.getUser(token);if(user.error||!user.data.user)return fail(401,'AUTH_EXPIRED');
  const command={action:b.action==='pending.list'?'pending.list':'reset.prepare',requestId:b.requestId,userId:b.userId,slot:b.slot,revision:b.revision};
  if(b.action==='password.reset'&&(typeof b.password!=='string'||b.password.length<12||b.password.length>128))return fail(400,'INVALID_PASSWORD');
  const prepared=await c.rpc('oaz_account_recovery_v1',{command});if(prepared.error)return fail(prepared.error.code==='42501'?403:409,'RECOVERY_DENIED');
  if(b.action==='pending.list'||prepared.data.status==='completed')return Response.json({result:prepared.data},{headers:{'Cache-Control':'no-store'}});
  const service=process.env.OAZ_LOCAL_SERVICE_ROLE_KEY;if(!service)return fail(503,'AUTH_ADAPTER_NOT_READY');
  const admin=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,service,{auth:{persistSession:false,autoRefreshToken:false}});
  const identity=await admin.auth.admin.getUserById(prepared.data.userId);if(identity.error||!identity.data.user.email?.endsWith('@example.invalid'))return fail(403,'SYNTHETIC_ACCOUNT_REQUIRED');
  const updated=await admin.auth.admin.updateUserById(prepared.data.userId,{password:b.password});if(updated.error)return fail(409,'RESET_REVIEW_REQUIRED');
  const completed=await c.rpc('oaz_account_recovery_v1',{command:{...command,action:'reset.complete'}});if(completed.error)return fail(409,'RESET_REVIEW_REQUIRED');
  return Response.json({result:completed.data},{headers:{'Cache-Control':'no-store'}});
 }catch{return fail(503,'RECOVERY_UNAVAILABLE')}
}
