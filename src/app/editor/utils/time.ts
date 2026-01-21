/**
 * "HH:MM" → 분 단위 숫자
 */
export function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number)
  return h * 60 + m
}

/**
 * 시작/종료 시간 유효성 체크
 */
export function isValidTimeRange(start: string, end: string): boolean {
  return timeToMinutes(end) > timeToMinutes(start)
}

/**
 * 30분 단위 시간 옵션 생성
 */
export function generateTimeOptions(
  startHour: number,
  endHour: number,
): string[] {
  const times: string[] = []

  for (let hour = startHour; hour <= endHour; hour++) {
    times.push(`${String(hour).padStart(2, "0")}:00`)
    if (hour !== endHour) {
      times.push(`${String(hour).padStart(2, "0")}:30`)
    }
  }

  return times
}
