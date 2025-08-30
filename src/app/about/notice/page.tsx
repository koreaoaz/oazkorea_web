
// src/app/about/notice/page.tsx
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

export const revalidate = 60; // ISR: 60초마다 신선도 유지 (원하면 0으로 SSR)

export default async function Page() {
  const { data, error } = await supabase
    .from("editor_0_noti")
    .select("id, text, created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return <div className="p-6">오류: {error.message}</div>;
  }

  const notices = data ?? [];

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">공지사항</h1>
      </div>

      {notices.length === 0 ? (
        <p className="text-sm text-muted-foreground">등록된 공지가 없습니다.</p>
      ) : (
        <ul className="space-y-3">
          {notices.map((n) => (
            <li key={n.id} className="border rounded-lg p-4 hover:bg-muted/30">
              <Link href={`/about/notice/${n.id}`}>
                <div className="font-semibold">{n.text}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {new Date(n.created_at as string).toLocaleString()}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
