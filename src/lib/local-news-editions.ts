import {readFile} from 'node:fs/promises'
import path from 'node:path'
import archive from '@/data/news-website-archive.json'
export type Edition = {sourceId:string;publishedAt:string;title:string;titleEn:string;body:string;bodyEn:string;url:string;frames:string[]}
const directory=path.join(process.cwd(),'server-data','reviewed-news')
export async function localNews(): Promise<Record<string,Edition>> {
  if(process.env.OAZ_DESKTOP_DEV!=='true'||process.env.NEXT_PUBLIC_OAZ_DESKTOP_INTEGRATION!=='owned-v1'||process.env.VERCEL) return {}
  try { return JSON.parse(await readFile(path.join(directory,'index.json'),'utf8')) }
  catch(error){ if((error as NodeJS.ErrnoException).code==='ENOENT')return {}; throw error }
}
export async function edition(slug:string) {
  if(!/^[A-Za-z0-9_-]{3,50}$/.test(slug))return null
  const index=await localNews()
  return Object.hasOwn(index,slug)?index[slug]:null
}
export async function editionImage(slug:string,key:string) {
  if(!/^[a-f0-9]{64}$/.test(key)||!(await edition(slug))?.frames.includes(key))return null
  try{return await readFile(path.join(directory,key+'.webp'))}catch{return null}
}



export async function archivedNewsHref(language?:string) {
  const slug = 'oaz-news-6'
  const post = await edition(slug)
  const original = archive[slug]
  if (!post || post.sourceId !== slug || post.url !== original.url || post.title !== original.title
      || post.body !== original.body || Date.parse(post.publishedAt) !== Date.parse(original.publishedAt)
      || post.frames.length !== original.frames.length) return null
  return '/news/archive/' + slug + (language === 'en' || language === 'ko' ? '?lang=' + language : '')
}
