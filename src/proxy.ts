import {NextResponse,type NextRequest} from 'next/server'
import {parseLocale} from './lib/locale'
import {offlinePreviewResponse,previewPathBlocked} from './lib/offline-preview'
function protectAdmin(request:NextRequest,response:Response){
 if (/^\/admin(?:\/|$)/.test(request.nextUrl.pathname)){
  const policy=response.headers.get('Content-Security-Policy')
  response.headers.set('Content-Security-Policy',[policy,"frame-ancestors 'none'"].filter(Boolean).join('; '))
  response.headers.set('X-Frame-Options','DENY')
  response.headers.set('X-Robots-Tag','noindex, nofollow')
 }
 return response
}
export function proxy(request:NextRequest){
 return protectAdmin(request,route(request))
}
function route(request:NextRequest){
 if(process.env.OAZ_PREVIEW_MODE==='offline-v1'){
  if(process.env.VERCEL_ENV!=='preview')return new NextResponse(null,{status:503})
  const path=request.nextUrl.pathname
  if(path==='/api/preview-health')return NextResponse.json({mode:'offline-v1',database:false,auth:false,storage:false},{headers:{'Cache-Control':'no-store'}})
  if(previewPathBlocked(path))return offlinePreviewResponse()
  const response=NextResponse.next()
  response.headers.set('Content-Security-Policy',"connect-src 'self'; img-src 'self' data: blob:; form-action 'none'; frame-src 'none'; object-src 'none'; base-uri 'self'")
  response.headers.set('X-Robots-Tag','noindex, nofollow')
  response.headers.set('X-OAZ-Preview','offline-v1')
  return response
 }
 if(/^\/(?:api|_next|favicon.ico)/.test(request.nextUrl.pathname)||/\.[a-zA-Z0-9]+$/.test(request.nextUrl.pathname))return NextResponse.next()
 const locale=parseLocale(request.nextUrl.searchParams.get('lang')??request.cookies.get('oaz_locale')?.value)
 const headers=new Headers(request.headers);headers.set('x-oaz-locale',locale);headers.set('x-oaz-path',request.nextUrl.pathname)
 const response=NextResponse.next({request:{headers}})
 response.cookies.set('oaz_locale',locale,{path:'/',sameSite:'lax',secure:request.nextUrl.protocol==='https:',maxAge:31536000})
 response.headers.set('Content-Language',locale);response.headers.set('Vary','Cookie')
 return response
}
export const config={matcher:['/((?!_next/static|favicon.ico).*)']}
