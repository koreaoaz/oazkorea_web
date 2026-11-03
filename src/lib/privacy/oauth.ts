const production = 'https://www.oazkorea.co.kr'

/** Production stays fixed unless an exact test origin is explicitly configured. */
export function privacyOAuthRedirect(callback: 'login_callback' | 'oauth_callback', origin?: string) {
  let approved: string | undefined
  try { approved = process.env.NEXT_PUBLIC_OAZ_OAUTH_TEST_ORIGIN } catch { /* fixed production default */ }
  // The independent local harness must never fall back to a live website when
  // someone opens localhost or a different host instead of its exact origin.
  if (approved === 'http://127.0.0.1:3000' && origin !== approved) {
    throw new Error('LOCAL_OAUTH_ORIGIN_MISMATCH')
  }
  if (origin && approved === origin) {
    try {
      const url = new URL(origin)
      const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
      if (url.origin === origin && !url.username && !url.password &&
        (url.protocol === 'https:' || url.protocol === 'http:' && local)) return `${origin}/${callback}`
    } catch { /* invalid test configuration keeps production default */ }
  }
  return `${production}/${callback}`
}

/** Reject provider error callbacks without showing their untrusted description. */
export function hasOAuthCallbackError(location: { search: string; hash: string }): boolean {
  return [location.search, location.hash.replace(/^#/, '?')].some(part => {
    const params = new URLSearchParams(part);
    return ['error', 'error_code', 'error_description'].some(key => params.has(key));
  });
}
