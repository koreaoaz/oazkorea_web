"use client"

import { useEffect, useState } from "react"
import {
  SignupSetting,
  fetchSignupSetting,
  saveSignupSetting,
} from "@/lib/signupSetting"
import { useManagerRole } from "@/hooks/useManagerRole"
import { FormField } from "../../components/common/FormField"
import { textareaBase } from "../../utils/inputformClasses"

const toInputValue = (iso: string) => {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const formatRemaining = (ms: number) => {
  const total = Math.floor(ms / 1000)
  const days = Math.floor(total / 86400)
  const hours = Math.floor((total % 86400) / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${days}일 ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
}

export function SignupSettingForm() {
  const { isMainManager, isSubManager, loading: roleLoading } = useManagerRole()
  const canEdit = isMainManager || isSubManager

  const [setting, setSetting] = useState<SignupSetting | null>(null)
  const [deadlineInput, setDeadlineInput] = useState("")
  const [passwordInput, setPasswordInput] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [now, setNow] = useState(() => Date.now())

  const load = async () => {
    setLoading(true)
    const data = await fetchSignupSetting()
    setSetting(data)
    setDeadlineInput(data?.deadline ? toInputValue(data.deadline) : "")
    setPasswordInput(data?.password ?? "")
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!deadlineInput || !passwordInput.trim()) {
      alert("마감 시각과 비밀번호를 모두 입력해주세요.")
      return
    }

    setSaving(true)
    try {
      await saveSignupSetting(
        new Date(deadlineInput).toISOString(),
        passwordInput.trim(),
      )
      await load()
    } catch (err: any) {
      console.error("회원가입 설정 저장 실패:", err)
      alert("저장에 실패했습니다.")
    }
    setSaving(false)
  }

  if (loading || roleLoading) {
    return <div className="text-sm text-gray-500">불러오는 중...</div>
  }

  const deadlineMs = setting?.deadline ? new Date(setting.deadline).getTime() : null
  const remaining = deadlineMs === null ? null : deadlineMs - now
  const isOpen = remaining !== null && remaining > 0

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-lg border p-6 text-center">
          <div className="text-sm text-gray-500 mb-2">회원가입 마감까지</div>
          <div
            className={`text-3xl font-bold tabular-nums ${
              isOpen ? "text-blue-600" : "text-red-500"
            }`}
          >
            {remaining === null
              ? "미설정"
              : isOpen
                ? formatRemaining(remaining)
                : "마감"}
          </div>
          <div className="mt-2 text-sm text-gray-500">
            {setting?.deadline
              ? new Date(setting.deadline).toLocaleString("ko-KR")
              : "마감 시각이 설정되지 않았습니다."}
          </div>
        </div>

        <div className="rounded-lg border p-6 text-center">
          <div className="text-sm text-gray-500 mb-2">현재 회원가입 비밀번호</div>
          <div className="text-3xl font-bold font-mono break-all">
            {setting?.password || "미설정"}
          </div>
          <div className="mt-2 text-sm text-gray-500">
            {isOpen
              ? "이 비밀번호를 입력한 사람은 누구나 가입할 수 있습니다."
              : "마감 상태에서는 가입할 수 없습니다."}
          </div>
        </div>
      </div>

      {canEdit ? (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField>
              <input
                type="datetime-local"
                value={deadlineInput}
                onChange={(e) => setDeadlineInput(e.target.value)}
                className={`w-full ${textareaBase}`}
              />
            </FormField>

            <FormField>
              <input
                type="text"
                placeholder="회원가입 비밀번호"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                className={`w-full ${textareaBase}`}
              />
            </FormField>
          </div>

          <button
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:bg-gray-400"
          >
            {setting ? "변경" : "설정"}
          </button>
        </form>
      ) : (
        <div className="text-sm text-gray-500">
          마감 시각과 비밀번호는 메인 매니저 또는 서브 매니저만 변경할 수 있습니다.
        </div>
      )}
    </div>
  )
}
