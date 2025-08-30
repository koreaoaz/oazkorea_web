"use client"

import * as React from "react"
import { Calendar } from "@/components/ui/calendar"
import { supabase } from "@/lib/supabaseClient"

interface Schedule {
  id: number
  description: string
  start_date: string // "YYYY-MM-DD"
  end_date: string   // "YYYY-MM-DD"
}

function toDateOnly(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function parseYMD(s: string) {
  const [y, m, d] = s.split("-").map(Number)
  return new Date(y, m - 1, d)
}

function expandDates(start: Date, end: Date): Date[] {
  const out: Date[] = []
  const cur = new Date(start)
  while (cur <= end) {
    out.push(new Date(cur))
    cur.setDate(cur.getDate() + 1)
  }
  return out
}

export default function Calendar01() {
  // 클릭한 날짜(오른쪽 목록 필터용)
  const [selectedDate, setSelectedDate] = React.useState<Date | undefined>(toDateOnly(new Date()))
  // Supabase 이벤트
  const [schedules, setSchedules] = React.useState<Schedule[]>([])
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    const fetchSchedules = async () => {
      setLoading(true)
      setError(null)
      const { data, error } = await supabase
        .from("month_schedule")
        .select("id, description, start_date, end_date")
        .order("start_date", { ascending: true })
      if (error) setError(error.message)
      setSchedules(data || [])
      setLoading(false)
    }
    fetchSchedules()
  }, [])

  // --- 이벤트를 달력에 칠하기 위한 modifier용 날짜 집합 생성 ---
  const { evStart, evMiddle, evEnd, allEventDates } = React.useMemo(() => {
    const starts: Date[] = []
    const middles: Date[] = []
    const ends: Date[] = []
    const all: Date[] = []

    for (const s of schedules) {
      const sd = toDateOnly(parseYMD(s.start_date))
      const ed = toDateOnly(parseYMD(s.end_date))
      const days = expandDates(sd, ed)

      if (days.length === 1) {
        // 하루 이벤트: 시작이자 끝
        starts.push(days[0])
        ends.push(days[0])
        all.push(days[0])
      } else {
        starts.push(days[0])
        ends.push(days[days.length - 1])
        all.push(...days)
        if (days.length > 2) {
          middles.push(...days.slice(1, -1))
        }
      }
    }
    // 중복 제거
    const uniq = (arr: Date[]) =>
      Array.from(
        new Set(arr.map(d => +toDateOnly(d)))
      ).map(t => new Date(t))

    return {
      evStart: uniq(starts),
      evMiddle: uniq(middles),
      evEnd: uniq(ends),
      allEventDates: uniq(all),
    }
  }, [schedules])

  // 오른쪽 리스트: 선택한 날짜가 포함된 이벤트만
  const eventsForSelected = React.useMemo(() => {
    if (!selectedDate) return []
    const target = +toDateOnly(selectedDate)
    return schedules.filter(s => {
      const sd = +toDateOnly(parseYMD(s.start_date))
      const ed = +toDateOnly(parseYMD(s.end_date))
      return sd <= target && target <= ed
    })
  }, [schedules, selectedDate])

  return (
    <div className="w-full h-auto flex flex-col md:flex-row gap-6 px-2 py-2">
      <Calendar
        // 여기서는 사용자의 range 선택을 쓰지 않습니다.
        // Supabase 이벤트를 "연속 사각형"으로 칠하기 위해
        // custom modifiers만 사용합니다.
        mode="single"
        selected={selectedDate}
        onSelect={(d) => setSelectedDate(d ? toDateOnly(d) : undefined)}
        numberOfMonths={1}
        // ⬇️⬇️⬇️ 이벤트 도장: 시작/중간/끝을 각각 modifier로 넘김
        modifiers={{
          evStart,
          evMiddle,
          evEnd,
        }}
        className="max-w-xs sm:max-w-sm md:max-w-md lg:max-w-lg"
      />

      <div className="w-full max-w-md">
        <h2 className="font-bold text-lg mb-2">
          {selectedDate?.toLocaleDateString("ko-KR")} 일정
        </h2>

        {loading && <p className="text-gray-500">불러오는 중…</p>}
        {error && <p className="text-red-500">오류: {error}</p>}

        {!loading && !error && (
          eventsForSelected.length > 0 ? (
            <ul className="space-y-2">
              {eventsForSelected.map((ev) => (
                <li
                  key={ev.id}
                  className="p-3 rounded-xl shadow bg-gray-50 border border-gray-200"
                >
                  <p className="font-semibold">{ev.description}</p>
                  <p className="text-sm text-gray-600">
                    {ev.start_date} ~ {ev.end_date}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-500">일정이 없습니다.</p>
          )
        )}
      </div>
    </div>
  )
}