export type ConfigIssue = { code: string; severity: "error" | "warning" }

// Pure validator, enforced by the public client and build/runtime configuration guards.
// Never return supplied URLs, keys, decoded payloads, or parser exceptions.
export function inspectSupabaseConfig(url?: string, key?: string, expectedOrigin?: string): ConfigIssue[] {
  const issues: ConfigIssue[] = []
  let parsed: URL | undefined
  if (!url) issues.push({ code: "missing_url", severity: "error" })
  else {
    try {
      parsed = new URL(url)
      const local = ["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname)
      if (url !== url.trim() || parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== "/" ||
        (parsed.protocol !== "https:" && !(local && parsed.protocol === "http:"))) throw new Error()
      if (local) issues.push({ code: "local_target", severity: "warning" })
    } catch { parsed = undefined; issues.push({ code: "invalid_url", severity: "error" }) }
  }
  if (expectedOrigin) {
    try {
      const expected = new URL(expectedOrigin)
      if (expected.origin !== expectedOrigin) throw new Error()
      if (parsed && parsed.origin !== expected.origin) issues.push({ code: "target_mismatch", severity: "error" })
    } catch { issues.push({ code: "invalid_expected_origin", severity: "error" }) }
  } else issues.push({ code: "target_not_verified", severity: "warning" })
  if (!key) issues.push({ code: "missing_public_key", severity: "error" })
  else if (key !== key.trim() || key.startsWith("sb_secret_")) issues.push({ code: "unsafe_public_key", severity: "error" })
  else if (/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)) {
    issues.push({ code: "publishable_key_project_requires_confirmation", severity: "warning" })
  } else {
    try {
      if (!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(key)) throw new Error()
      const payload = JSON.parse(atob(key.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")))
      if (payload.role !== "anon") throw new Error()
      const ref = parsed?.hostname.match(/^([a-z0-9]+)\.supabase\.co$/)?.[1]
      if (ref && payload.ref !== ref) issues.push({ code: "key_project_mismatch", severity: "error" })
      issues.push({ code: "legacy_key_signature_not_verified", severity: "warning" })
    } catch { issues.push({ code: "invalid_public_key", severity: "error" }) }
  }
  return issues
}
