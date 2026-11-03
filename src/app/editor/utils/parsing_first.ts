export function getFirstImageFilename(filenames: unknown): string | null {
  try {
    const parsed: unknown = typeof filenames === "string" ? JSON.parse(filenames) : filenames
    if (!Array.isArray(parsed)) return null
    const first: unknown = parsed[0]
    return first !== null && typeof first === "object" && "filename" in first && typeof first.filename === "string" ? first.filename : null
  } catch { return null }
}
