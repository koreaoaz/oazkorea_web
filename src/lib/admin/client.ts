'use client'
import { supabase } from '@/lib/supabaseClient'
import type { AdminCommand } from './protocol'

export async function adminCommand(command: Omit<AdminCommand, 'requestId'> & { requestId?: string }) {
  const { data, error } = await supabase.auth.getSession()
  if (error || !data.session?.access_token) throw new Error('로그인이 필요하거나 세션이 만료되었습니다.')
  const response = await fetch('/api/admin', {
    method: 'POST', cache: 'no-store', credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session.access_token}` },
    body: JSON.stringify({ ...command, requestId: command.requestId ?? crypto.randomUUID() }),
  })
  const body = await response.json()
  if (!response.ok) {
    if (response.status === 409) throw new Error('다른 변경과 충돌했습니다. 목록을 새로고침하고 확인해 주세요.')
    if (response.status === 401) throw new Error('로그인이 만료되었습니다. 다시 로그인해 주세요.')
    if (response.status === 403) throw new Error('활성 관리자 권한 또는 추가 인증이 필요합니다.')
    throw new Error('관리자 서비스를 확인하지 못했습니다. 입력을 유지하고 다시 시도해 주세요.')
  }
  return body.result as unknown
}
