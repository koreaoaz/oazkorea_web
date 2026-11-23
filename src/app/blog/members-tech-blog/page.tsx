'use client';


import {T, useLocale} from '@/components/LocaleProvider';
import { useAsyncQuery } from "@/hooks/useAsyncQuery";
import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { formatDistance } from "date-fns";
import { enUS, ko } from "date-fns/locale";

/** ===== Types ===== */
type FeedItem = {
  id?: string;
  title: string;
  description: string;
  author: string;
  date: string; // ISO
  link: string;
  image?: string | null;
};
type FeedResponse = { total: number; items: FeedItem[]; _debug?: unknown };

/** ===== UI Const ===== */
const PAGE_SIZE = 10;
const SEARCH_TYPES = ["제목", "내용", "작성자"] as const;

/** ===== Utils ===== */
const stripHtml = (html = "") =>
  html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

const fmtRelative = (iso: string, english: boolean) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return formatDistance(d, new Date(), { locale: english ? enUS : ko, addSuffix: true });
};

/** ===== Small UI Pieces ===== */
function Hero() {
  return (
    <div className="relative w-full border-b border-black/10 bg-[url('/hero-code.jpg')] bg-cover bg-center">
      <div className="absolute inset-0 bg-black/50" />
      <div className="relative mx-auto max-w-5xl px-4 py-14 text-center text-white">
        <h1 className="text-2xl font-semibold sm:text-3xl">Members Tech Blog</h1>
        <p className="mt-3 text-sm opacity-90"><T text="이곳은 구성원들의 블로그 글을 한 곳에서 모아보는 피드입니다."/></p>
      </div>
    </div>
  );
}

function Toolbar({
  searchType,
  setSearchType,
  q,
  setQ,
  onSubmit,
}: {
  searchType: number;
  setSearchType: (v: number) => void;
  q: string;
  setQ: (v: string) => void;
  onSubmit: () => void;
}) {
  const english = useLocale() === "en";
  return (
    <div className="mx-auto mt-6 flex w-full max-w-5xl items-center gap-2 px-4">
      <select
        value={searchType}
        onChange={(e) => setSearchType(Number(e.target.value))}
        className="h-10 w-24 rounded-md border border-gray-200 bg-gray-100 px-2 text-sm outline-none"
        aria-label={english ? "Search field" : "검색 타입"}
      >
        {SEARCH_TYPES.map((label, i) => (
          <option key={label} value={i}>
            {english ? ["Title", "Content", "Author"][i] : label}
          </option>
        ))}
      </select>

      <div className="relative flex-1">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onSubmit()}
          className="h-10 w-full rounded-md border border-gray-200 bg-white px-3 pr-10 text-sm outline-none"
          placeholder={english ? "Enter a search term" : "검색어를 입력하세요"}
          aria-label={english ? "Search term" : "검색어"}
        />
        <button
          onClick={onSubmit}
          className="absolute right-1 top-1/2 -translate-y-1/2 rounded-md px-3 py-1 text-sm text-gray-600 hover:bg-gray-100"
          aria-label={english ? "Search" : "검색"}
        >
          🔍
        </button>
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="grid grid-cols-[128px_1fr] gap-4 rounded-xl bg-white p-4 sm:grid-cols-[96px_1fr]">
      <div className="h-24 w-full animate-pulse rounded-lg bg-gray-200" />
      <div className="flex flex-col justify-between">
        <div>
          <div className="mb-2 h-5 w-2/3 animate-pulse rounded bg-gray-200" />
          <div className="h-4 w-11/12 animate-pulse rounded bg-gray-200" />
          <div className="mt-1 h-4 w-3/5 animate-pulse rounded bg-gray-200" />
        </div>
        <div className="mt-3 h-4 w-40 animate-pulse rounded bg-gray-200" />
      </div>
    </div>
  );
}

function FeedCard({ item }: { item: FeedItem }) {
  const english = useLocale() === "en";
  const decodeHtmlOnClient = (s = "") => {
    if (!s) return "";
    const el = document.createElement("textarea");
    el.innerHTML = s;
    return el.value;
  };

  const text = useMemo(() => {
    const decoded = decodeHtmlOnClient(item.description ?? "");
    return stripHtml(decoded);
  }, [item.description]);
  const time = useMemo(() => fmtRelative(item.date, english), [item.date, english]);

  return (
    <Link
      href={item.link}
      target="_blank"
      rel="noopener noreferrer"
      className="group grid grid-cols-[128px_1fr] items-stretch gap-4 rounded-xl bg-white p-4 transition-shadow hover:shadow-md sm:grid-cols-[96px_1fr]"
    >
      <div className="relative h-24 w-full overflow-hidden rounded-lg bg-gray-100">
        {item.image ? (
          <Image
            src={item.image}
            alt={english ? `${item.title} thumbnail` : `${item.title} 썸네일`}
            fill
            unoptimized
            loading="eager"
            decoding="auto"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = "/images/placeholder.png";
            }}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-gray-400">
            No Image
          </div>
        )}
      </div>

      <div className="flex min-w-0 flex-col justify-between">
        <div>
          <h3 className="line-clamp-1 text-base font-semibold text-gray-900">
            {item.title}
          </h3>
          <p className="mt-1 line-clamp-2 text-sm leading-5 text-gray-600">{text}</p>
        </div>
        <div className="mt-3 text-xs text-gray-500">
          {time && (
            <>
              {time}
              {" · "}
            </>
          )}
          {item.author}
        </div>
      </div>
    </Link>
  );
}

function Pagination({
  page,
  setPage,
  total,
  limit,
}: {
  page: number;
  setPage: (p: number) => void;
  total: number;
  limit: number;
}) {
  const pageCount = Math.max(1, Math.ceil(total / limit));
  if (pageCount <= 1) return null;

  const go = (p: number) => setPage(Math.min(pageCount - 1, Math.max(0, p)));
  const nums = Array.from({ length: pageCount }, (_, i) => i).filter(
    (i) => Math.abs(i - page) <= 2 || i === 0 || i === pageCount - 1
  );

  const withEllipsis: (number | "...")[] = [];
  nums.forEach((n, i) => {
    if (i === 0) withEllipsis.push(n);
    else {
      const prev = nums[i - 1];
      if (n - prev > 1) withEllipsis.push("...", n);
      else withEllipsis.push(n);
    }
  });

  return (
    <div className="mx-auto mt-6 flex max-w-5xl items-center justify-center gap-1 px-4">
      <button
        onClick={() => go(page - 1)}
        className="rounded-md px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-40"
        disabled={page === 0}
      ><T text="이전"/></button>
      {withEllipsis.map((x, i) =>
        x === "..." ? (
          <span key={`e-${i}`} className="px-2 text-sm text-gray-400">
            …
          </span>
        ) : (
          <button
            key={x}
            onClick={() => go(x)}
            className={`rounded-md px-3 py-2 text-sm ${
              x === page ? "bg-gray-900 text-white" : "text-gray-700 hover:bg-gray-100"
            }`}
          >
            {x + 1}
          </button>
        )
      )}
      <button
        onClick={() => go(page + 1)}
        className="rounded-md px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-40"
        disabled={page === pageCount - 1}
      ><T text="다음"/></button>
    </div>
  );
}

/** ===== Page ===== */
type FeedQuery = { page: number; searchType: number; q: string; revision: number };
const EMPTY_FEED: FeedResponse = { total: 0, items: [] };
async function fetchFeed(request: FeedQuery, signal: AbortSignal): Promise<FeedResponse> {
  const params = new URLSearchParams({ page: String(request.page), limit: String(PAGE_SIZE), searchType: String(request.searchType) });
  if (request.q.trim()) params.set("q", request.q.trim());
  let url = `/api/feeds?${params.toString()}`;
  if (typeof window !== "undefined" && window.location.search.includes("debug=1")) url += "&debug=1";
  const response = await fetch(url, { cache: "no-store", signal });
  const text = await response.text();
  if (!response.ok) throw new Error("피드를 불러오지 못했습니다.");
  try {
    const data: FeedResponse = JSON.parse(text);
    return { items: data.items ?? [], total: data.total ?? 0 };
  } catch { throw new Error("피드 응답 파싱 실패"); }
}

export default function FeedPage() {
  const english = useLocale() === "en";
  const [searchType, setSearchType] = useState(0);
  const [q, setQ] = useState("");
  const [request, setRequest] = useState<FeedQuery>({ page: 0, searchType: 0, q: "", revision: 0 });
  const query = useCallback((signal: AbortSignal) => fetchFeed(request, signal), [request]);
  const { data: { items, total }, loading, error: errMsg } = useAsyncQuery(JSON.stringify(request), query, EMPTY_FEED, "피드를 불러오지 못했습니다. 다시 시도해 주세요.");
  const page = request.page;
  const limit = PAGE_SIZE;
  const setPage = (page: number) => setRequest((previous) => ({ ...previous, page }));
  const submitSearch = () => setRequest((previous) => ({ page: 0, searchType, q, revision: previous.revision + 1 }));

  return (
    <div className="min-h-screen bg-[#f5f5f5]">
      <Hero />

      <Toolbar
        searchType={searchType}
        setSearchType={setSearchType}
        q={q}
        setQ={setQ}
        onSubmit={submitSearch}
      />

      {/* 에러 배너 */}
      {errMsg && (
        <div className="mx-auto mt-4 max-w-5xl px-4">
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {english ? "Unable to load the feed. Please try again." : errMsg}
          </div>
        </div>
      )}

      <div className="mx-auto my-6 max-w-5xl px-4">
        {/* 로딩 스켈레톤 */}
        {loading && (!items || items.length === 0) && (
          <div className="space-y-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        )}

        {/* 결과 */}
        {!loading && items && items.length > 0 && (
          <div className="space-y-4">
            {items.map((it) => (
              <FeedCard key={it.id ?? it.link} item={it} />
            ))}
          </div>
        )}

        {/* 빈 상태 */}
        {!loading && items && items.length === 0 && !errMsg && (
          <div className="rounded-xl bg-white p-8 text-center text-sm text-gray-500"><T text="피드가 존재하지 않습니다."/></div>
        )}

        {/* 페이지네이션 */}
        {!loading && total > limit && (
          <div className="border-t border-gray-200 pt-4">
            <Pagination page={page} setPage={setPage} total={total} limit={limit} />
          </div>
        )}
      </div>
    </div>
  );
}
