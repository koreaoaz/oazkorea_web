"use client"

import { BoardType, BOARD_TABLE_MAP } from "../constants"
import { useDragAndDrop } from "../hooks/useDragAndDrop"
import { persistOrder } from "../services/order.service"
import { deletePost, fetchPosts } from "../services/board.service"
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

export function PostList({ board, posts, setPosts, reload, loading }: Props) {
  const drag = useDragAndDrop({
    items: posts,
    onReorder: async (newPosts) => {
      setPosts(newPosts)
      await persistOrder(BOARD_TABLE_MAP[board], newPosts)
    },
  })

  const handleExcelDownload = async () => {
    const data = await fetchPosts(BOARD_TABLE_MAP[board])

    const formatted = data.map((user) => ({
      이름: user.name,
      학번: user.student_id,
      학과: user.department,
      기수: user.generation,
      이메일: user.email,
      연락처: user.phone_number,
    }))

    const worksheet = XLSX.utils.json_to_sheet(formatted)

    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, "등록회원목록")

    const excelBuffer = XLSX.write(workbook, {
      bookType: "xlsx",
      type: "array",
    })

    const blob = new Blob([excelBuffer], {
      type: "application/octet-stream",
    })

    saveAs(blob, "등록회원목록.xlsx")
  }

  if (loading) {
    return <div className="text-sm text-gray-500">불러오는 중...</div>
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between p-2">
        <h2 className="text-xl font-bold text-gray-900">
          게시글 목록
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
      

      <ul className="space-y-4">
        {posts.map((post, index) => (
          <li
            key={post.id}
            draggable
            onDragStart={(e) => drag.handleDragStart(e, index)}
            onDragOver={(e) => drag.handleDragOver(e, index)}
            onDrop={(e) => drag.handleDrop(e, index)}
            onDragEnd={drag.handleDragEnd}
            className={cx(
              "flex items-center justify-between p-4 rounded-md border bg-gray-50",
              drag.draggedIndex === index && "bg-blue-100",
              drag.dragOverIndex === index &&
                drag.dropPosition === "top" &&
                "border-t-2 border-blue-600",
              drag.dragOverIndex === index &&
                drag.dropPosition === "bottom" &&
                "border-b-2 border-blue-600",
            )}
          >
            <div className="flex items-center gap-4">
              {(board === "프로젝트" || board === "스터디") && (
                post.filename ? (
                  <ImageFromStorage
                    board={board}
                    filename={post.filename}
                    className="w-16 h-16 rounded-md object-cover border"
                  />
                ) : (
                  <div className="w-16 h-16 bg-gray-100 rounded-md border flex items-center justify-center">
                    <span className="text-xs text-gray-400">이미지 없음</span>
                  </div>
                )
              )}

              {board === "행사" && getFirstImageFilename(post.filenames) && (
                <ImageFromStorage
                  board={board}
                  filename={getFirstImageFilename(post.filenames)!}
                  className="w-16 h-16 rounded-md object-cover border"
                />
              )}

              
              {board === "공지" && (
                <>
                  <h3 className="text-lg font-medium text-gray-900">
                    {post.text}
                  </h3>
                  {post.description && (
                    <p className="text-sm text-gray-600 whitespace-pre-wrap">
                      {post.description}
                    </p>
                  )}
                </>
              )}

              {board === "프로젝트" && (
                <>
                  <h3 className="text-lg font-medium text-gray-900">
                    {post.project_name}
                  </h3>
                  <p className="text-sm text-gray-600 line-clamp-2">
                    {post.description}
                  </p>
                </>
              )}

              {board === "스터디" && (
                <>
                  <h3 className="text-lg font-medium text-gray-900">
                    {post.study_name}
                  </h3>
                  <p className="text-sm text-gray-600 line-clamp-2">
                    {post.outline}
                  </p>
                </>
              )}

              {board === "학회실 사용 시간표" && (
                <>
                  <h3 className="text-lg font-medium text-gray-900">
                    {post.study_name}
                  </h3>
                  <p className="text-sm text-gray-600">
                    {post.leader} · {post.start_time} ~ {post.end_time}
                  </p>
                </>
              )}

              {board === "명예의 전당" && (
                <>
                  <h3 className="text-lg font-medium text-gray-900">
                    {post.name}
                  </h3>
                  <p className="text-sm text-gray-600">
                    {post.date}
                  </p>
                </>
              )}

              {board === "일정" && (
                <>
                  <h3 className="text-lg font-medium text-gray-900">
                    {post.description}
                  </h3>
                  <p className="text-sm text-gray-600">
                    {post.start_date} ~ {post.end_date}
                  </p>
                </>
              )}

              {board === "행사" && (
                <>
                  <h3 className="text-lg font-medium text-gray-900">
                    {post.title}
                  </h3>
                  {post.description && (
                    <p className="text-sm text-gray-600 whitespace-pre-wrap">
                      {post.description}
                    </p>
                  )}
                </>
              )}

              {board === "등록회원" && (
                <>
                  <h3 className="text-lg font-medium text-gray-900">
                    {post.name}
                  </h3>
                  {post.uuid && (
                    <p className="text-sm text-gray-400 whitespace-pre-wrap">
                      {post.email}, {post.generation}
                    </p>
                  )}
                </>
              )}

            </div>

            <div>
              {(board=="등록회원") && (
                <>
                  <button
                  onClick={async() => {await navigator.clipboard.writeText(post.uuid)}} 
                  className="px-4 py-2 bg-blue-300 text-white rounded-md hover:bg-blue-600 transition-colors">
                  uuid
                  </button>  
                </>
              )}
              <button
                onClick={async () => {
                  if (!confirm("삭제하시겠습니까?")) return
                  await deletePost(BOARD_TABLE_MAP[board], post.id)
                  reload()
                }}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
              >
                삭제
              </button>
            </div>
            
          </li>
        ))}
      </ul>
    </div>
  )
}
