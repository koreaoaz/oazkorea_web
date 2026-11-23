export const PRODUCTION_LOGIN_REDIRECT = "https://www.oazkorea.co.kr/login_callback"

// No implicit environment crossing. Callers must supply an explicitly verified origin.
export function loginRedirect(origin?: string, verifiedOrigins: readonly string[] = []) {
  if (!origin || !verifiedOrigins.includes(origin)) return null
  try {
    const parsed = new URL(origin)
    if (parsed.origin !== origin || parsed.username || parsed.password) return null
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname)
    if (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && local)) return null
    return `${parsed.origin}/login_callback`
  } catch { return null }
}
