export type SemesterRow = { year?: unknown; semester?: unknown }

export function isActivityYear(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1900 && value <= 9999
}

export function isActivitySemester(value: unknown): value is 1 | 2 {
  return value === 1 || value === 2
}

export function activityTermLabel({year, semester}: SemesterRow, english: boolean) {
  if (!isActivityYear(year)) return ''
  if (!isActivitySemester(semester)) return english ? String(year) : `${year}년`
  return english ? `${semester === 1 ? 'Spring' : 'Fall'} ${year}` : `${year}년 ${semester}학기`
}

export function compareProjectTerms(a: SemesterRow, b: SemesterRow) {
  const rank = (row: SemesterRow) => isActivityYear(row.year)
    ? row.year * 3 + (isActivitySemester(row.semester) ? row.semester : 0) : 0
  return rank(b) - rank(a)
}

function termRank({ year, semester }: SemesterRow) {
  return isActivityYear(year) && isActivitySemester(semester) ? year * 2 + semester : 0
}

export function semesterKey(row: SemesterRow) {
  return termRank(row) ? `${row.year}-${row.semester}` : 'unknown'
}

export function semesterOptions(rows: readonly SemesterRow[]) {
  const terms = new Map(rows.map(row => [termRank(row), semesterKey(row)]))
  terms.delete(0)
  return [...terms.entries()].sort(([a], [b]) => b - a).map(([, key]) => key)
}

export function filterSemester<T extends SemesterRow>(rows: readonly T[], selected: string): T[] {
  return rows.filter(row =>
    selected === 'all' || semesterKey(row) === selected ||
    (isActivityYear(row.year) && selected === `year-${row.year}`) ||
    (isActivitySemester(row.semester) && selected === `semester-${row.semester}`)
  )
}

type DatedStudy = SemesterRow & { id: number; created_at: string | null }

function registrationTime(row: DatedStudy) {
  const time = Date.parse(row.created_at ?? '')
  return Number.isFinite(time) ? time : Number.NEGATIVE_INFINITY
}

export function compareStudyTerms(a: DatedStudy, b: DatedStudy) {
  return termRank(b) - termRank(a) || registrationTime(b) - registrationTime(a) || b.id - a.id
}
