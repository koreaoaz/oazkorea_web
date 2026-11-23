import 'server-only'

const limit=4*1024*1024
/** The destination is deployment configuration, never a URL from the uploaded file. */
export async function normalizeRemotePDF(input:Uint8Array,env:Readonly<Record<string,string|undefined>>,transport:typeof fetch=fetch):Promise<Uint8Array>{
 let endpoint:URL
 try{
  endpoint=new URL(env.OAZ_PDF_VALIDATOR_URL??'')
  if(endpoint.protocol!=='https:'||endpoint.pathname!=='/v1/normalize'||endpoint.username||endpoint.password||endpoint.search||endpoint.hash)throw Error()
  if(!/^[a-f0-9]{64}$/.test(env.OAZ_PDF_VALIDATOR_KEY??''))throw Error()
 }catch{throw Error('PDF_VALIDATOR_NOT_CONFIGURED')}
 if(!input.length||input.length>limit)throw Error('PDF_REVIEW_REJECTED')
 const response=await transport(endpoint,{method:'POST',headers:{'Content-Type':'application/pdf','Authorization':'Bearer '+env.OAZ_PDF_VALIDATOR_KEY},body:Buffer.from(input),redirect:'error',cache:'no-store',signal:AbortSignal.timeout(15000)})
 if(response.status!==200||response.headers.get('content-type')!=='application/pdf'||Number(response.headers.get('content-length'))>limit){await response.body?.cancel();throw Error('PDF_REVIEW_REJECTED')}
 const reader=response.body?.getReader();if(!reader)throw Error('PDF_REVIEW_REJECTED')
 const chunks:Uint8Array[]=[];let size=0
 while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>limit){await reader.cancel();throw Error('PDF_REVIEW_REJECTED')}chunks.push(value)}
 const result=Buffer.concat(chunks)
 if(!size||!result.subarray(0,5).equals(Buffer.from('%PDF-'))||!result.subarray(-32).toString('ascii').trimEnd().endsWith('%%EOF'))throw Error('PDF_REVIEW_REJECTED')
 return result
}
