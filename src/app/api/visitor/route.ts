import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";
import { atomicVisitor } from "@/lib/visitorAtomic";

export const dynamic = "force-dynamic";
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
const unavailable = () => json({ error: "방문자 집계 결과를 확인하지 못했습니다." }, 500);
const countValue = (value: unknown): number | null => {
  if (typeof value !== "number" && !(typeof value === "string" && /^\d+$/.test(value))) return null;
  const count = Number(value);
  return Number.isSafeInteger(count) && count >= 0 ? count : null;
};

const ROW_ID = 1;


// KST YYYY-MM-DD
const yyyymmddKST = (d: Date | string) => {
  const date = new Date(d);
  if (!Number.isFinite(date.getTime())) throw new Error("Invalid visitor timestamp");
  return date.toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
};

export async function GET() {
  try {
  if (typeof process !== "undefined" && process.env.OAZ_VISITOR_V2_ENABLED === "true") {
    return json(await atomicVisitor(id => supabase.rpc("oaz_visit_v2", { request_id: id }), null));
  }
  const { data, error } = await supabase
    .from("today_visitor")
    .select("visitor, updated_at")
    .eq("id", ROW_ID)
    .single();

  if (error || !data || countValue(data.visitor) === null) return unavailable();

  const todayKST = yyyymmddKST(new Date());
  if (data.updated_at != null && typeof data.updated_at !== "string") return unavailable();
  const lastDateKST = data.updated_at == null ? null : yyyymmddKST(data.updated_at);
  if (lastDateKST && lastDateKST > todayKST) return unavailable();

  if (lastDateKST !== todayKST) {
    // GET projects a new KST day without changing database state.
    return json({ count: 0, date: todayKST });
  }

  return json({ count: countValue(data.visitor), date: todayKST });
  } catch { return unavailable(); }
}

export async function POST(request: Request) {
  try {
  const expected=process.env.OAZ_ADMIN_ORIGIN;
  if(!expected || request.headers.get("origin")!==expected) return json({error:"ORIGIN_DENIED"},403);
  if(process.env.OAZ_VISITOR_V2_ENABLED!=="true") return json({error:"VISITOR_NOT_READY"},503);
  if (typeof process !== "undefined" && process.env.OAZ_VISITOR_V2_ENABLED === "true") {
    const id = request?.headers.get("Idempotency-Key");
    if (!id) return json({ error: "VISIT_REQUEST_REQUIRED" }, 400);
    return json(await atomicVisitor(key => supabase.rpc("oaz_visit_v2", { request_id: key }), id));
  }
  // ✅ 원자적 증가 (RPC)
  const { data, error } = await supabase.rpc("increment_visit", { row_id: ROW_ID });

  if (error || countValue(data) === null) return unavailable();

  return json({
    count: countValue(data),
    date: yyyymmddKST(new Date()),
  });
  } catch { return unavailable(); }
}
