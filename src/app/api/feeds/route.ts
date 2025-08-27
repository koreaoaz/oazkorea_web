import { NextResponse } from "next/server";

/** -------- helpers -------- */
const decodeHtml = (s: string = "") =>
  s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

const normalizeUrl = (u?: string | null) => {
  if (!u) return null;
  let url = u.trim().replace(/&amp;/g, "&");
  if (url.startsWith("//")) url = "https:" + url;
  return url;
};

function pickTag(seg: string, tag: string) {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i");
  return seg.match(re)?.[1]?.trim() ?? "";
}

function pickAttr(seg: string, tag: string, attr: string) {
  const re = new RegExp(`<${tag}[^>]*${attr}=["']([^"']+)["'][^>]*>`, "i");
  return seg.match(re)?.[1] ?? "";
}

function firstImageFromHtml(html = "") {
  // 1) data-* 우선
  let m =
    html.match(/<img[^>]+(?:data-src|data-original|data-orig|data-lazy-src)=["']([^"']+)["']/i);
  if (m) return normalizeUrl(m[1]);

  // 2) srcset이면 첫 URL만 사용
  m = html.match(/<img[^>]+srcset=["']([^"']+)["']/i);
  if (m) return normalizeUrl(m[1].split(",")[0].trim().split(" ")[0]);

  // 3) 일반 src
  m = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (m) return normalizeUrl(m[1]);

  // 4) background-image
  m = html.match(/background-image:\s*url\((['"]?)(.*?)\1\)/i);
  if (m) return normalizeUrl(m[2]);

  return null;
}

async function fetchOgImage(pageUrl: string) {
  try {
    const res = await fetch(pageUrl, { cache: "no-store" });
    const html = await res.text();
    const m1 = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);
    if (m1) return normalizeUrl(m1[1]);
    const m2 = html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i);
    if (m2) return normalizeUrl(m2[1]);
  } catch {
    // ignore
  }
  return null;
}

/** -------- types -------- */
type FeedItem = {
  id?: string;
  title: string;
  description: string;
  author: string;
  date: string; // ISO
  link: string;
  image?: string | null;
};

/** -------- sources -------- */
// 실제 주소로 유지/추가하세요
const rssFeeds = [
  "https://seokx2.tistory.com/rss",
];

/** -------- core -------- */
async function fetchRss(url: string): Promise<FeedItem[]> {
  const res = await fetch(url, { cache: "no-store" });
  const xml = await res.text();

  const items: FeedItem[] = [];
  const blocks = xml.split("<item>").slice(1);

  for (const block of blocks) {
    const seg = block.split("</item>")[0];

    const title = decodeHtml(pickTag(seg, "title"));
    const link = decodeHtml(pickTag(seg, "link") || pickTag(seg, "guid"));

    // 티스토리는 content:encoded에 본문이 주로 있음
    const contentEncoded = pickTag(seg, "content:encoded") || pickTag(seg, "content");
    const descriptionRaw = contentEncoded || pickTag(seg, "description");
    const description = decodeHtml(descriptionRaw);

    const author = decodeHtml(pickTag(seg, "author") || pickTag(seg, "dc:creator"));
    const pubDate = pickTag(seg, "pubDate");
    const date = pubDate ? new Date(pubDate).toISOString() : new Date().toISOString();

    // ① HTML 내부에서 이미지 찾기
    let image =
      firstImageFromHtml(description) ||
      null;

    // ② enclosure / media:* 태그에서도 시도
    if (!image) {
      image =
        normalizeUrl(pickAttr(seg, "enclosure", "url")) ||
        normalizeUrl(pickAttr(seg, "media:content", "url")) ||
        normalizeUrl(pickAttr(seg, "media:thumbnail", "url")) ||
        null;
    }

    items.push({ id: link || title, title, link, description, author, date, image });
  }

  // ③ 그래도 이미지가 비어있는 항목은 OG 이미지 조회 (최대 6개만)
  const needOg = items.filter((x) => !x.image).slice(0, 6);
  await Promise.all(
    needOg.map(async (it) => {
      const og = await fetchOgImage(it.link);
      if (og) it.image = og;
    })
  );

  return items;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const page = Number(searchParams.get("page") ?? 0);
    const limit = Number(searchParams.get("limit") ?? 10);
    const searchType = Number(searchParams.get("searchType") ?? 0);
    const q = (searchParams.get("q") ?? "").trim().toLowerCase();

    const lists = await Promise.allSettled(rssFeeds.map(fetchRss));
    const all = lists.flatMap((r) => (r.status === "fulfilled" ? r.value : []));

    // 최신순
    all.sort((a, b) => +new Date(b.date) - +new Date(a.date));

    // 검색
    const filtered = q
      ? all.filter((it) => {
          if (searchType === 0) return it.title?.toLowerCase().includes(q);
          if (searchType === 1) return (it.description ?? "").toLowerCase().includes(q);
          return (it.author ?? "").toLowerCase().includes(q);
        })
      : all;

    const total = filtered.length;
    const start = page * limit;
    const items = filtered.slice(start, start + limit);

    return NextResponse.json({ total, items });
  } catch (e) {
    console.error("FEEDS_API_ERROR", e);
    return NextResponse.json({ total: 0, items: [] }, { status: 500 });
  }
}
