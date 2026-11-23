export interface RawTimetableRow {
  // JSON 숫자로 전달된 bigint는 number로 파싱되며, 큰 값의 정밀도는 보장되지 않는다.
  id: number
  leader: string | null
  color: string | null
  start_time: string | null
  end_time: string | null
  created_at: string | null
  study_name: string | null
}
