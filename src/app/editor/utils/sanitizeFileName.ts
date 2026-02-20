export function sanitizeFileName(originalName: string): string {
  const lastDotIndex = originalName.lastIndexOf(".")
  const name =
    lastDotIndex > 0 ? originalName.slice(0, lastDotIndex) : originalName
  const extension =
    lastDotIndex > 0 ? originalName.slice(lastDotIndex) : ""

  const sanitized = name
    .replace(/[^\w\-_.]/g, "_")
    .replace(/\s+/g, "_")
    .replace(/_{2,}/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase()

  const timestamp = Date.now()
  const random = Math.random().toString(36).slice(2, 8)

  return `${timestamp}_${random}_${sanitized}${extension}`
}
