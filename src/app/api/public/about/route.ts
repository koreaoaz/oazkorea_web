import {englishFields} from '@/lib/public-english-server'
import {acceptanceRpc} from '@/lib/acceptance-rpc'
export const dynamic='force-dynamic'
export async function GET(request:Request){
 const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}
 try{
  const result=await acceptanceRpc('site_public',{}) as {content?: Record<string,string>}
  if(request.headers.get('x-oaz-public-language')==='en'&&result.content){
   const translated=await englishFields('about',1,result.content)
   return Response.json({...result,content:{...result.content,...translated}},{headers})
  }
  return Response.json(result,{headers})
 }catch{return Response.json({error:'ABOUT_UNAVAILABLE'},{status:503,headers})}
}
