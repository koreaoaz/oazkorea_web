import 'server-only'
import {spawn} from 'node:child_process'
import {join} from 'node:path'
import {reviewedMainRuntime} from '../security-profile'
import {normalizeRemotePDF} from './pdf-service'
/** No shell, no document filename arguments. Strict process timeout and bounded output. */
export async function normalizePublicPDF(input:Uint8Array):Promise<Uint8Array>{
 if(reviewedMainRuntime(process.env))return normalizeRemotePDF(input,process.env)
 if(process.env.OAZ_FINAL_INTEGRATION!=='true'||input.length>5*1024*1024)throw Error('PDF_VALIDATOR_NOT_CONFIGURED');
 return new Promise((resolve,reject)=>{
  const child=spawn('python',['-B',join(process.cwd(),'scripts/validate-public-pdf.py')],{windowsHide:true,stdio:['pipe','pipe','pipe'],env:{NODE_ENV:'production',PATH:process.env.PATH,SystemRoot:process.env.SystemRoot,USERPROFILE:process.env.USERPROFILE,PYTHONDONTWRITEBYTECODE:'1'}});
  const chunks:Buffer[]=[];let size=0,settled=false;
  const fail=()=>{if(settled)return;settled=true;clearTimeout(timer);child.kill();reject(Error('PDF_REVIEW_REJECTED'))};
  const timer=setTimeout(fail,15000);
  child.on('error',fail);child.stdin.on('error',fail);child.stdout.on('data',(data:Buffer)=>{size+=data.length;if(size>5*1024*1024)fail();else chunks.push(data)});
  child.stderr.resume();child.on('close',code=>{if(settled)return;settled=true;clearTimeout(timer);if(code!==0||size===0)reject(Error('PDF_REVIEW_REJECTED'));else resolve(Buffer.concat(chunks))});
  child.stdin.end(input);
 })
}
