"use client"

import { useState, useMemo } from "react"
import { insertPost } from "../../services/board.service"
import { BOARD_TABLE_MAP } from "../../constants"
import { FormField } from "../../components/common/FormField"
import { textareaBase } from "../../utils/inputformClasses"
import { supabase } from "@/lib/supabaseClient"

type AllowedUserRow = {
  id: number
  name: string
  email: string
}

export function Allowed_user({
  onSuccess,
}: {
  onSuccess?: (newRow: AllowedUserRow) => void
}) {
  const [title, setName] = useState("")
  const [body, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState("") //  에러 상태 추가

  const isFormValid = title.trim() !== "" && body.trim() !== ""

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg("")

    if (!isFormValid) {
      setErrorMsg("이름과 이메일을 모두 입력해주세요.")
      return
    }

    setLoading(true)

    try {
      const trimmedName = title.trim()
      const trimmedEmail = body.trim()

      // 기존 데이터와 동일한 이름 + 이메일 있는지 확인
      const { data: existing } = await supabase
        .from(BOARD_TABLE_MAP["승인email"])
        .select("id")
        .eq("email", trimmedEmail)
        .maybeSingle()

      if (existing) {
        setErrorMsg("이미 등록된 계정입니다.")
        alert("이미 등록된 계정입니다.")
        setLoading(false)
        return
      }

      const newRow = await insertPost(BOARD_TABLE_MAP["승인email"], {
        name: trimmedName,
        email: trimmedEmail,
      })

      setName("")
      setEmail("")
      onSuccess?.(newRow)
    } catch (err: any) {
      console.error(err)
      setErrorMsg("등록에 실패했습니다.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <FormField>
        <input
          value={title}
          onChange={(e) => setName(e.target.value)}
          placeholder="승인할 회원의 이름을 입력하세요"
          className={`w-full ${textareaBase} ${
            errorMsg ? "border-red-500" : ""
          }`}
        />
      </FormField>

      <FormField>
        <input
          value={body}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="회원가입을 승인할 이메일 주소를 입력하세요"
          className={`w-full ${textareaBase} ${
            errorMsg ? "border-red-500" : ""
          }`}
        />
      </FormField>

      {errorMsg && (
        <p className="text-sm text-red-600 font-medium">
          {errorMsg}
        </p>
      )}

      <button
        type="submit"
        disabled={loading || !isFormValid}
        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:bg-gray-400"
      >
        추가
      </button>
    </form>
  )
}