
import {T,LocalizedText} from '@/components/LocaleProvider';
import {PUBLIC_NOTICE_FEED,noticeDate} from '@/lib/notice-publication'
import {ContentTitle} from '@/components/ContentTitle'
import {ContentExcerpt} from '@/components/ContentExcerpt'
import {TranslatedContent} from "@/components/TranslatedContent";
// src/app/about/notice/[id]/page.tsx
import { cache } from "react";
import Link from "next/link";
import {NoticeImage} from "@/components/NoticeImage";
import { notFound } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export const dynamic = "force-dynamic";
// 메타데이터와 본문은 같은 공개 조회 결과를 사용한다. 요청 간 인증 캐시는 만들지 않는다.
const loadNotice = cache(async (id: string) => {
  if (!/^[1-9][0-9]*$/.test(id) || !Number.isSafeInteger(Number(id))) return {data:null,error:null};
  return supabase.from(PUBLIC_NOTICE_FEED).select("id,text,description,publication_date,is_noti,filename,attachment_status,schedule_ids").eq("id",Number(id)).maybeSingle();
});

export default async function NoticeDetailPage({
      params,
    }: {
      params: Promise<{ id: string }>;
    }) {
  const { id } = await params;
  const { data, error } = await loadNotice(id);

  if (error) {
    console.warn("공개 게시물 조회 실패");
    return (
      <div className="max-w-3xl mx-auto p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"><T text="게시물을 불러오지 못했습니다. 잠시 후 다시 확인해 주세요."/></div>
      </div>
    );
  }
  if (!data) return notFound();

  const listUrl = `/about/notice?type=${data.is_noti ? "공지" : "홍보"}`;
  const date = noticeDate(data.publication_date);
  const ids=Array.isArray(data.schedule_ids)?data.schedule_ids.filter((id:unknown)=>typeof id==='number'&&Number.isSafeInteger(id)&&id>0).slice(0,10):[];
  const {data:related}=ids.length?await supabase.from('editor_4_schedules').select('id,description,start_date').in('id',ids).order('start_date',{ascending:true}):{data:[]};

  return (
  <article className="max-w-3xl mx-auto p-6 min-h-[600px] flex flex-col">
    {/* 브레드크럼 / 뒤로가기 */}
    <div className="mb-6 flex items-center gap-2 text-sm text-muted-foreground">
      <Link href={listUrl} className="hover:underline">
        <T text={data.is_noti ? "공지사항" : "홍보"}/>
      </Link>
      <span aria-hidden>›</span>
      <span className="truncate max-w-[60%]"><ContentTitle isNotice={data.is_noti===true} table="editor_0_noti" id={data.id} title={data.text??""}/></span>
    </div>

    {/* 제목 & 메타 */}

    <div className="mt-1 text-sm text-muted-foreground tabular-nums"><T text="게시일"/> <time dateTime={data.publication_date}>{date}</time>
    </div>

    <hr className="my-6" />

    <NoticeImage filename={data.filename} title={data.text}/>
    {/* 본문 */}
    <div className="prose prose-slate max-w-none dark:prose-invert">
      {data.attachment_status==='missing'&&<p data-attachment-unavailable role="note" className="mb-5 rounded-lg border bg-slate-50 p-4 text-sm"><LocalizedText ko="원문에 언급된 첨부 자료는 현재 제공되지 않습니다. 자료와 공개 권한을 확인한 뒤 연결할 예정입니다." en="The attachment mentioned in this historical notice is currently unavailable. It will be linked only after the file and publication rights are verified."/></p>}
      <TranslatedContent table="editor_0_noti" id={data.id} title={data.text??""} body={data.description??""} promotion={data.is_noti===false} linkify={data.is_noti===true}/>
      {!!related?.length&&<section className="mt-6 space-y-2" data-related-schedules><h2 className="font-semibold"><LocalizedText ko="관련 일정" en="Related events"/></h2><ul className="space-y-2">{related.map(row=><li key={row.id}><Link className="text-blue-700 underline" href={`/schedule/calendar?event=${row.id}`}>{row.start_date} · <ContentExcerpt table="editor_4_schedules" id={row.id} body={row.description} part="title"/></Link></li>)}</ul></section>}
    </div>

    {/* 하단 액션 */}
    <div className="mt-auto pt-10">
      <Link
        href={listUrl}
        className="inline-flex items-center rounded-lg border px-3 py-2 text-sm hover:bg-muted/50"
      ><T text="← 목록으로"/></Link>
    </div>
  </article>
);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const {data} = await loadNotice(id);

  return { title: data?.text ?? "공지사항" };
}
