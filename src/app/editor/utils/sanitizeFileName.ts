export function sanitizeFileName(originalName: string): string {
  // Keep paths flat and omit original names, which may contain personal information.
  const extension = originalName.match(/\.([a-zA-Z0-9]{1,10})$/)?.[1].toLowerCase()
  return `${crypto.randomUUID()}${extension ? `.${extension}` : ""}`
}
