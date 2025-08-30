import { notFound } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export const revalidate = 60;

export default async function NoticeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;              // ← Promise 해제
  const noticeId = Number.isNaN(Number(id)) ? id : Number(id); // id가 숫자면 숫자로

  const { data, error } = await supabase
    .from("editor_0_noti")
    .select("id, text, description, created_at")
    .eq("id", noticeId)
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
      <div className="mt-4 whitespace-pre-wrap">{data.description}</div>
    </article>
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;              // ← Promise 해제
  const noticeId = Number.isNaN(Number(id)) ? id : Number(id);

  const { data } = await supabase
    .from("editor_0_noti")
    .select("text")
    .eq("id", noticeId)
    .maybeSingle();

  return { title: data?.text ?? "공지사항" };
}
