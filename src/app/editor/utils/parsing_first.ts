type ImageItem = {
  order: number
  filename: string
}

export function getFirstImageFilename(
  filenames: string | ImageItem[] | null
): string | null {
  if (!filenames) return null

  // 이미 배열이면 그대로 사용
  if (Array.isArray(filenames)) {
    return filenames[0]?.filename ?? null
  }

  // 문자열이면 JSON.parse
  try {
    const parsed = JSON.parse(filenames) as ImageItem[]
    return parsed[0]?.filename ?? null
  } catch (e) {
    console.error("filenames 파싱 실패:", filenames)
    return null
  }
}
