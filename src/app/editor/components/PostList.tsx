"use client"

import {AdminSessionLoading} from '@/components/AdminSessionLoading'
import { useEffect, useRef, useState } from "react"
import { BoardType, BoardRow, BOARD_TABLE_MAP } from "../constants"
import type { EditorTable, EditorTextFields, EditorTextKey } from "@/types/editor"
import { useDragAndDrop } from "../hooks/useDragAndDrop"
import { persistOrder } from "../services/order.service"
import { deletePost, fetchPosts, updatePost} from "../services/board.service"
import { ImageFromStorage } from "./ImageFromStorage"
import { cx } from "../utils/cx"
import { getFirstImageFilename } from "../utils/parsing_first"
import * as XLSX from "xlsx"
import { privateReadOnly } from '@/lib/privacy/policy'
import { PrivacyAccessError, privacyFailure } from '@/lib/privacy/errors'

type Props<B extends BoardType> = {
  board: B
  posts: BoardRow<B>[]
  loading: boolean
  reload: () => void | Promise<void>
  setPosts: React.Dispatch<React.SetStateAction<BoardRow<B>[]>>
}

const BOARD_COLUMNS = {
    "공지": [
      { label: "내용", field: "text" },
      { label: "설명", field: "description" },
    ],
    "프로젝트": [
      { label: "프로젝트명", field: "project_name" },
      { label: "설명", field: "description" },
    ],
    "스터디": [
      { label: "스터디명", field: "study_name" },
      { label: "개요", field: "outline" },
    ],
    "행사": [
      { label: "제목", field: "title" },
      { label: "설명", field: "description" },
    ],
    "일정": [
      { label: "설명", field: "description" },
      { label: "시작일", field: "start_date" },
      { label: "종료일", field: "end_date" },
    ],
    "학회실 사용 시간표": [
      { label: "스터디명", field: "study_name" },
      { label: "리더", field: "leader" },
      { label: "시작시간", field: "start_time" },
      { label: "종료시간", field: "end_time" },
    ],
    "명예의 전당": [
      { label: "이름", field: "name" },
    ],
    "등록회원": [
      { label: "이름", field: "name" },
      { label: "학과", field: "department" },
      { label: "기수", field: "generation" },
    ],
    "승인email":[
      { label: "이름", field: "name" },
      { label: "이메일", field: "email" }
    ],
    "관리자id":[
      { label: "이름", field: "name" },
    ]
  } as const satisfies {
    [B in BoardType]: readonly { label: string; field: EditorTextKey<BoardRow<B>> }[]
  }

export function PostList<B extends BoardType>({ board, posts, setPosts, reload, loading }: Props<B>) {
  const readOnly = privateReadOnly(BOARD_TABLE_MAP[board])
  const drag = useDragAndDrop({
    enabled: false,
    items: posts,
    onReorder: async (newPosts) => {
      await persistOrder(BOARD_TABLE_MAP[board], newPosts)
      setPosts(newPosts)
    },
  })


  const [editingCell, setEditingCell] = useState<{
    id: number
    field: PropertyKey
    revision?: number
  } | null>(null)

  const handleExcelDownload = async () => {
    try {
    const data = await fetchPosts(BOARD_TABLE_MAP[board])

    const formatted = data.map((row: EditorTextFields) => {
      const obj: Record<string, unknown> = {}
      BOARD_COLUMNS[board].forEach((col) => {
        obj[col.label] = row[col.field]
      })
      return obj
    })

    const worksheet = XLSX.utils.json_to_sheet(formatted)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, board)

    XLSX.writeFile(workbook, `${board}.xlsx`)
    } catch (error: unknown) {
      alert(error instanceof PrivacyAccessError ? privacyFailure(error) : "엑셀 데이터를 불러오지 못했습니다. 다시 시도해 주세요.")
    }
  }

  const [editingValue, setEditingValue] = useState("")

  const operation = useRef(false)
  const active = useRef(true)
  const [pending, setPending] = useState(false)
  const [mutationError, setMutationError] = useState<string | null>(null)
  useEffect(() => { active.current = true; return () => { active.current = false } }, [])

  const refreshList = async () => {
    try { await reload() } catch {
      if (active.current) setMutationError("변경은 완료됐지만 목록 갱신에 실패했습니다. 목록을 확인해 주세요.")
    }
  }
  const handleDelete = async (postId: number) => {
    if (readOnly || operation.current || !confirm("삭제하시겠습니까?")) return
    operation.current = true
    setPending(true)
    setMutationError(null)
    try {
      const revision=(posts.find(post=>post.id===postId) as ({_revision?:number})|undefined)?._revision
      if(revision===undefined) await deletePost(BOARD_TABLE_MAP[board], postId)
      else await deletePost(BOARD_TABLE_MAP[board], postId,revision)
      if (!active.current) return
      if (editingCell?.id === postId) setEditingCell(null)
      await refreshList()
    } catch {
      if (active.current) setMutationError("삭제하지 못했거나 결과를 확인할 수 없습니다. 목록을 새로고침해 확인해 주세요.")
    } finally {
      operation.current = false
      if (active.current) setPending(false)
    }
  }

  const handleSave = async (postId: number, field: string) => {
    if (operation.current) return
    operation.current = true
    setPending(true)
    setMutationError(null)
    let value: string | number = editingValue

    // 숫자 필드 자동 변환
    if (!isNaN(Number(editingValue)) && editingValue.trim() !== "") {
      value = Number(editingValue)
    }

    try {
      // 동적 열 편집의 기존 string/number 전송 경계. 정적 컬럼 호출의 검증은 서비스에 유지한다.
      const payload={ [field]: value }
      if(editingCell?.revision===undefined) await updatePost<EditorTable>(BOARD_TABLE_MAP[board], postId, payload)
      else await updatePost<EditorTable>(BOARD_TABLE_MAP[board], postId, payload,editingCell.revision)

      if (!active.current) return
      setEditingCell(null)
      await refreshList()
    } catch {
      if (active.current) setMutationError("수정하지 못했거나 결과를 확인할 수 없습니다. 입력과 목록을 확인해 주세요.")
    } finally {
      operation.current = false
      if (active.current) setPending(false)
    }
  }

  if (loading) {
    return <AdminSessionLoading/>
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <p role="status" className="text-sm text-gray-600">안전한 순서 컬럼 확인 전까지 정렬 저장을 사용할 수 없습니다. 기존 조회 순서를 유지합니다.</p>
      {readOnly && <p role="note" className="text-sm text-gray-600">업무 승인이 필요한 최소 항목의 조회 전용 목록입니다. 개인정보 수정·삭제는 제한됩니다.</p>}
      <div className="flex items-center justify-between p-2">
        <h2 className="text-xl font-bold text-gray-900">
          목록
        </h2>
        {(board=="등록회원") && (
          <button
            onClick={handleExcelDownload}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
          >
            excel-download
          </button>
        )}
      </div>

      {mutationError && <div role="alert" className="text-sm text-red-600">{mutationError}
        <button type="button" disabled={pending} onClick={() => void refreshList()}>목록 새로고침</button>
      </div>}
      <table className="w-full border border-gray-300 text-sm">
        <thead className="bg-gray-100">
          <tr>
            <th className="border p-2 w-8"></th>

            {(board === "프로젝트" || board === "스터디" || board === "행사") && (
              <th className="border p-2">이미지</th>
            )}

            {BOARD_COLUMNS[board].map((col) => (
              <th key={col.field} className="border p-2">
                {col.label}
              </th>
            ))}

          </tr>
        </thead>

        <tbody>
          {posts.map((post, index) => {
            const textFields: EditorTextFields = post
            const filename = "filename" in post && typeof post.filename === "string" ? post.filename : null
            const eventFilename = getFirstImageFilename("filenames" in post ? post.filenames : null)
            return (
            <tr
              key={post.id}
              draggable={false}
              onDragStart={(e) => drag.handleDragStart(e, index)}
              onDragOver={(e) => drag.handleDragOver(e, index)}
              onDrop={(e) => drag.handleDrop(e, index)}
              onDragEnd={drag.handleDragEnd}
              className={cx(
                "hover:bg-gray-50",
                drag.dragOverIndex === index &&
                  drag.dropPosition === "top" &&
                  "border-t-2 border-blue-500",
                drag.dragOverIndex === index &&
                  drag.dropPosition === "bottom" &&
                  "border-b-2 border-blue-500",
              )}
            >
            <td className="border p-2 text-center text-gray-400 select-none">⠿</td>

            {(board === "프로젝트" || board === "스터디") && (
              <td className="border p-2">
                {filename ? (
                  <ImageFromStorage
                    board={board}
                    filename={filename}
                    className="w-16 h-16 rounded-md object-cover border"
                  />
                ) : (
                  <div className="w-16 h-16 bg-gray-100 rounded-md border flex items-center justify-center">
                    <span className="text-xs text-gray-400">없음</span>
                  </div>
                )}
              </td>
            )}

            {/* ✅ 행사 이미지 */}
            {board === "행사" && (
              <td className="border p-2">
                {eventFilename ? (
                  <ImageFromStorage
                    board={board}
                    filename={eventFilename}
                    className="w-16 h-16 rounded-md object-cover border"
                  />
                ) : (
                  <div className="w-16 h-16 bg-gray-100 rounded-md border flex items-center justify-center">
                    <span className="text-xs text-gray-400">없음</span>
                  </div>
                )}
              </td>
            )}

            {/* ✅ 나머지 컬럼들 */}
            {BOARD_COLUMNS[board].map((col) => (
              <td
                key={col.field}
                className="border p-2 cursor-pointer"
                onClick={() => {
                  if (readOnly || operation.current || (editingCell?.id === post.id && editingCell.field === col.field)) return
                  setMutationError(null)
                  setEditingCell({ id: post.id, field: col.field,revision:(post as {_revision?:number})._revision })
                  setEditingValue(textFields[col.field] ?? "")
                }}
              >
                {editingCell &&
                editingCell.id === post.id &&
                editingCell.field === col.field ? (
                  <input
                    className="w-full border px-2 py-1"
                    value={editingValue}
                    autoFocus
                    disabled={pending}
                    onChange={(e) => setEditingValue(e.target.value)}
                    onBlur={() => handleSave(post.id, col.field)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleSave(post.id, col.field)
                      }
                    }}
                  />
                ) : (
                  textFields[col.field]
                )}
              </td>
            ))}

            {/* 삭제 버튼 */}
            <td className="border p-2 text-center">
              {!readOnly && <button
                disabled={pending}
                onClick={() => handleDelete(post.id)}
                className="px-3 py-1 bg-red-500 text-white rounded-md hover:bg-red-600"
              >
                삭제
              </button>}
            </td>
          </tr>
          )})}
        </tbody>
      </table>

    </div>
  )
}
