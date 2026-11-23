import {lookup} from 'node:dns/promises'
import {request} from 'node:https'
import {isIP} from 'node:net'
import {publicLink,htmlMail} from './mail-autofill'

/** Conservative public-unicast allow boundary. IPv6 is deliberately refused until reviewed. */
export function publicIPv4(address:string){
 if(isIP(address)!==4)return false
 const [a,b,c]=address.split('.').map(Number)
 return !(a===0||a===10||a===127||a>=224||a===169&&b===254||a===172&&b>=16&&b<=31||a===192&&(b===168||b===0||b===2)||a===100&&b>=64&&b<=127||a===198&&(b===18||b===19||b===51&&c===100)||a===203&&b===0&&c===113)
}
export async function readOfficial(raw:string){
 let url=publicLink(raw);if(!url)throw Error('OFFICIAL_URL_REJECTED')
 for(let redirects=0;redirects<=3;redirects++){
  const u=new URL(url)
  const addresses=await new Promise<{address:string;family:number}[]>((resolve,reject)=>{
   const timer=setTimeout(()=>reject(Error('OFFICIAL_DNS_TIMEOUT')),8000)
   lookup(u.hostname,{all:true,verbatim:true,family:4}).then(value=>{clearTimeout(timer);resolve(value)},()=>{clearTimeout(timer);reject(Error('OFFICIAL_DNS_REJECTED'))})
  })
  // Reject mixed public/private DNS answers and pin the validated address in the socket.
  if(!addresses.length||addresses.some(a=>!publicIPv4(a.address)))throw Error('OFFICIAL_DNS_REJECTED')
  const address=addresses[0].address
  const response=await new Promise<{status:number;type:string;location?:string;bytes:Buffer}>((resolve,reject)=>{
   const req=request(u,{method:'GET',family:4,headers:{Accept:'text/html, application/pdf','Accept-Encoding':'identity','User-Agent':'OAZ-Public-Promotion-Review/1.0'},lookup:(_host,_options,done)=>done(null,address,4)},res=>{
    const status=res.statusCode??0,type=String(res.headers['content-type']??'').split(';')[0].trim().toLowerCase()
    if(status>=300&&status<400){res.resume();resolve({status,type,location:res.headers.location,bytes:Buffer.alloc(0)});return}
    const limit=type==='application/pdf'?5242880:1024*1024
    if(status!==200||!['text/html','application/pdf'].includes(type)||res.headers['content-encoding']&&res.headers['content-encoding']!=='identity'||Number(res.headers['content-length']??0)>limit){res.destroy();reject(Error('OFFICIAL_RESOURCE_UNAVAILABLE'));return}
    const chunks:Buffer[]=[];let size=0
    res.on('data',(chunk:Buffer)=>{size+=chunk.length;if(size>limit){res.destroy();reject(Error('OFFICIAL_SIZE_LIMIT'))}else chunks.push(chunk)})
    res.on('error',()=>reject(Error('OFFICIAL_RESOURCE_UNAVAILABLE')))
    res.on('end',()=>resolve({status,type,bytes:Buffer.concat(chunks)}))
   })
   const timer=setTimeout(()=>req.destroy(Error('OFFICIAL_TIMEOUT')),10000)
   req.on('close',()=>clearTimeout(timer));req.on('error',()=>reject(Error('OFFICIAL_RESOURCE_UNAVAILABLE')));req.end()
  })
  if(response.status>=300&&response.status<400){if(!response.location||redirects===3)throw Error('OFFICIAL_REDIRECT_REJECTED');url=publicLink(new URL(response.location,url).href);if(!url)throw Error('OFFICIAL_REDIRECT_REJECTED');continue}
  if(response.type==='application/pdf')return {url,type:'pdf' as const,bytes:response.bytes,text:'',links:[]}
  const parsed=htmlMail(response.bytes.toString('utf8'),url)
  if(/captcha|sign in to continue|로그인 후 이용|접근 권한이 없습니다/i.test(parsed.text))throw Error('OFFICIAL_ACCESS_RESTRICTED')
  return {url,type:'html' as const,bytes:response.bytes,text:parsed.text,links:parsed.links}
 }
 throw Error('OFFICIAL_REDIRECT_REJECTED')
}
