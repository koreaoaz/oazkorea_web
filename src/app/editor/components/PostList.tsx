"use client"

import { BoardType, BOARD_TABLE_MAP } from "../constants"
import { useDragAndDrop } from "../hooks/useDragAndDrop"
import { persistOrder } from "../services/order.service"
import { deletePost } from "../services/board.service"
import { ImageFromStorage } from "./ImageFromStorage"
import { cx } from "../utils/cx"
import { getFirstImageFilename } from "../utils/parsing_first"

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

  if (loading) {
    return <div className="text-sm text-gray-500">불러오는 중...</div>
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-xl font-bold text-gray-900 mb-4">게시글 목록</h2>

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

              <div>
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

                
              </div>
            </div>

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
          </li>
        ))}
      </ul>
    </div>
  )
}
