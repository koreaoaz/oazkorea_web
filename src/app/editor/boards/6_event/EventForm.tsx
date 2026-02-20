"use client"

import { useState } from "react"
import { insertPost } from "../../services/board.service"
import { uploadImage } from "../../services/storage.service"
import { useMultiImageUpload } from "../../hooks/useImageUpload"
import { BOARD_TABLE_MAP } from "../../constants"
import { FormField } from "../../components/common/FormField"
import { textareaBase } from "../../utils/inputformClasses"

export function EventForm() {
  const [Title, setTitle] = useState("")
  const [Description, setDescription] = useState("")
  const image = useMultiImageUpload()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    let filenames: string[] = []

    try {
      filenames = await Promise.all(
        image.files.map((file) =>
          uploadImage("card_news", file)
        )
      )
    } catch (err) {
      console.error("이미지 업로드 실패:", err)
      alert("이미지 업로드 실패")
      return
    }

    await insertPost(BOARD_TABLE_MAP["행사"], {
      title: Title,
      description: Description,
      filenames: filenames.map((name, index) => ({
        filename: name,
        order: index,
      })),
      created_at: new Date().toISOString(),
    })

    setTitle("")
    setDescription("")
    image.reset()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <FormField>
        <input
          value={Title}
          placeholder="행사명"
          onChange={(e) => setTitle(e.target.value)}
          className={`w-full ${textareaBase}`}
        />
      </FormField>

      <FormField>
        <input
          value={Description}
          placeholder="행사 설명"
          onChange={(e) => setDescription(e.target.value)}
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
              multiple
              onChange={image.handleChange}
              className="hidden"
            />
          </div>
        </div>
      </FormField>

      {/* 🔍 미리보기 */}
      {image.previews.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {image.previews.map((src, i) => (
            <img
              key={i}
              src={src}
              className="w-full h-32 object-cover rounded border"
            />
          ))}
        </div>
      )}

      <button className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 transition-colors rounded">
        등록
      </button>
    </form>
  )
}
