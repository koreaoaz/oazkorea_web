"use client"

import { useState } from "react"
import { insertPost } from "../../services/board.service"
import { BOARD_TABLE_MAP } from "../../constants"
import { FormField } from "../../components/common/FormField"
import { textareaBase } from "../../utils/inputformClasses"

export function HonorForm() {
  const [name, setName] = useState("")
  const [date, setDate] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    await insertPost(BOARD_TABLE_MAP["명예의 전당"], {
      name,
      date,
      created_at: new Date().toISOString(),
    })

    setName("")
    setDate("")
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <FormField >
        <input 
          value={name} 
          placeholder="기부자 성함"
          onChange={(e) => setName(e.target.value)}
          className={`w-full ${textareaBase}`} 
        />
      </FormField>

      <FormField>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className={`w-full ${textareaBase}`} 
        />
      </FormField>

      <button className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 transition-colors rounded">
        등록
      </button>
    </form>
  )
}
