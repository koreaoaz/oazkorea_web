import {reviewedMainRuntime} from '@/lib/security-profile'
import {acceptanceRpc} from '@/lib/acceptance-rpc'
import {serverClient} from '@/lib/admin/server-client'
export async function POST(request:Request){
 const reply=(status:number,error:string)=>Response.json({error},{status,headers:{'Cache-Control':'no-store'}});
 if(process.env.OAZ_FINAL_ACCEPTANCE!=='true'&&!reviewedMainRuntime(process.env))return reply(503,'NOT_CONFIGURED');
 if(request.headers.get('origin')!==process.env.OAZ_ADMIN_ORIGIN)return reply(403,'ORIGIN_DENIED');
 const token=request.headers.get('authorization')?.match(/^Bearer ([A-Za-z0-9._-]{20,8192})$/)?.[1];if(!token)return reply(401,'AUTH_REQUIRED');
 try{
  const user=await serverClient(token).auth.getUser(token);if(user.error||!user.data.user)return reply(401,'AUTH_EXPIRED');
  if(Number(request.headers.get('content-length'))>2048)return reply(413,'TOO_LARGE');
  const reader=request.body?.getReader();if(!reader)return reply(400,'INVALID_INPUT');let size=0;const parts:Uint8Array[]=[];while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>2048){await reader.cancel();return reply(413,'TOO_LARGE')}parts.push(value)}
  const args=JSON.parse(Buffer.concat(parts).toString('utf8'));if(!args||Object.keys(args).sort().join(',')!=='bucket,path'||typeof args.bucket!=='string'||typeof args.path!=='string')return reply(400,'INVALID_INPUT');
  await acceptanceRpc('image_withdraw',args,token);return Response.json({withdrawn:true,originalPreserved:true},{headers:{'Cache-Control':'no-store'}});
 }catch(error){return reply(error instanceof Error&&error.message==='IMAGE_STILL_REFERENCED'?409:403,'IMAGE_WITHDRAW_DENIED')}
}
