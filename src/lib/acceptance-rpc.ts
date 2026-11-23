import 'server-only'
import {isFinalLocalProfile,isDesktopLocalProfile,localGateway,reviewedMainRuntime} from './security-profile'
import {gatewayToken} from './gateway-public-token'
export async function acceptanceRpc(name:'image_access'|'desktop_image_review_access'|'image_withdraw'|'mail_review'|'honor_workflow'|'trash_review'|'site_manage'|'site_public',args:Record<string,unknown>,token?:string){
 if(!new Set(['image_access','desktop_image_review_access','image_withdraw','mail_review','honor_workflow','trash_review','site_manage','site_public']).has(name))throw Error('RPC_NOT_ALLOWED');
 const production=reviewedMainRuntime(process.env);
 if(!production&&(process.env.OAZ_FINAL_ACCEPTANCE!=='true'||!isFinalLocalProfile(process.env)))throw Error('ACCEPTANCE_REQUIRED');
 if(name==='desktop_image_review_access'&&!isDesktopLocalProfile(process.env))throw Error('DESKTOP_REVIEW_REQUIRED');
 const response=await fetch((production?.gateway??localGateway(process.env))+'/acceptance-rpc/v1/rpc/'+name,{method:'POST',cache:'no-store',redirect:'error',signal:AbortSignal.timeout(20000),headers:{'Content-Type':'application/json',Authorization:'Bearer '+gatewayToken(token,process.env,!!production),'x-oaz-server-gate':production?.gate??process.env.OAZ_SECURITY_BRIDGE_KEY!},body:JSON.stringify(args)});
 if(!response.ok){
  if(name==='honor_workflow'||name==='trash_review'||name==='site_manage'){
   const error=await response.json().catch(()=>({}));throw Error(['42501','PT409','40001','23505','22023','22P02','23514','23502','P0002'].includes(error.code)?error.code:'TRANSPORT_ERROR')
  }
  if(name==='mail_review'){
   const error=await response.json().catch(()=>({}));
   const reviewed=['PUBLICATION_REVIEW_REQUIRED','SOURCE_CHANGED','EXISTING_SOURCE_REVIEW_REQUIRED','PRIVATE_SELECTION','DOCUMENT_CONFLICT','RETRY_CONFLICT','PUBLIC_DOCUMENT_REVIEW_REQUIRED'];
   throw Error(reviewed.includes(error.message)?error.message:response.status===403?'SUPER_ADMIN_AAL2_REQUIRED':'REVIEW_REQUEST_FAILED')
  }
  throw Error(response.status===409?'IMAGE_STILL_REFERENCED':'IMAGE_ACCESS_DENIED')
 }
 return response.json();
}
