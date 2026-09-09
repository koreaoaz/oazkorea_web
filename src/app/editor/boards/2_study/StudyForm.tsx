"use client"

import { useState } from "react"
import { insertPost } from "../../services/board.service"
import { uploadImage } from "../../services/storage.service"
import { useImageUpload } from "../../hooks/useImageUpload"
import { BOARD_TABLE_MAP } from "../../constants"
import { FormField } from "../../components/common/FormField"
import { textareaBase } from "../../utils/inputformClasses"

export function StudyForm() {
  const [name, setName] = useState("")
  const [leader, setLeader] = useState("")
  const [outline, setOutline] = useState("")
  const currentYear = new Date().getFullYear()
  const yearOptions = Array.from({ length: 10 }, (_, i) => currentYear - i)
  const [year, setYear] = useState<number>(currentYear)
  const [semester, setSemester] = useState<1 | 2>(1)
  const image = useImageUpload()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    let filename: string | null = null
    if (image.file) {
      filename = await uploadImage("study-images", image.file)
    }

    await insertPost(BOARD_TABLE_MAP["스터디"], {
      study_name: name,
      leader,
      outline,
      year,
      semester,
      filename,
      created_at: new Date().toISOString(),
    })

    setName("")
    setLeader("")
    setOutline("")
    setYear(currentYear)
    setSemester(1)
    image.reset()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <FormField>
          <input
            value={name}
            placeholder="스터디명"
            onChange={(e) => setName(e.target.value)}
            className={`w-full ${textareaBase}`}
          />
        </FormField>

        <FormField>
          <input
            value={leader}
            placeholder="스터디장"
            onChange={(e) => setLeader(e.target.value)}
            className={`w-full ${textareaBase}`}
          />
        </FormField>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <FormField>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className={`w-full ${textareaBase}`}
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </FormField>

        <FormField>
          <select
            value={semester}
            onChange={(e) => setSemester(Number(e.target.value) as 1 | 2)}
            className={`w-full ${textareaBase}`}
          >
            <option value={1}>1학기</option>
            <option value={2}>2학기</option>
          </select>
        </FormField>
      </div>

      <FormField>
        <textarea
          value={outline}
          placeholder="스터디 설명"
          onChange={(e) => setOutline(e.target.value)}
          className={`w-full ${textareaBase}`}
        />
      </FormField>

      <FormField>
        <div className="space-y-3">
          <div className="flex items-center gap-4">
            <label htmlFor="project-image" className="cursor-pointer">
              <div className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors">
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                  />
                </svg>
                <span className="text-sm font-medium">이미지 선택</span>
              </div>
            </label>

            <input
              id="project-image"
              type="file"
              accept="image/*"
              onChange={image.handleChange}
              className="hidden"
            />

            {image.file && (
              <span className="text-sm text-gray-600">{image.file.name}</span>
            )}
          </div>

          {image.preview && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">미리보기:</span>
              <img
                src={image.preview || "/placeholder.svg"}
                alt="미리보기"
                className="w-20 h-20 object-cover rounded-md border"
              />
              <button
                type="button"
                onClick={image.reset}
                className="ml-2 px-3 py-1 bg-red-600 text-white text-sm rounded-md hover:bg-red-700 transition-colors"
              >
                삭제
              </button>
            </div>
          )}
        </div>
      </FormField>

      <button className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 transition-colors rounded">
        등록
      </button>
    </form>
  )
}
