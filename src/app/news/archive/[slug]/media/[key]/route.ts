import {editionImage} from '@/lib/local-news-editions'
export async function GET(_request:Request,{params}:{params:Promise<{slug:string;key:string}>}){
  const {slug,key}=await params
  const file=await editionImage(slug,key)
  return file?new Response(new Uint8Array(file),{headers:{'Content-Type':'image/webp','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}}):new Response(null,{status:404})
}

