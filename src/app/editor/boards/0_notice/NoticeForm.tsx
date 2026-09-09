"use client"

import { useEffect, useState } from "react"
import { deletePost, fetchPosts, insertPost } from "../../services/board.service"
import { persistOrder } from "../../services/order.service"
import { useDragAndDrop } from "../../hooks/useDragAndDrop"
import { BOARD_TABLE_MAP } from "../../constants"
import { FormField } from "../../components/common/FormField"
import { textareaBase } from "../../utils/inputformClasses"
import { cx } from "../../utils/cx"

type NoticeFilter = "공지" | "홍보"

export function NoticeForm() {
  const [title, setTitle] = useState("")
  const [body, setBody] = useState("")
  const [postType, setPostType] = useState<NoticeFilter>("공지")
  const [loading, setLoading] = useState(false)

  const [posts, setPosts] = useState<any[]>([])
  const [listLoading, setListLoading] = useState(false)
  const [filter, setFilter] = useState<NoticeFilter>("공지")

  const loadPosts = async () => {
    setListLoading(true)
    const data = await fetchPosts(BOARD_TABLE_MAP["공지"])
    setPosts(data)
    setListLoading(false)
  }

  useEffect(() => {
    loadPosts()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    await insertPost(BOARD_TABLE_MAP["공지"], {
      text: title,
      description: body,
      created_at: new Date().toISOString(),
      is_noti: postType === "공지",
    })

    setTitle("")
    setBody("")
    setLoading(false)
    loadPosts()
  }

  const handleDelete = async (id: number) => {
    if (!confirm("삭제하시겠습니까?")) return
    await deletePost(BOARD_TABLE_MAP["공지"], id)
    loadPosts()
  }

  const filteredPosts = posts.filter((post) =>
    filter === "공지" ? !!post.is_noti : !post.is_noti,
  )

  const matchesFilter = (post: any) =>
    filter === "공지" ? !!post.is_noti : !post.is_noti

  const drag = useDragAndDrop({
    items: filteredPosts,
    onReorder: async (reorderedFiltered) => {
      const queue = [...reorderedFiltered]
      const reorderedAll = posts.map((post) =>
        matchesFilter(post) ? queue.shift() : post,
      )

      setPosts(reorderedAll)
      await persistOrder(BOARD_TABLE_MAP["공지"], reorderedAll)
      loadPosts()
    },
  })

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex gap-2 mb-2">
            {(["공지", "홍보"] as NoticeFilter[]).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setPostType(type)}
                className={cx(
                  "px-3 py-1 rounded-md text-sm font-medium transition",
                  postType === type
                    ? "bg-blue-600 text-white"
                    : "bg-gray-200 text-gray-700 hover:bg-gray-300",
                )}
              >
                {type}
              </button>
            ))}
          </div>
        <FormField>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="공지사항 제목을 입력하세요"
            className={`w-full ${textareaBase}`}
          />
        </FormField>

        <FormField>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="공지 내용을 입력하세요"
            className={`w-full min-h-32 ${textareaBase}`}
          />
        </FormField>

        <button
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:bg-gray-400"
        >
          등록
        </button>
      </form>

      <div>
        <div className="flex gap-2 mb-4">
          <button
            type="button"
            onClick={() => setFilter("공지")}
            className={cx(
              "px-4 py-2 rounded-md text-sm font-medium transition",
              filter === "공지"
                ? "bg-blue-600 text-white"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300",
            )}
          >
            공지
          </button>
          <button
            type="button"
            onClick={() => setFilter("홍보")}
            className={cx(
              "px-4 py-2 rounded-md text-sm font-medium transition",
              filter === "홍보"
                ? "bg-blue-600 text-white"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300",
            )}
          >
            홍보
          </button>
        </div>

        {listLoading ? (
          <div className="text-sm text-gray-500">불러오는 중...</div>
        ) : (
          <table className="w-full border border-gray-300 text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="border p-2 w-8"></th>
                <th className="border p-2">제목</th>
                <th className="border p-2">내용</th>
                <th className="border p-2"></th>
              </tr>
            </thead>
            <tbody>
              {filteredPosts.map((post, index) => (
                <tr
                  key={post.id}
                  draggable
                  onDragStart={(e) => drag.handleDragStart(e, index)}
                  onDragOver={(e) => drag.handleDragOver(e, index)}
                  onDrop={(e) => drag.handleDrop(e, index)}
                  onDragEnd={drag.handleDragEnd}
                  className={cx(
                    "hover:bg-gray-50 cursor-move",
                    drag.dragOverIndex === index &&
                      drag.dropPosition === "top" &&
                      "border-t-2 border-blue-500",
                    drag.dragOverIndex === index &&
                      drag.dropPosition === "bottom" &&
                      "border-b-2 border-blue-500",
                  )}
                >
                  <td className="border p-2 text-center text-gray-400 select-none">⠿</td>
                  <td className="border p-2">{post.text}</td>
                  <td className="border p-2">{post.description}</td>
                  <td className="border p-2 text-center">
                    <button
                      onClick={() => handleDelete(post.id)}
                      className="px-3 py-1 bg-red-500 text-white rounded-md hover:bg-red-600"
                    >
                      삭제
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
