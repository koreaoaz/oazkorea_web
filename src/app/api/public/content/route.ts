import {translatedMeta} from '@/lib/public-english-server'
import {serverClient} from '@/lib/admin/server-client'
import {isFinalLocalProfile,reviewedMainRuntime} from '@/lib/security-profile'
export const dynamic='force-dynamic'
const kinds=new Set(['oaz_public_content_meta_v1','oaz_public_study_sessions_v1','oaz_public_attachments_v1'])
const tables=new Set(['editor_0_noti','editor_1_projects','editor_2_studies','editor_4_schedules','editor_6_events'])
export async function GET(request:Request){
 const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}
 if(process.env.OAZ_SECURITY_BRIDGE!=='true'||(!isFinalLocalProfile(process.env)&&!reviewedMainRuntime(process.env)))return Response.json({error:'NOT_READY'},{status:503,headers})
 const params=new URL(request.url).searchParams,kind=params.get('kind')??'',table=params.get('table')??'',id=params.get('id')??''
 if(!kinds.has(kind)||[...params.keys()].some(k=>!['kind','table','id'].includes(k))||[...new Set(params.keys())].some(k=>params.getAll(k).length!==1))return Response.json({error:'INVALID_INPUT'},{status:400,headers})
 const sessions=kind==='oaz_public_study_sessions_v1'
 if(sessions?(params.has('table')||params.has('id')):(!tables.has(table)||!/^(0|[1-9][0-9]*)$/.test(id)||!Number.isSafeInteger(Number(id))))return Response.json({error:'INVALID_INPUT'},{status:400,headers})
 try{
  // Always anonymous, even when the visitor supplies admin cookies/Authorization.
  const result=await serverClient().rpc(kind,sessions?{}:{tbl:table,rid:Number(id)})
  if(result.error)return Response.json({error:'PUBLIC_CONTENT_UNAVAILABLE'},{status:503,headers})
  const value=kind==='oaz_public_content_meta_v1'?await translatedMeta(table,Number(id),result.data):result.data
  return Response.json(value,{headers})
 }catch{return Response.json({error:'PUBLIC_CONTENT_UNAVAILABLE'},{status:503,headers})}
}
