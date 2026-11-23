"use client"

import { createContext, useContext, useEffect, useRef, useState } from "react"
import type { FormEvent, ReactNode } from "react"
import { PrivacyAccessError, privacyFailure } from '@/lib/privacy/errors'

export const EditorMutationContext = createContext<(() => void | Promise<void>) | null>(null)

// Keep each form's payload/upload/reset logic; coordinate submissions at the UI boundary.
export function EditorForm({ onSubmit, children, className }: {
  onSubmit: (event: FormEvent<HTMLFormElement>) => void | false | Promise<void | false>
  children?: ReactNode
  className?: string
}) {
  const refresh = useContext(EditorMutationContext)
  const locked = useRef(false)
  const active = useRef(true)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => { active.current = true; return () => { active.current = false } }, [])

  return <form className={className} onSubmit={async (event) => {
    event.preventDefault()
    if (locked.current) return
    locked.current = true
    setPending(true)
    setError(null)
    try {
      if (await onSubmit(event) === false || !active.current) return
      try { await refresh?.() } catch {
        if (active.current) setError("저장은 완료됐지만 목록을 새로고침하지 못했습니다. 목록을 확인해 주세요.")
      }
    } catch (error: unknown) {
      const uploadFailed = !!error && typeof error === "object" && "name" in error && error.name === "UploadUnconfirmedError"
      if (active.current) setError(error instanceof PrivacyAccessError ? privacyFailure(error) : uploadFailed
        ? "이미지 업로드 결과를 확인하지 못했습니다. 일부 파일이 남아 있을 수 있어 자동 삭제하지 않았습니다. 파일 상태를 검토해 주세요."
        : "저장하지 못했습니다. 입력과 목록을 확인해 주세요. 업로드된 파일이 있다면 자동 삭제하지 않았으므로 참조 상태도 검토해 주세요.")
    } finally {
      locked.current = false
      if (active.current) setPending(false)
    }
  }}>
    {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    <fieldset disabled={pending} className="contents">{children}</fieldset>
  </form>
}
