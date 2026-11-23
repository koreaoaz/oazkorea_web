export type EventImage = {
  order: number
  filename: string
}

// 표시 경계에서만 검증한다. 원본 JSONB와 배열 순서·order 값은 변경하지 않는다.
export function getEventImages(filenames: unknown): EventImage[] {
  let value: unknown = filenames
  if (typeof value === "string") {
    try { value = JSON.parse(value) } catch { return [] }
  }
  if (!Array.isArray(value)) return []
  return value.filter((item: unknown): item is EventImage =>
    item !== null && typeof item === "object" &&
    "filename" in item && typeof item.filename === "string" && item.filename.trim() !== "" &&
    "order" in item && typeof item.order === "number" && Number.isFinite(item.order))
}

export function getFirstImageFilename(filenames: unknown): string | null {
  return getEventImages(filenames)[0]?.filename ?? null
}
