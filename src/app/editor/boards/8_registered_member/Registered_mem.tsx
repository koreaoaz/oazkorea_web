"use client"

import { useState } from "react"
import { insertPost } from "../../services/board.service"
import { BOARD_TABLE_MAP } from "../../constants"
import { generateTimeOptions, isValidTimeRange } from "../../utils/time"
import { FormField } from "../../components/common/FormField"
import { inputBase } from "../../utils/inputformClasses"

const DAYS = ["월요일", "화요일", "수요일", "목요일", "금요일"]

export function TimetableForm() {
  const [day, setDay] = useState("")
  const [start, setStart] = useState("")
  const [end, setEnd] = useState("")
  const [name, setName] = useState("")
  const [leader, setLeader] = useState("")
  const [studyColor, setStudyColor] = useState("#00ff00")

  const times = generateTimeOptions(11, 22)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!day || !start || !end || !name || !leader) {
      alert("필수 항목을 모두 입력해주세요.")
      return
    }

    if (!isValidTimeRange(start, end)) {
      alert("시간 범위 오류")
      return
    }

    await insertPost(BOARD_TABLE_MAP["학회실 사용 시간표"], {
      study_name: name,
      leader,
      start_time: `${day} ${start}`,
      end_time: `${day} ${end}`,
      color: studyColor,
      created_at: new Date().toISOString(),
    })

    setDay("")
    setStart("")
    setEnd("")
    setName("")
    setLeader("")
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* 요일 + 시간 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField>
          <select
            value={day}
            onChange={(e) => setDay(e.target.value)}
            className={`w-full ${inputBase}`}
            required
          >
            {/* <option value="" disabled>
              요일 선택
            </option> */}
            {DAYS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </FormField>

        <FormField>
          <div className="flex gap-4">
            <select
              value={start}
              onChange={(e) => setStart(e.target.value)}
              className={`w-full ${inputBase}`}
              required
            >
              <option value="" disabled>
                시작 시간
              </option>
              {times.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>

            <select
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              className={`w-full ${inputBase}`}
              required
            >
              <option value="" disabled>
                종료 시간
              </option>
              {times.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        </FormField>
      </div>

      {/* 스터디명 */}
      <FormField>
        <input
          type="text"
          placeholder="스터디명"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={`w-full ${inputBase}`}
          required
        />
      </FormField>

      {/* 스터디장 */}
      <FormField>
        <input
          type="text"
          placeholder="스터디장"
          value={leader}
          onChange={(e) => setLeader(e.target.value)}
          className={`w-full ${inputBase}`}
          required
        />
      </FormField>
      
      {/* 색상 선택 */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">
          색상 선택
        </label>

        <div className="flex items-center gap-4">
          <input
            type="color"
            value={studyColor}
            onChange={(e) => setStudyColor(e.target.value)}
            className="w-16 h-10 border border-gray-300 rounded-md cursor-pointer"
          />

          <span className="text-sm text-gray-600">
            {studyColor}
          </span>
        </div>
      </div>

      {/* 제출 버튼 */}
       <button className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 transition-colors rounded">
        등록
      </button>
    </form>
  )
}
