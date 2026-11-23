import {matchesReleaseNews} from '@/lib/news-release'
import {verifiedNewsSource} from '@/lib/news-provenance'
import {imageURL} from '@/lib/image-delivery'
import {NewsGallery} from '@/components/NewsGallery'
import {isNewsActivity} from '@/lib/project-activities'
import {newsDate,newsSource} from '@/lib/news'
import {NewsSource} from '@/components/NewsSource'
import {TranslatedContent} from "@/components/TranslatedContent";
import Link from 'next/link';
import {T} from '@/components/LocaleProvider';
import { supabase } from "@/lib/supabaseClient";
import {archivedNewsHref} from '@/lib/local-news-editions'
import { notFound, redirect } from "next/navigation"
import { ImageFromStorage } from "@/app/events/archive/components/ImageFromStorage"

import { getEventImages } from "@/app/editor/utils/parsing_first"

type PageProps = {
  params: Promise<{ id: string }>
}

export default async function EventDetail({ params, newsOnly = false, language }: PageProps & {newsOnly?: boolean;language?:string}) {
    const { id } = await params
  if(!/^(0|[1-9][0-9]*)$/.test(id)||!Number.isSafeInteger(Number(id)))notFound()
  const { data: event, error } = await supabase
    .from("editor_6_events")
    .select("id,title,description,created_at,filenames")
    .eq("id", id)
    .maybeSingle()

  if (error) notFound()
  if (!event) {
    const fallback = newsOnly && id === '6' ? await archivedNewsHref(language) : null
    if (fallback) redirect(fallback)
    notFound()
  }

  const images = getEventImages(event.filenames)

  images.sort((a, b) => a.order - b.order)

  const isNews=isNewsActivity({id:event.id,sourceTable:'editor_6_events',reviewedNews:await matchesReleaseNews(event)})
  if(newsOnly && !isNews)notFound()
  const source=verifiedNewsSource(event)??newsSource(event.id)
  const date=source?.sources[0]?.publishedAt??event.created_at
  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <Link href={isNews?'/news':'/projects/archives'} className="mb-6 inline-flex min-h-11 items-center underline"><T text={isNews?'← 학회 소식 목록':'← 프로젝트·활동 목록'}/></Link>
      <p className="mb-4 text-sm text-slate-500"><T text={source?'Instagram 게시일':'게시일'}/>: <time dateTime={date}>{isNews?newsDate(date):event.created_at?.slice(0,10)}</time></p>
      {/* 상단 텍스트 */}
      <header className="mb-12">
        <TranslatedContent table="editor_6_events" id={event.id} title={event.title||""} body={event.description||""}/>

        <hr className="border-t border-gray-200" />
        </header>

      {/* 이미지 본문 */}
      {isNews?<NewsGallery title={event.title??''} images={images.map(i=>imageURL('card_news',i.filename,supabase.storage.from('card_news').getPublicUrl(i.filename).data.publicUrl))}/>:<section className="space-y-2">
        {images.map((img) => (
          <ImageFromStorage
            key={img.filename}
            board="행사"
            filename={img.filename}
            className="w-full rounded-lg border"
          />
        ))}
      </section>}
      <NewsSource id={Number(id)} verified={source}/>
    </div>
  )
}
