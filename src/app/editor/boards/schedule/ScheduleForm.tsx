"use client"

import { useState } from "react"
import { insertPost } from "../../services/board.service"
import { BOARD_TABLE_MAP } from "../../constants"
import { FormField } from "../../components/common/FormField"
import { textareaBase } from "../../utils/inputformClasses"

export function ScheduleForm() {
  const [desc, setDesc] = useState("")
  const [start, setStart] = useState("")
  const [end, setEnd] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    await insertPost(BOARD_TABLE_MAP["일정"], {
      description: desc,
      start_date: start,
      end_date: end,
      created_at: new Date().toISOString(),
    })

    setDesc("")
    setStart("")
    setEnd("")
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <FormField >
        <input
          value={desc} 
          placeholder="일정 설명"
          onChange={(e) => setDesc(e.target.value)} 
          className={`w-full ${textareaBase}`} 
          />
      </FormField>

      <FormField>
        <input 
          type="date" 
          value={start} 
          onChange={(e) => setStart(e.target.value)}
          className={`w-full ${textareaBase}`} 
        />
      </FormField>

      <FormField>
        <input
          type="date" 
          value={end} 
          onChange={(e) => setEnd(e.target.value)}
          className={`w-full ${textareaBase}`} 
        />
      </FormField>

      <button className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 transition-colors rounded">
        등록
      </button>
    </form>
  )
}
