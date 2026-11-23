"use client"

import { useState } from "react"
import { EditorForm } from "../../components/common/EditorForm"
import { insertPost } from "../../services/board.service"
import { BOARD_TABLE_MAP } from "../../constants"
import { FormField } from "../../components/common/FormField"
import { textareaBase } from "../../utils/inputformClasses"

export function HonorForm() {
  const [name, setName] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    await insertPost(BOARD_TABLE_MAP["명예의 전당"], {
      name,
    })

    setName("")
  }

  return (
    <EditorForm onSubmit={handleSubmit} className="space-y-4">
      <FormField >
        <input
          value={name}
          placeholder="기부자 성함"
          onChange={(e) => setName(e.target.value)}
          className={`w-full ${textareaBase}`}
        />
      </FormField>

      <p className="text-sm text-gray-600">공개 후원자 이름만 등록합니다. 비공개 일자·회원 식별정보는 조회하거나 변경하지 않습니다.</p>

      <button className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 transition-colors rounded">
        등록
      </button>
    </EditorForm>
  )
}
