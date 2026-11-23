import {headers} from 'next/headers'
import {localNews} from '@/lib/local-news-editions'
import {verifiedNewsSource} from '@/lib/news-provenance'
import Link from 'next/link'
import {supabase} from '@/lib/supabaseClient'
import {matchesReleaseNews,releaseNewsIds} from '@/lib/news-release'
import {isNewsActivity,NEWS_EVENT_IDS} from '@/lib/project-activities'
import {compareNews,newsContentYear,newsDate} from '@/lib/news'
import {ContentTitle} from '@/components/ContentTitle'
import {ContentImage} from '@/components/ContentImage'
import {imageURL} from '@/lib/image-delivery'
import {getEventImages} from '@/app/editor/utils/parsing_first'
import {T} from '@/components/LocaleProvider'
export const dynamic='force-dynamic'
export default async function News({searchParams}:{searchParams:Promise<{sort?:string;lang?:string}>}){
 const {sort,lang}=await searchParams
 const oldest=sort==='oldest'
 const query=supabase.from('editor_6_events').select('id,title,description,filenames,created_at').order('created_at',{ascending:false})
 const {data,error}=await (process.env.NEXT_PUBLIC_OAZ_DESKTOP_INTEGRATION==='owned-v1'?query.limit(1000):query.in('id',[...NEWS_EVENT_IDS,...releaseNewsIds()]))
 const english=(await headers()).get('x-oaz-locale')==='en'
 const entries=await localNews()
 const authorized = await Promise.all((data??[]).map(async row =>
   isNewsActivity({sourceTable:'editor_6_events',id:row.id}) || await matchesReleaseNews(row) ? row : null))
 const rows=authorized.filter(row=>row!==null).map(row=>{
   const source=verifiedNewsSource(row)
   const date=source?.sources[0]?.publishedAt??row.created_at
   const file=getEventImages(row.filenames).sort((a,b)=>a.order-b.order)[0]?.filename
   return {source:source?'Instagram · @ku_oaz':'OaZ',key:String(row.id),id:row.id,title:row.title,year:newsContentYear(row.title??'',date),date,href:'/news/'+row.id,image:file?imageURL('card_news',file,supabase.storage.from('card_news').getPublicUrl(file).data.publicUrl):undefined}
 })
 const cards=[...rows,...Object.entries(entries).filter(([slug])=>slug!=='oaz-news-6'||!rows.some(row=>row.id===6)).map(([slug,post])=>({source:post.url.startsWith('https://www.instagram.com/')?'Instagram · @ku_oaz':'OaZ',key:slug,id:null,title:english?post.titleEn:post.title,year:newsContentYear(post.title,post.publishedAt),date:post.publishedAt,href:'/news/archive/'+slug,image:'/news/archive/'+slug+'/media/'+post.frames[0]}))].sort((a,b)=>compareNews(a,b,oldest))
 const leadImage=cards.find(card=>card.image)
 return <section data-news-list className="mx-auto max-w-5xl px-0 py-12 sm:px-4">
  <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
   <h1 className="text-3xl font-bold"><T text="학회 소식"/></h1>
   <nav aria-label={english?'News order':'소식 정렬'} className="flex gap-1 rounded-lg border p-1">
    {(['newest','oldest'] as const).map(order=>{
     const active=(order==='oldest')===oldest
     const label=order==='oldest'?(english?'Oldest':'오래된순'):(english?'Newest':'최신순')
     return <Link key={order} href={{pathname:'/news',query:{...(lang==='ko'||lang==='en'?{lang}:{}),sort:order}}} scroll={false} aria-current={active?'page':undefined} className={`inline-flex min-h-11 items-center rounded-md px-3 text-sm font-medium focus-visible:outline-2 ${active?'bg-zinc-950 text-white':'text-zinc-700 hover:bg-zinc-100'}`}>{label}</Link>
    })}
   </nav>
  </div>
  {error?<p role="status"><T text="소식을 불러오지 못했습니다. 잠시 후 다시 확인해 주세요."/></p>:<div data-news-grid className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 lg:gap-6">{cards.map(row=>{
   return <article key={row.href} data-news-id={row.key} data-content-year={row.year} className="flex min-w-0 flex-col overflow-hidden rounded-2xl border bg-white shadow-sm">
    <Link href={row.href} className="flex h-full min-w-0 flex-col focus-visible:outline-2" aria-labelledby={`news-title-${row.key} news-detail-${row.key}`}>
     {row.image?<ContentImage loading={row===leadImage?'eager':'lazy'} fetchPriority={row===leadImage?'high':undefined} width={700} height={525} unoptimized src={row===leadImage && row.image.startsWith('/api/images/card_news/')?row.image+'?view=news-card':row.image} alt="" className="aspect-[4/3] w-full bg-slate-50 object-contain"/>:<div data-news-placeholder aria-hidden="true" className="grid aspect-[4/3] w-full place-items-center bg-slate-50"><ContentImage src="/oaz-mobile-poster.png" alt="" width={1920} height={730} unoptimized className="w-1/2 object-contain mix-blend-multiply"/></div>}
     <div className="flex min-w-0 flex-1 flex-col gap-2 p-4 sm:gap-3 sm:p-5">
      <div className="text-xs text-zinc-600">{row.year!==Number(newsDate(row.date).slice(0,4))&&<span>{english?'Activity year':'활동 연도'} {row.year} · </span>}{english?'Published':'게시'} <time dateTime={row.date}>{newsDate(row.date)}</time></div><span className="text-xs text-zinc-500">{row.source}</span>
      <h2 id={`news-title-${row.key}`} className="line-clamp-3 break-words text-sm font-semibold leading-5 sm:text-base sm:leading-6">{row.id!==null?<ContentTitle table="editor_6_events" id={row.id} title={row.title}/>:row.title}</h2>
      <span id={`news-detail-${row.key}`} className="mt-auto inline-flex min-h-11 max-w-full items-center self-start rounded-lg border border-slate-200 px-2 text-xs leading-[18px] font-medium whitespace-nowrap sm:px-4 sm:text-sm sm:leading-5"><T text="상세보기"/></span>
     </div>
    </Link>
   </article>
  })}</div>}
 </section>
}
