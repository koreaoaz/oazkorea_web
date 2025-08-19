import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

const ROW_ID = 1;

// ✅ GET: 현재 방문자 수 (자정 체크 후 리셋)
export async function GET() {
  const { data, error } = await supabase
    .from("today_visitor")
    .select("visitor, updated_at")
    .eq("id", ROW_ID)
    .single();

  if (error) {
    console.error("❌ GET error", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const today = new Date().toISOString().slice(0, 10);
  const lastDate = data.updated_at?.slice(0, 10);

  // 자정 지났으면 0으로 초기화
  if (lastDate !== today) {
    const { data: resetData, error: resetError } = await supabase
      .from("today_visitor")
      .update({ visitor: 0, updated_at: new Date().toISOString() })
      .eq("id", ROW_ID)
      .select()
      .single();

    if (resetError) {
      console.error("❌ Reset error", resetError.message);
      return NextResponse.json({ error: resetError.message }, { status: 500 });
    }

    return NextResponse.json({ count: resetData.visitor });
  }

  return NextResponse.json({ count: data.visitor });
}

// ✅ POST: 방문자 수 +1 증가
export async function POST() {
  const { data, error } = await supabase.rpc("increment_visit", { row_id: ROW_ID });

  if (error) {
    console.error("❌ POST error", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ count: data });
}
