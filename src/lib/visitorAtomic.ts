const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export type VisitorRpc = (requestId: string | null) => PromiseLike<{ data: unknown; error: unknown }>
export async function atomicVisitor(rpc: VisitorRpc, requestId: string | null) {
  if (requestId !== null && !uuid.test(requestId)) throw new Error('Invalid visit request')
  const { data, error } = await rpc(requestId)
  if (error || !data || typeof data !== 'object') throw new Error('Visit unavailable')
  const result = data as Record<string, unknown>
  if (!Number.isSafeInteger(result.count) || Number(result.count) < 0 || typeof result.date !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(result.date) || !Number.isFinite(Date.parse(result.date)) ||
    new Date(result.date).toISOString().slice(0,10) !== result.date) throw new Error('Invalid visit result')
  return { count: result.count as number, date: result.date }
}
