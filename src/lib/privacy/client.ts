import { supabase } from '@/lib/supabaseClient';

import { PrivacyAccessError } from './errors';
import { PRIVACY_CAPABILITIES } from './policy';
export { privateEditorTable, privateReadOnly } from './policy'
export { PrivacyAccessError, privacyFailure } from './errors'
function ready() {
  let enabled = false
  try { enabled = process.env.NEXT_PUBLIC_OAZ_PRIVACY_V2 === 'true' } catch { /* deny by default */ }
  if (!enabled) throw new PrivacyAccessError('개인정보 보호 전환 준비 중입니다. 이 기능은 일시적으로 제한됩니다.')
}
function failure(error: unknown): never {
  const code = error && typeof error === 'object' && 'code' in error ? error.code : ''
  throw new PrivacyAccessError(code === '42501'
    ? '이 기능에 필요한 업무 권한이 승인되지 않았습니다. 개인정보 조회 또는 편집이 제한됩니다.'
    : code === '23505' ? '이미 승인 등록된 이메일입니다. 기존 개인정보 명단을 내려받지 않고 중복 요청을 중단했습니다.'
      : code === '40001' ? '변경 결과를 확인하지 못했습니다. 목록을 새로고침한 뒤 확인해 주세요.'
      : '개인정보 보호 기능이 준비되지 않았거나 요청을 완료하지 못했습니다. 기존 조회로 우회하지 않습니다.')
}
const fields: Record<string, readonly string[]> = {
  registered_member: ['id', 'name', 'department', 'generation'],
  allowed_user: ['id', 'name', 'email'], supervisor_id: ['id', 'name'], editor_5_donators: ['id', 'name', 'date'],
}
async function rpc(name: string, args: Record<string, unknown>) {
  let result
  try { result = await supabase.rpc(name, args) } catch { failure(null) }
  if (result.error) failure(result.error)
  return result.data
}
export async function privacyList(table: string): Promise<Array<Record<string, unknown> & { id: number }>> {
  ready()
  if (!fields[table]) failure(null)
  const data = await rpc('oaz_privacy_editor_list_v3', { board: table })
  if (!data || data.schemaVersion !== 3 || !Array.isArray(data.rows) || !Array.isArray(data.fields) ||
    data.fields.some((f: unknown) => typeof f !== 'string' || f === 'id' || !fields[table].includes(f)) ||
    new Set(data.fields).size !== data.fields.length || data.fields.length === 0) failure(null)
  for (const row of data.rows) {
    if (!row || typeof row !== 'object' || Array.isArray(row) || !Number.isSafeInteger(row.id) || row.id <= 0 ||
      Object.keys(row).some(k => !fields[table].includes(k)) ||
      Object.keys(row).length !== data.fields.length + 1 ||
      data.fields.some((k: string) => !Object.hasOwn(row, k)) ||
      Object.entries(row).some(([k, v]) => k !== 'id' && v !== null && typeof v !== 'string')) failure(null)
  }
  return data.rows
}
export async function publicDonorWrite(operation: 'create' | 'update' | 'delete', id: number | null, payload: unknown) {
  ready()
  if (!payload || typeof payload !== 'object' || Array.isArray(payload) || Object.keys(payload).some(k => k !== 'name')) failure(null)
  const data = await rpc('oaz_donor_write_v3', { operation, record_id: id, payload })
  if (!data || !Number.isSafeInteger(data.id) || data.id <= 0 || typeof data.name !== 'string' ||
    Object.keys(data).some(k => !['id', 'name'].includes(k))) failure(null)
  return data as { id: number; name: string }
}
export function denyPrivateMutation(): never {
  throw new PrivacyAccessError('개인정보 목록은 승인된 최소 항목의 조회 전용입니다. 변경 권한은 별도 승인 전까지 제한됩니다.')
}
export async function privacySession() {
  ready()
  const data = await rpc('oaz_privacy_session_v3', {})
  if (!data || data.schemaVersion !== 3 || !Array.isArray(data.capabilities) ||
    data.capabilities.some((c: unknown) => !PRIVACY_CAPABILITIES.some(v => v === c)) ||
    typeof data.donorWrite !== 'boolean' || typeof data.approvalWrite !== 'boolean') failure(null)
  return data as { schemaVersion: 3; capabilities: string[]; donorWrite: boolean; approvalWrite: boolean }
}
export async function addApproval(name: string, email: string) {
  ready()
  const data = await rpc('oaz_approval_add_v3', { approval_name: name.trim(), approval_email: email.trim() })
  if (!data || data.saved !== true || Object.keys(data).length !== 1) failure(null)
  return { saved: true as const }
}
