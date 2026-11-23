import 'server-only'
import {readFile,writeFile,rename,lstat} from 'node:fs/promises'
import {join} from 'node:path'
import {createClient} from '@supabase/supabase-js'
import {gmailAccessToken} from './gmail-oauth-server'
import {gmailReadonly} from './gmail-readonly'
import {runPromotionBatch,type IntakeStore} from './promotion-intake'
import {isFinalLocalProfile,localProfile} from './security-profile'
import {securityBridgeFetch} from './security-bridge'
import {timingSafeEqual} from 'node:crypto'
import {reviewedQueue,manualReviewReserved} from './gmail-reviewed-queue'
export async function handleGmailCron(request:Request,env:NodeJS.ProcessEnv=process.env){
 const reply=(status:number,body:unknown)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
 // Remote scheduling is deliberately disabled until a separately reviewed deployment.
 if(!isFinalLocalProfile(env))return reply(503,{error:'INTAKE_NOT_CONFIGURED'});
 if(request.method!=='POST')return reply(405,{error:'METHOD_NOT_ALLOWED'});
 const given=Buffer.from(request.headers.get('authorization')??''),expected=Buffer.from('Bearer '+(env.OAZ_GMAIL_CRON_SECRET??''));
 if(!env.OAZ_GMAIL_CRON_SECRET||given.length!==expected.length||!timingSafeEqual(given,expected))return reply(401,{error:'CRON_AUTH_REQUIRED'});
 if((!env.OAZ_GMAIL_READONLY_TOKEN&&!env.OAZ_GMAIL_REFRESH_TOKEN)||!env.OAZ_GMAIL_APPROVED_LABEL)return reply(503,{error:'GMAIL_AUTH_PENDING'});
 try{
  const folder=join(process.cwd(),localProfile(env).privatePath);
  const key=(await readFile(join(folder,'gmail-ingestor.key'),'ascii')).trim();
  const client=createClient(env.NEXT_PUBLIC_SUPABASE_URL!,env.NEXT_PUBLIC_SUPABASE_KEY!,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:securityBridgeFetch(env),headers:{Authorization:`Bearer ${key}`}}});
  const rpc=async(command:unknown)=>{const {data,error}=await client.rpc('oaz_gmail_intake_v1',{command});if(error)throw Error('INTAKE_DB_UNAVAILABLE');return data};
  const store:IntakeStore={claim:(day,runId)=>rpc({action:'claim',day,runId}),put:(mail,draft,runId)=>rpc({action:'put',mail,draft,runId}),finish:async(day,runId,success)=>{await rpc({action:'finish',day,runId,success})}};
  const checkpointPath=join(folder,'gmail-checkpoint.json');
  const checkpoint={load:async(day:string)=>{try{if((await lstat(checkpointPath)).isSymbolicLink())throw Error('GMAIL_CHECKPOINT_INVALID');const value=JSON.parse(await readFile(checkpointPath,'utf8'));if(value.day!==day||value.label!==env.OAZ_GMAIL_APPROVED_LABEL)return undefined;if(value.cursor!==null&&!/^[A-Za-z0-9_-]{1,2048}$/.test(value.cursor))throw Error('GMAIL_CHECKPOINT_INVALID');return value.cursor??undefined}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return undefined;throw error}},save:async(day:string,cursor:string|null)=>{const temporary=checkpointPath+'.'+crypto.randomUUID();await writeFile(temporary,JSON.stringify({day,cursor,label:env.OAZ_GMAIL_APPROVED_LABEL}),{flag:'wx',mode:0o600});await rename(temporary,checkpointPath)}};
  return reply(200,await runPromotionBatch(gmailReadonly(await gmailAccessToken(env),env.OAZ_GMAIL_APPROVED_LABEL),store,checkpoint,new Date(),await reviewedQueue(folder,env.OAZ_GMAIL_APPROVED_LABEL),mail=>manualReviewReserved(folder,mail)));
 }catch(error){const code=error instanceof Error&&['GMAIL_REAUTH_REQUIRED','GMAIL_SCOPE_MISMATCH','GMAIL_GRANT_UNVERIFIED','GMAIL_ACCOUNT_MISMATCH','GMAIL_REMOTE_STATE_CHANGED','GMAIL_LABEL_CHANGED'].includes(error.message)?error.message:'GMAIL_INTAKE_RETRY_REQUIRED';return reply(503,{error:code})}
}
