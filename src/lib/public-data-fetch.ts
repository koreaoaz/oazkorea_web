import {PUBLIC_DATA_COLUMNS,PUBLIC_DATA_PREFIX} from './public-data-contract'
import {offlinePreviewResponse} from './offline-preview'

/** Browser public reads use this website's origin; Auth/admin requests are untouched. */
export function publicDataFetch(upstream: string, transport: typeof fetch = fetch): typeof fetch {
  return async (input, init) => {
    if(process.env.NEXT_PUBLIC_OAZ_PREVIEW_MODE==='offline-v1')return offlinePreviewResponse()
    const request = input instanceof Request ? input : null
    const url = new URL(request?.url ?? String(input))
    const method = (init?.method ?? request?.method ?? 'GET').toUpperCase()
    const table = url.pathname.replace(/^\/rest\/v1\//,'')
    if (typeof window === 'undefined' || url.origin !== new URL(upstream).origin ||
        !url.pathname.startsWith('/rest/v1/') || !Object.hasOwn(PUBLIC_DATA_COLUMNS,table) || !['GET','HEAD'].includes(method)) {
      return transport(input,init)
    }
    const original = new Headers(init?.headers ?? request?.headers)
    const headers = new Headers()
    if (['editor_3_study_timetable','editor_1_projects','editor_2_studies'].includes(table) && typeof document!=='undefined' && document.documentElement.lang==='en') headers.set('x-oaz-public-language','en')
    for (const name of ['accept','prefer','range','range-unit']) {
      const value = original.get(name); if (value) headers.set(name,value)
    }
    // Do not send the Supabase token, apikey or admin cookies to the public endpoint.
    return transport(PUBLIC_DATA_PREFIX+table+url.search, {
      method,headers,credentials:'omit',cache:'no-store',redirect:'error',
      signal:init?.signal ?? request?.signal,
    })
  }
}
