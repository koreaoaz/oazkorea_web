import {readFile} from 'node:fs/promises'
import cover from '@/data/news-list-cover.json'
import {createHash} from 'node:crypto'
import {serverClient} from '@/lib/admin/server-client'
import {acceptanceRpc} from '@/lib/acceptance-rpc'
import {isDesktopLocalProfile,localProfile,reviewedMainRuntime} from '@/lib/security-profile'
import {join} from 'node:path'
export const dynamic='force-dynamic';
export async function GET(request:Request,{params}:{params:Promise<{bucket:string;path:string[]}>}){
 const missing=()=>new Response(null,{status:404,headers:{'Cache-Control':'no-store'}});
 const production=reviewedMainRuntime(process.env);
 if(process.env.OAZ_FINAL_ACCEPTANCE!=='true'&&!production)return missing();
 const {bucket,path}=await params;const object=path.join('/');
 if(!['notice-images','project_img','study-images','card_news'].includes(bucket)||object.length>1024||path.some(p=>!p||p==='.'||p==='..'||/[\\\x00-\x1f]/.test(p)))return missing();
 const preview=new URL(request.url).searchParams.get('preview')==='1';
 const token=request.headers.get('authorization')?.match(/^Bearer ([A-Za-z0-9._-]{20,8192})$/)?.[1];if(preview&&!token)return missing();
 try{
  const args={bucket,path:object,preview};
  const access=async()=>{
   const published=await acceptanceRpc('image_access',args,preview?token:undefined);
   if(published)return published;
   // Next's development server can normalize its bound loopback hostname to localhost.
   const origin=new URL(request.url).origin;
   if(!isDesktopLocalProfile(process.env)||![localProfile(process.env).web,'http://localhost:3310'].includes(origin))return null;
   return acceptanceRpc('desktop_image_review_access',args,preview?token:undefined);
  };
  const allowed=await access();if(!allowed)return missing();
  const userStorage=!!production&&process.env.OAZ_GATEWAY_TRANSPORT==='data-api-v1';
  const key=userStorage?(preview?token:undefined):production?process.env.OAZ_IMAGE_READER_JWT??'':(await readFile(join(process.cwd(),localProfile(process.env).privatePath,'image-reader.key'),'ascii')).trim();
  if(production&&!userStorage){
   // Configuration screening only; Storage verifies the signature and database role/RLS.
   if(!key||key.length>8192||!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(key))return missing();
   const claim=JSON.parse(Buffer.from(key.split('.')[1],'base64url').toString('utf8'));
   if(claim.role!=='oaz_image_reader'||!Number.isSafeInteger(claim.exp)||claim.exp<=Math.floor(Date.now()/1000))return missing();
  }
  const downloaded=await serverClient(key).storage.from(bucket).download(object);if(downloaded.error||!downloaded.data||downloaded.data.size>5*1024*1024)return missing();
  const bytes=new Uint8Array(await downloaded.data.arrayBuffer())
  if(bytes.length!==Number(allowed.byteCount))return missing()
  const sourceHash=allowed.sha256 || (bucket==='card_news' && object===cover.path) ? createHash('sha256').update(bytes).digest('hex') : undefined
  if(allowed.sha256 && sourceHash!==allowed.sha256)return missing()
  const card=!preview && bucket==='card_news' && new URL(request.url).searchParams.get('view')==='news-card'
  let output:Uint8Array=bytes
  let webp=false
  // Match the verified Storage source before the large-image delivery conversion.
  if(card && object===cover.path && sourceHash===cover.sourceSha256){
   const thumbnail=Buffer.from(cover.bytes,'base64')
   if(createHash('sha256').update(thumbnail).digest('hex')===cover.sha256){
    output=new Uint8Array(thumbnail)
    webp=true
   }
  }
  if(!webp && production && bytes.length>4*1024*1024){
   output=await (await import('@/lib/admin/image-normalize')).normalizeDeliveryImage(bytes)
   webp=true
  }else if(!webp && card && bytes.length>=160*1024){
   try{
    output=await (await import('@/lib/admin/image-normalize')).newsCardImage(bytes)
    webp=output!==bytes
   }catch{output=bytes}
  }
  if(!await access())return missing();
  return new Response(output,{headers:{'Content-Type':webp?'image/webp':downloaded.data.type||'image/webp','Cache-Control':'no-store, max-age=0','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox"}});
 }catch{return missing()}
}
