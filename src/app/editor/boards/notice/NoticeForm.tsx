"use client"

import { useState } from "react"
import { insertPost } from "../../services/board.service"
import { BOARD_TABLE_MAP } from "../../constants"
import { FormField } from "../../components/common/FormField"
import { textareaBase } from "../../utils/inputformClasses"

export function NoticeForm() {
  const [title, setTitle] = useState("")
  const [body, setBody] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    await insertPost(BOARD_TABLE_MAP["공지"], {
      text: title,
      description: body,
      created_at: new Date().toISOString(),
    })

    setTitle("")
    setBody("")
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <FormField>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="공지사항 제목을 입력하세요"
          className={`w-full ${textareaBase}`}
        />
      </FormField>

      <FormField>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="공지 내용을 입력하세요"
          className={`w-full min-h-32 ${textareaBase}`}
        />
      </FormField>

      <button
        disabled={loading}
        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:bg-gray-400"
      >
        등록
      </button>
    </form>
  )
}
