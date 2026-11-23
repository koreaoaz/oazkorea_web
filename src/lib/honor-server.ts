import { parsePublicHonor } from './honor'

type Environment = Readonly<Record<string, string | undefined>>
const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }

/** 로그인 쿠키/사용자 토큰/service_role을 전달하지 않는 공개 전용 조회. */
export async function handlePublicHonor(env: Environment, request: typeof fetch = fetch) {
  let reason = 'CONFIGURATION'
  try {
    const url = env.NEXT_PUBLIC_SUPABASE_URL
    const key = env.NEXT_PUBLIC_SUPABASE_KEY
    if (!url || !key) throw new Error()
    const base = new URL(url)
    if (base.username || base.password || base.search || base.hash || base.pathname !== '/' ||
      (base.protocol !== 'https:' && !(base.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(base.hostname)))) throw new Error()
    reason = 'UPSTREAM_UNAVAILABLE'
    const localPair=env.OAZ_ADMIN_VERIFY_STACK==='true'?['http://127.0.0.1:3302','http://127.0.0.1:55494']:['http://127.0.0.1:3301','http://127.0.0.1:55491']
    const local=env.OAZ_LOCAL_ADMIN_DEV==='true'&&env.OAZ_ADMIN_ORIGIN===localPair[0]&&url===localPair[1]
    const response = await request(new URL(local?'/rest/v1/rpc/oaz_local_public_honor_v1':'/rest/v1/rpc/oaz_public_honor_v1', base), {
      method: 'POST', headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: '{}', cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(local?25000:8000),
    })
    if (!response.ok) {
      reason = `UPSTREAM_HTTP_${response.status}`
      // 오류 본문에는 테이블/개인정보가 있을 수 있으므로 읽거나 출력하지 않는다.
      await response.body?.cancel()
      throw new Error()
    }
    reason = 'INVALID_PUBLIC_RESPONSE'
    const result=await response.json()
    const approved=parsePublicHonor(local?result.approved:result)
    // 명시적으로 설정된 격리 로컬 쌍에서만 별도 Fixture 투영을 조회한다.
    // 기존 승인 RPC·RLS·관리자 감사는 변경하지 않는다.
    if(local){
        const prepared=parsePublicHonor(result.fixture)
        if(prepared.length>8||prepared.some(row=>!row.display_name.startsWith('[가상] ')))throw new Error()
        const extra=prepared.filter(row=>!approved.some(a=>a.display_name===row.display_name))
        if(extra.length)return Response.json({entries:[...approved,...extra],fixture:{kind:'LOCAL_FIXTURE_NOT_ADMIN_APPROVAL',count:extra.length}},{headers})
    }
    return Response.json({ entries: approved }, { headers })
  } catch {
    // 개발 로그에는 고정 분류/HTTP 상태만 남긴다. URL·키·이름·DB 오류 원문 금지.
    if (env.NODE_ENV === 'development') console.warn('[honor] 공개 조회 실패:', reason)
    return Response.json({ error: 'HONOR_UNAVAILABLE' }, { status: 503, headers })
  }
}
