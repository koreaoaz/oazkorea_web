import type {MetadataRoute} from 'next'
export default function robots():MetadataRoute.Robots {
 const origin='https://www.oazkorea.co.kr'
 if(process.env.OAZ_PREVIEW_MODE==='offline-v1')return {rules:{userAgent:'*',disallow:'/'}}
 return {rules:{userAgent:'*',allow:'/',disallow:['/admin','/api/','/editor','/login_callback','/oauth_callback']},sitemap:origin+'/sitemap.xml'}
}
