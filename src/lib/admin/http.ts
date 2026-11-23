import { adminConfiguration, parseAdminCommand, type AdminCommand } from './protocol'

export type AdminPort = {
  verify: (token: string) => Promise<boolean>
  execute: (command: AdminCommand) => Promise<{ data: unknown; code?: string }>
}
type PortFactory = (token: string) => AdminPort
const reply = (status: number, body: unknown) => Response.json(body, {
  status, headers: { 'Cache-Control': 'no-store', 'Vary': 'Authorization, Origin', 'X-Content-Type-Options': 'nosniff' },
})

/** No cookie auth: bearer token is verified remotely, and origin must match exact configuration.
 * Client user/role/AAL fields are not accepted. DB RPC rechecks auth.uid() and live assignments.
 */
export async function handleAdminRequest(request: Request, env: Readonly<Record<string, string | undefined>>, factory: PortFactory) {
  const config = adminConfiguration(env)
  if (!config) return reply(503, { error: 'ADMIN_NOT_READY' })
  if (request.method !== 'POST') return reply(405, { error: 'METHOD_NOT_ALLOWED' })
  if (request.headers.get('origin') !== config.origin) return reply(403, { error: 'ORIGIN_DENIED' })
  const auth = request.headers.get('authorization')
  if (!auth || !/^Bearer [A-Za-z0-9._-]{20,8192}$/.test(auth)) return reply(401, { error: 'AUTH_REQUIRED' })
  if (!(request.headers.get('content-type') ?? '').startsWith('application/json')) return reply(415, { error: 'JSON_REQUIRED' })
  try {
    const reader = request.body?.getReader()
    if (!reader) return reply(400, { error: 'INVALID_COMMAND' })
    let length = 0, text = ''
    const decoder = new TextDecoder()
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      length += value.byteLength
      if (length > 65536) { await reader.cancel(); return reply(413, { error: 'REQUEST_TOO_LARGE' }) }
      text += decoder.decode(value, { stream: true })
    }
    text += decoder.decode()
    let parsed: unknown
    try { parsed=JSON.parse(text) } catch { return reply(400,{error:'INVALID_COMMAND'}) }
    const command = parseAdminCommand(parsed)
    if (!command) return reply(400, { error: 'INVALID_COMMAND' })
    const port = factory(auth.slice(7))
    if (!await port.verify(auth.slice(7))) return reply(401, { error: 'AUTH_EXPIRED' })
    const result = await port.execute(command)
    if (result.code) {
      const status = result.code === '42501' ? 403 : ['40001', 'PT409', '23505'].includes(result.code) ? 409 : ['22023','22007','22008','22P02','23514','23502'].includes(result.code) ? 400 : 503
      return reply(status, { error: status === 403 ? 'FORBIDDEN' : status === 409 ? 'CONFLICT' : status===400?'INVALID_INPUT':'ADMIN_UNAVAILABLE' })
    }
    return reply(200, { result: result.data })
  } catch { return reply(503, { error: 'ADMIN_UNAVAILABLE' }) }
}
