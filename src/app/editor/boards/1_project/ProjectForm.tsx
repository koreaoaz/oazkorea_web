"use client"

import { useState } from "react"
import { insertPost } from "../../services/board.service"
import { uploadImage } from "../../services/storage.service"
import { useImageUpload } from "../../hooks/useImageUpload"
import { BOARD_TABLE_MAP, CategoryKey } from "../../constants"
import { CategorySelect } from "../../components/common/CategorySelect"
import { FormField } from "../../components/common/FormField"
import { textareaBase } from "../../utils/inputformClasses"

export function ProjectForm({onSuccess,}: {onSuccess?: (post: any) => void}) {
  // 기존 폼에서 받던 것들 전부 복원
  const [title, setTitle] = useState("") // 프로젝트명
  const [duration, setDuration] = useState("") // 기간
  const [category, setCategory] = useState<CategoryKey | "">("")
  const [semester, setSemester] = useState("") // 학기
  const [teamSize, setTeamSize] = useState<number | null>(null) // 팀 규모
  const [members, setMembers] = useState("") // 팀원(쉼표)
  const [body, setBody] = useState("") // 간단 설명
  const [detailedDescription, setDetailedDescription] = useState("") // 상세 설명
  const [techStack, setTechStack] = useState("") // 기술스택(쉼표)

  const image = useImageUpload()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    let filename: string | null = null
    if (image.file) {
      filename = await uploadImage("project_img", image.file)
    }

    // members/techStack는 문자열로 저장하거나, 서버에서 split 하도록 둘 수 있음
    // 여기서는 "입력 그대로(문자열)" 저장 + 필요하면 파싱해서 함께 저장하는 예시를 포함
    const membersList =
      members
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean) || []

    const techStackList =
      techStack
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean) || []

    const newPost = await insertPost(BOARD_TABLE_MAP["프로젝트"], {
      // PostList에서 우선순위로 표시하는 project_name을 채움
      project_name: title,

      // PostList에서 description을 보여주니, "간단 설명"을 description으로 매핑
      // (원하면 body 대신 detailedDescription을 description으로 넣어도 됨)
      description: body,

      // 나머지 필드들도 함께 저장 (테이블 스키마에 맞게 키 이름 수정 필요할 수 있음)
      duration,
      category,
      semester,
      team_size: teamSize, // 혹시 컬럼명이 teamSize면 teamSize로 바꿔줘
      members: membersList, // 문자열로 저장하려면 members 그대로 넣기
      detailed_description: detailedDescription,
      tech_stack: techStackList, // 문자열 저장이면 techStack 그대로
      filename,

      created_at: new Date().toISOString(),
    })

    // 초기화
    setTitle("")
    setDuration("")
    setCategory("")
    setSemester("")
    setTeamSize(null)
    setMembers("")
    setBody("")
    setDetailedDescription("")
    setTechStack("")
    image.reset()
    onSuccess?.(newPost)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <FormField>
        <input
          type="text"
          placeholder="프로젝트명"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className={`w-full ${textareaBase}`}
        />
      </FormField>

      <div className="grid grid-cols-2 gap-4">
        <FormField >
          <input
            type="text"
            placeholder="기간"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            className={`w-full ${textareaBase}`}
          />
        </FormField>

        <FormField >
          <CategorySelect value={category} onChange={setCategory} label="" />
        </FormField>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <FormField >
          <input
            type="text"
            placeholder="학기 (예: 2024-2)"
            value={semester}
            onChange={(e) => setSemester(e.target.value)}
            className={`w-full ${textareaBase}`}
          />
        </FormField>

        <FormField >
          <input
            type="number"
            placeholder="팀 규모"
            value={teamSize ?? ""}
            onChange={(e) => {
              const v = e.target.value
              setTeamSize(v === "" ? null : Number(v))
            }}
            className={`w-full ${textareaBase}`}
          />
        </FormField>
      </div>

      <FormField>
        <input
          type="text"
          placeholder="팀원 (쉼표 구분)"
          value={members}
          onChange={(e) => setMembers(e.target.value)}
          className={`w-full ${textareaBase}`}
        />
      </FormField>

      <FormField>
        <textarea
          placeholder="간단 설명"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className={`w-full ${textareaBase}`}
        />
      </FormField>

      <FormField>
        <textarea
          placeholder="상세 설명"
          value={detailedDescription}
          onChange={(e) => setDetailedDescription(e.target.value)}
          className={`w-full ${textareaBase}`}
        />
      </FormField>

      <FormField>
        <input
          type="text"
          placeholder="기술스택 (쉼표로 구분)"
          value={techStack}
          onChange={(e) => setTechStack(e.target.value)}
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
