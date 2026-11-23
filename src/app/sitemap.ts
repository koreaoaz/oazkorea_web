import type {MetadataRoute} from 'next'
import {localeURL} from '@/lib/locale'

// Public navigation destinations. Record IDs belong to separate catalogs and are never interchangeable.
const paths=['/','/about/who-we-are','/about/executive-team','/about/notice','/news','/projects/overview','/projects/archives','/studies/overview','/studies/records','/studies/schedule','/schedule/calendar','/recruit/faq','/recruit/timeline','/recruit/recruitment','/alumni/hall-of-fame','/alumni/network']
export default function sitemap():MetadataRoute.Sitemap {
 if(process.env.OAZ_PREVIEW_MODE==='offline-v1')return []
 const origin='https://www.oazkorea.co.kr'
 return paths.flatMap(path=>{
  const languages={ko:origin+localeURL(path,'ko'),en:origin+localeURL(path,'en')}
  return Object.values(languages).map(url=>({url,alternates:{languages}}))
 })
}
