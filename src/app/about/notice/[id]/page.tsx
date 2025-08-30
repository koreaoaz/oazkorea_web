// src/app/about/notice/[id]/page.tsx
import { notFound } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Params = { params: { id: string } };

export const revalidate = 60; // ISR

export default async function NoticeDetailPage({ params }: Params) {
  const id = params.id;
  const { data, error } = await supabase
    .from("editor_0_noti")
    .select("id, text, description, created_at")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return <div className="p-6">오류: {error.message}</div>;
  }
  if (!data) return notFound();

  return (
    <article className="max-w-3xl mx-auto p-6 prose">
      <h1>{data.text}</h1>
      <p className="text-sm text-muted-foreground">
        {new Date(data.created_at as string).toLocaleString()}
      </p>
      {/* description이 plain text라면 그대로, HTML이라면 dangerouslySetInnerHTML */}
      <div className="mt-4 whitespace-pre-wrap">{data.description}</div>
    </article>
  );
}

export async function generateMetadata({ params }: Params) {
  const { data } = await supabase
    .from("editor_0_noti")
    .select("text")
    .eq("id", params.id)
    .maybeSingle();

  return { title: data?.text ?? "공지사항" };
}
