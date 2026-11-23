'use client'

import { LocalizedText, T, useUIText } from '@/components/LocaleProvider'
import { semesterKey, semesterOptions, type SemesterRow } from '@/lib/semester'

type Props = { rows: readonly SemesterRow[]; value: string; onChange: (value: string) => void; termsOnly?: boolean }

export function SemesterFilter({ rows, value, onChange, termsOnly = false }: Props) {
  const uiText = useUIText()
  return <div className="mb-6 flex flex-wrap items-center gap-3 font-medium">
    <label htmlFor="archive-term"><T text="학기별 보기"/></label>
    <select id="archive-term" aria-label={uiText("학기별 보기")} className="min-h-11 max-w-full rounded-lg border bg-white px-4 py-2 text-base" value={value} onChange={event => onChange(event.target.value)}>
      <option value="all"><LocalizedText ko="전체보기" en="View all"/></option>
      {semesterOptions(rows).map(key => {
        const [year, semester] = key.split('-')
        return <option key={key} value={key}><LocalizedText ko={`${year}년 ${semester}학기`} en={`${year} · Semester ${semester}`}/></option>
      })}
      {!termsOnly&&rows.some(row => semesterKey(row) === 'unknown') && <option value="unknown"><T text="미분류"/></option>}
    </select>
  </div>
}
