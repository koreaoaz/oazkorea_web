'use client'
export type DirectUploadState={file:File;table:string;blob:Blob;ticket:string;signedUrl:string;authenticated?:boolean;uploaded:boolean}
export async function stageImage(file:File):Promise<Blob>{
 if(!file.size||file.size>5*1024*1024||!['image/png','image/jpeg','image/webp'].includes(file.type))throw Error('PNG/JPEG/WebP 이미지 최대 5MiB까지 지원합니다.')
 if(file.type==='image/webp')return file
 const bitmap=await createImageBitmap(file)
 try{
  if(bitmap.width*bitmap.height>16_000_000)throw Error('이미지는 최대 1,600만 픽셀까지 지원합니다.')
  const canvas=document.createElement('canvas');canvas.width=bitmap.width;canvas.height=bitmap.height
  const ctx=canvas.getContext('2d');if(!ctx)throw Error('이미지 변환을 시작하지 못했습니다.')
  ctx.drawImage(bitmap,0,0)
  const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(x=>x?resolve(x):reject(Error('이미지 변환 실패')),'image/webp',.9))
  if(blob.type!=='image/webp'||blob.size>5*1024*1024)throw Error('변환된 이미지가 5MiB를 넘습니다. 이미지 크기를 줄여 주세요.')
  return blob
 }finally{bitmap.close()}
}
export async function directImageUpload(file:File,table:string,token:string,signal:AbortSignal,state:{current:DirectUploadState|null}){
 const post=async(body:object)=>{
  const res=await fetch('/api/admin/media/direct',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(body),signal,cache:'no-store',redirect:'error'})
  return {res,data:await res.json()}
 }
 if(state.current?.file!==file||state.current.table!==table)state.current=null
 if(!state.current){
  const blob=await stageImage(file),sha=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer())),b=>b.toString(16).padStart(2,'0')).join('')
  const {res,data}=await post({action:'prepare',table,size:blob.size,sha,mime:'image/webp',rights:true})
  if(!res.ok)throw Error('업로드 권한·MFA·공개 승인 상태를 확인해 주세요.')
  const api=new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!)
  if(typeof data.authenticatedPath==='string'){
   if(!/^managed\/[0-9a-f-]{36}\.webp$/.test(data.authenticatedPath)||api.protocol!=='https:')throw Error('업로드 대상 확인 실패')
   state.current={file,table,blob,ticket:data.ticket,signedUrl:new URL('/storage/v1/object/oaz-final-image-staging/'+data.authenticatedPath,api).href,authenticated:true,uploaded:false}
  }else{
  const url=new URL(data.signedUrl)
  if(url.origin!==api.origin||!/^\/storage\/v1\/object\/upload\/sign\/oaz-final-image-staging\/managed\/[0-9a-f-]{36}\.webp$/.test(url.pathname)||url.username||url.password||url.hash)throw Error('업로드 대상 확인 실패')
  state.current={file,table,blob,ticket:data.ticket,signedUrl:url.href,uploaded:false}
  }
 }
 const job=state.current
 if(!job.uploaded){
  const res=await fetch(job.signedUrl,{method:job.authenticated?'POST':'PUT',body:job.blob,headers:{'Content-Type':'image/webp',...(job.authenticated?{Authorization:'Bearer '+token,apikey:process.env.NEXT_PUBLIC_SUPABASE_KEY!}:{})},signal,credentials:'omit',redirect:'error',referrerPolicy:'no-referrer'})
  // A response may be lost after Storage committed. Finish verifies bytes, not status alone.
  if(!res.ok&&![400,409].includes(res.status))throw Error('전송을 완료하지 못했습니다. 파일을 유지했으니 다시 시도해 주세요.')
  job.uploaded=true
 }
 const {res,data}=await post({action:'finish',ticket:job.ticket})
 if(!res.ok){if(data.error==='UPLOAD_INCOMPLETE')job.uploaded=false;else state.current=null;throw Error('서버 검증을 완료하지 못했습니다. 파일 선택을 유지했습니다. 다시 시도해 주세요.')}
 state.current=null;return data as {bucket:string;path:string}
}
