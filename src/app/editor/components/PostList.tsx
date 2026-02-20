"use client"

import { useState } from "react"
import { BoardType, BOARD_TABLE_MAP } from "../constants"
import { useDragAndDrop } from "../hooks/useDragAndDrop"
import { persistOrder } from "../services/order.service"
import { deletePost, fetchPosts, updatePost} from "../services/board.service"
import { ImageFromStorage } from "./ImageFromStorage"
import { cx } from "../utils/cx"
import { getFirstImageFilename } from "../utils/parsing_first"
import * as XLSX from "xlsx"
import { saveAs } from "file-saver"

type Props = {
  board: BoardType
  posts: any[]
  loading: boolean
  reload: () => void
  setPosts: React.Dispatch<React.SetStateAction<any[]>>
}

const BOARD_COLUMNS: Record<
    BoardType,
    { label: string; field: string }[]
  > = {
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
      { label: "날짜", field: "date" },
    ],
    "등록회원": [
      { label: "이름", field: "name" },
      { label: "학번", field: "student_id" },
      { label: "학과", field: "department" },
      { label: "기수", field: "generation" },
      { label: "이메일", field: "email" },
      { label: "전화번호", field: "phone_number" },
    ],
    "승인email":[
      { label: "이름", field: "name" },
      { label: "이메일", field: "email" }
    ],
    "관리자id":[
      { label: "이름", field: "name" },
      { label: "이메일", field: "email"},
      { label: "uuid", field: "uuid" }
    ]
  }

export function PostList({ board, posts, setPosts, reload, loading }: Props) {
  const drag = useDragAndDrop({
    items: posts,
    onReorder: async (newPosts) => {
      setPosts(newPosts)
      await persistOrder(BOARD_TABLE_MAP[board], newPosts)
    },
  })


  const [editingCell, setEditingCell] = useState<{
    id: number
    field: keyof any
  } | null>(null)

  const handleExcelDownload = async () => {
    const data = await fetchPosts(BOARD_TABLE_MAP[board])

    const formatted = data.map((row) => {
      const obj: any = {}
      BOARD_COLUMNS[board].forEach((col) => {
        obj[col.label] = row[col.field]
      })
      return obj
    })

    const worksheet = XLSX.utils.json_to_sheet(formatted)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, board)

    XLSX.writeFile(workbook, `${board}.xlsx`)
  }

  const [editingValue, setEditingValue] = useState("")

  const handleSave = async (postId: number, field: string) => {
    let value: any = editingValue

    // 숫자 필드 자동 변환
    if (!isNaN(Number(editingValue)) && editingValue.trim() !== "") {
      value = Number(editingValue)
    }

    try {
      await updatePost(BOARD_TABLE_MAP[board], postId, {
        [field]: value,
      })

      setEditingCell(null)
      reload()
    } catch (err) {
      console.error("Update error:", err)
      alert("업데이트 실패")
    }
  }

  if (loading) {
    return <div className="text-sm text-gray-500">불러오는 중...</div>
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
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
      
      <table className="w-full border border-gray-300 text-sm">
        <thead className="bg-gray-100">
          <tr>
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
          {posts.map((post) => (
            <tr key={post.id} className="hover:bg-gray-50">


            {(board === "프로젝트" || board === "스터디") && (
              <td className="border p-2">
                {post.filename ? (
                  <ImageFromStorage
                    board={board}
                    filename={post.filename}
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
                {getFirstImageFilename(post.filenames) ? (
                  <ImageFromStorage
                    board={board}
                    filename={getFirstImageFilename(post.filenames)!}
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
                  setEditingCell({ id: post.id, field: col.field })
                  setEditingValue(post[col.field] ?? "")
                }}
              >
                {editingCell &&
                editingCell.id === post.id &&
                editingCell.field === col.field ? (
                  <input
                    className="w-full border px-2 py-1"
                    value={editingValue}
                    autoFocus
                    onChange={(e) => setEditingValue(e.target.value)}
                    onBlur={() => handleSave(post.id, col.field)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleSave(post.id, col.field)
                      }
                    }}
                  />
                ) : (
                  post[col.field]
                )}
              </td>
            ))}

            {/* 삭제 버튼 */}
            <td className="border p-2 text-center">
              <button
                onClick={async () => {
                  if (!confirm("삭제하시겠습니까?")) return
                  await deletePost(BOARD_TABLE_MAP[board], post.id)
                  reload()
                }}
                className="px-3 py-1 bg-red-500 text-white rounded-md hover:bg-red-600"
              >
                삭제
              </button>
            </td>
          </tr>
          ))}
        </tbody>
      </table>
      
    </div>
  )
}
