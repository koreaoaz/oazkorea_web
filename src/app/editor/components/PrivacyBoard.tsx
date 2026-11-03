'use client'

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { privacyList, privacySession, publicDonorWrite, addApproval } from '@/lib/privacy/client';
import { privacyFailure } from '@/lib/privacy/errors';

export function PrivacyBoard({ table }: { table: string }) {
  const [rows, setRows] = useState<Array<Record<string, unknown> & { id: number }>>([])
  const [message, setMessage] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [editing, setEditing] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [writes, setWrites] = useState(false)
  const lock = useRef(false)
  const generation = useRef(0)
  const donor = table === 'editor_5_donators'
  const reload = useCallback(async () => {
    const request = ++generation.current
    setRows([]); setWrites(false); setMessage('')
    try {
      if (donor) {
        const result = await supabase.from('editor_5_donators').select('id,name').order('id')
        if (result.error) throw new Error('public donor read failed')
        if (request === generation.current) setRows(result.data ?? [])
      }
      const state = await privacySession()
      if (request === generation.current) setWrites(donor ? state.donorWrite : table === 'allowed_user' && state.approvalWrite)
      if (!donor) {
        const result = await privacyList(table)
        if (request === generation.current) setRows(result)
      }
    } catch (error) {
      if (request === generation.current) setMessage(privacyFailure(error))
    }
  }, [table, donor])
  useEffect(() => {
    let active = true
    const invalidate = () => { generation.current++ }
    void Promise.resolve().then(() => { if (active) return reload() })
    return () => { active = false; invalidate() }
  }, [reload])
  async function mutate(operation: 'create' | 'update' | 'delete', id: number | null) {
    if (lock.current || !writes) return
    lock.current = true; setBusy(true); setMessage('')
    const request = generation.current
    try {
      if (donor) await publicDonorWrite(operation, id, operation === 'delete' ? {} : { name: name.trim() })
      else if (operation === 'create' && table === 'allowed_user') await addApproval(name, email)
      else throw new Error('unsupported private operation')
      if (request === generation.current) {
        setName(''); setEmail(''); setEditing(null)
        await reload()
      }
    } catch (error) {
      if (request === generation.current) setMessage(privacyFailure(error))
    } finally {
      lock.current = false
      if (request === generation.current || request + 1 === generation.current) setBusy(false)
    }
  }
  const columns = rows.length ? Object.keys(rows[0]).filter(key => key !== 'id') : donor ? ['name'] : []
  return <section className="bg-white rounded-lg p-6 space-y-4">
    <p>개인정보는 승인된 최소 항목만 조회합니다. 후원자 공개 정보는 이름만 편집합니다.</p>
    {message && <p role="alert" className="text-red-600">{message}</p>}
    {writes && <form onSubmit={event => { event.preventDefault(); void mutate(editing === null ? 'create' : 'update', editing) }} className="flex gap-2">
      <input aria-label="이름" value={name} onChange={event => setName(event.target.value)} required maxLength={500} disabled={busy} />
      {!donor && <input aria-label="승인 이메일" type="email" value={email} onChange={event => setEmail(event.target.value)} required disabled={busy} />}
      <button disabled={busy || !name.trim()}>{busy ? '저장 중' : '저장'}</button>
      <button type="button" disabled={busy} onClick={() => { setEditing(null); setName(''); setEmail('') }}>취소</button>
    </form>}
    <button disabled={busy} onClick={() => void reload()}>목록 새로고침</button>
    <table><thead><tr>{columns.map(column => <th key={column}>{column}</th>)}</tr></thead>
      <tbody>{rows.map(row => <tr key={row.id}>{columns.map(column => <td key={column}>{String(row[column] ?? '')}</td>)}
        {donor && writes && <td><button disabled={busy} onClick={() => { setEditing(row.id); setName(String(row.name)) }}>수정</button>
          <button disabled={busy} onClick={() => { if (confirm('삭제하시겠습니까?')) void mutate('delete', row.id) }}>삭제</button></td>}
      </tr>)}</tbody></table>
  </section>
}
