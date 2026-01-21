import Link from "next/link"
import { supabase } from "@/lib/supabaseClient"
import { ImageFromStorage } from "./components/ImageFromStorage"
import { getFirstImageFilename } from "./utils/parsing_first"

export const revalidate = 60
export const dynamic = "force-dynamic"

const PAGE_SIZE = 10
const PAGE_WINDOW = 5
const ROW_H = "h-28"

type PageProps = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

function ArrowButton({
  href,
  disabled,
  direction,
}: {
  href: string
  disabled?: boolean
  direction: "<" | ">"
}) {
  const base =
    "inline-flex h-9 w-9 items-center justify-center rounded-md border text-sm"

  if (disabled) {
    return (
      <span
        aria-disabled="true"
        className={`${base} text-gray-300 pointer-events-none`}
      >
        {direction}
      </span>
    )
  }

  return (
    <Link
      href={href}
      aria-label={direction === "<" ? "이전 페이지" : "다음 페이지"}
      className={`${base} text-gray-700 hover:bg-muted`}
    >
      {direction}
    </Link>
  )
}

export default async function EventsArchivePage({ searchParams }: PageProps) {
  /* 현재 페이지 */
  const sp = await searchParams
  const pageParam = Array.isArray(sp.page)
    ? sp.page[0]
    : sp.page
  const page = Math.max(1, Number(pageParam) || 1)

  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  /* 데이터 + 전체 개수 */
  const { data, error, count } = await supabase
    .from("editor_6_events")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to)

  if (error) {
    return <div className="p-6 text-red-500">데이터를 불러오지 못했습니다.</div>
  }

  const events = data ?? []
  const total = count ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  /* 페이지 버튼 범위 */
  let start = Math.max(1, page - Math.floor(PAGE_WINDOW / 2))
  let end = Math.min(totalPages, start + PAGE_WINDOW - 1)
  start = Math.max(1, end - PAGE_WINDOW + 1)

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">
        Events <span className="text-sm text-muted-foreground">({total})</span>
      </h1>

      {/* 리스트 */}
      <ul className="divide-y rounded-xl border bg-white">
        {events.map((event) => {
          const thumbnail = getFirstImageFilename(event.filenames)
          const date = new Date(event.created_at).toLocaleDateString("ko-KR", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
          })

          return (
            <li key={event.id} className="relative">
              <Link
                href={`/events/archive/${event.id}`}
                className="absolute inset-0"
                aria-label={`${event.title} 상세보기`}
              />

              <div
                className={[
                  "flex items-center gap-4 px-4 transition-colors hover:bg-muted/40",
                  ROW_H,
                ].join(" ")}
              >
                {/* 썸네일 */}
                <div className="w-32 h-20 flex-shrink-0">
                  {thumbnail ? (
                    <ImageFromStorage
                      board="행사"
                      filename={thumbnail}
                      className="w-full h-full object-cover rounded-md border"
                    />
                  ) : (
                    <div className="w-full h-full bg-gray-100 rounded-md flex items-center justify-center text-xs text-gray-400">
                      이미지 없음
                    </div>
                  )}
                </div>

                {/* 텍스트 */}
                <div className="flex-1 min-w-0">
                  <div className="font-semibold line-clamp-1">
                    {event.title}
                  </div>
                  {event.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {event.description}
                    </p>
                  )}
                </div>

                {/* 날짜 */}
                <div className="text-sm text-muted-foreground tabular-nums whitespace-nowrap">
                  {date}
                </div>
              </div>
            </li>
          )
        })}

        {/* ✅ 빈 블록 채우기 (항상 10개) */}
        {Array.from({
          length: Math.max(0, PAGE_SIZE - events.length),
        }).map((_, i) => (
          <li key={`empty-${i}`}>
            <div
              className={[
                "flex items-center gap-4 px-4 text-transparent",
                ROW_H,
              ].join(" ")}
            >
              <div className="w-32 h-20">—</div>
              <div className="flex-1">—</div>
              <div>—</div>
            </div>
          </li>
        ))}
      </ul>

      {/* 페이지네이션 */}
      <nav className="mt-6 flex items-center justify-center gap-1">
        <ArrowButton
          href={`/events/archive?page=${page - 1}`}
          disabled={page <= 1}
          direction="<"
        />

        {Array.from({ length: end - start + 1 }).map((_, i) => {
          const p = start + i
          const active = p === page
          return (
            <Link
              key={p}
              href={`/events/archive?page=${p}`}
              aria-current={active ? "page" : undefined}
              className={[
                "inline-flex h-9 min-w-9 items-center justify-center rounded-md px-3 text-sm",
                active
                  ? "bg-primary text-primary-foreground"
                  : "border hover:bg-muted",
              ].join(" ")}
            >
              {p}
            </Link>
          )
        })}

        <ArrowButton
          href={`/events/archive?page=${page + 1}`}
          disabled={page >= totalPages}
          direction=">"
        />
      </nav>
    </div>
  )
}
