import {notFound} from 'next/navigation'
import Link from 'next/link'
import {headers} from 'next/headers'
import {edition} from '@/lib/local-news-editions'
import {NewsGallery} from '@/components/NewsGallery'
import {newsDate} from '@/lib/news'
export const dynamic='force-dynamic'
export default async function Page({params}:{params:Promise<{slug:string}>}){
  const {slug}=await params
  const post=await edition(slug)
  if(!post)notFound()
  const en=(await headers()).get('x-oaz-locale')==='en'
  return <article className="mx-auto max-w-3xl space-y-5 px-4 py-8"><Link href="/news" className="underline">{en?'Back to News':'학회 소식 목록'}</Link><time className="block" dateTime={post.publishedAt}>{newsDate(post.publishedAt)}</time><h1 className="text-2xl font-bold">{en?post.titleEn:post.title}</h1><p className="whitespace-pre-wrap">{en?post.bodyEn:post.body}</p><NewsGallery title={en?post.titleEn:post.title} images={post.frames.map(key=>'/news/archive/'+slug+'/media/'+key)}/><a className="underline" href={post.url} rel="noreferrer" target="_blank">{post.url.startsWith('https://www.oazkorea.co.kr/')?(en?'Original OaZ News article':'공식 홈페이지 원문'):(en?'Original Instagram post':'공식 Instagram 원문')}</a></article>
}

