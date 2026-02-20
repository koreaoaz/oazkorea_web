"use client"

import { useState } from "react"
import { insertPost } from "../../services/board.service"
import { BOARD_TABLE_MAP } from "../../constants"
import { FormField } from "../../components/common/FormField"
import { textareaBase } from "../../utils/inputformClasses"

export function Registered_mem_Form() {
  const [name, setName] = useState("")
  const [department, setDepartment] = useState("")
  const [student_id, setStudent_id] = useState("")
  const [gen, setGen] = useState("")
  const [uuid, setUuid] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    await insertPost(BOARD_TABLE_MAP["등록회원"], {
      name,
      department,
      student_id,
      gen,
      uuid,
      email,
      phone,
      created_at: new Date().toISOString(),
    })

    setName("")
    setDepartment("")
    setStudent_id("")
    setGen("")
    setUuid("")
    setEmail("")
    setPhone("")
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
    </form>
  )
}
