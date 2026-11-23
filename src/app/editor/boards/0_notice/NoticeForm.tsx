"use client"

import {AdminSessionLoading} from '@/components/AdminSessionLoading'
import { useCallback, useEffect, useRef, useState } from "react"
import { deletePost, fetchPosts, insertPost, updatePost } from "../../services/board.service"
import { persistOrder } from "../../services/order.service"
import { useDragAndDrop } from "../../hooks/useDragAndDrop"
import { BOARD_TABLE_MAP } from "../../constants"
import { FormField } from "../../components/common/FormField"
import { textareaBase } from "../../utils/inputformClasses"
import { cx } from "../../utils/cx"
import { mergeNoticeOrder } from "../../utils/noticeOrder"
import type { NoticeRow } from "@/types/editor"

type NoticeFilter = "공지" | "홍보"

export function NoticeForm() {
  const [title, setTitle] = useState("")
  const [body, setBody] = useState("")
  const [postType, setPostType] = useState<NoticeFilter>("공지")
  const [loading, setLoading] = useState(false)

  const [posts, setPosts] = useState<NoticeRow[]>([])
  const latestPosts = useRef(posts)
  const dragSnapshot = useRef<{ posts: NoticeRow[]; rows: NoticeRow[]; filter: NoticeFilter } | null>(null)
  const [listLoading, setListLoading] = useState(true)
  const [filter, setFilter] = useState<NoticeFilter>("공지")
  const [listError, setListError] = useState<string | null>(null)
  const requestVersion = useRef(0)
  const [editing, setEditing] = useState<{ id: number; field: "text" | "description"; value: string; revision?:number } | null>(null)
  const [editError, setEditError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const mutationLock = useRef(false)
  const active = useRef(true)
  const [deleting, setDeleting] = useState(false)
  const [mutationError, setMutationError] = useState<string | null>(null)

  const startEditing = (post: NoticeRow, field: "text" | "description") => {
    if (mutationLock.current) return
    setEditError(null)
    setEditing({ id: post.id, field, value: post[field] ?? "", revision:(post as NoticeRow & {_revision?:number})._revision })
  }

  const saveEdit = async () => {
    if (!editing || mutationLock.current) return
    const { id, field, value } = editing
    mutationLock.current = true
    setSaving(true)
    setEditError(null)
    try {
      if(editing.revision===undefined) await updatePost(BOARD_TABLE_MAP["공지"], id, { [field]: value })
      else await updatePost(BOARD_TABLE_MAP["공지"], id, { [field]: value },editing.revision)
      if (!active.current) return
      setEditing(null)
      await loadPosts()
    } catch {
      if (active.current) setEditError("수정 내용을 저장하지 못했습니다. 권한과 연결 상태를 확인한 뒤 다시 시도해 주세요.")
    } finally {
      mutationLock.current = false
      if (active.current) setSaving(false)
    }
  }

  const fetchList = useCallback(() => {
    const version = ++requestVersion.current
    return fetchPosts(BOARD_TABLE_MAP["공지"]).then((data) => {
      if (version !== requestVersion.current) return
      latestPosts.current = data
      setPosts(data)
      setListError(null)
      setListLoading(false)
    }, () => {
      if (version !== requestVersion.current) return
      setListError("공지를 불러오지 못했습니다. 다시 시도해 주세요.")
      setListLoading(false)
    })
  }, [])
  const cancelPending = useCallback(() => { requestVersion.current++ }, [])

  const loadPosts = () => {
    setListLoading(true)
    setListError(null)
    return fetchList()
  }

  useEffect(() => {
    active.current = true
    void fetchList()
    return () => { active.current = false; cancelPending() }
  }, [fetchList, cancelPending])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (mutationLock.current) return
    mutationLock.current = true
    setLoading(true)
    setMutationError(null)

    try {
    await insertPost(BOARD_TABLE_MAP["공지"], {
      text: title,
      description: body,
      created_at: new Date().toISOString(),
      is_noti: postType === "공지",
    })

    if (!active.current) return
    setTitle("")
    setBody("")
    await loadPosts()
    } catch {
      if (active.current) setMutationError("공지 저장을 완료하지 못했습니다. 입력과 목록을 확인한 뒤 다시 시도해 주세요.")
    } finally {
      mutationLock.current = false
      if (active.current) setLoading(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (mutationLock.current) return
    if (!confirm("삭제하시겠습니까?")) return
    mutationLock.current = true
    setDeleting(true)
    setMutationError(null)
    try {
      const revision=(posts.find(post=>post.id===id) as (NoticeRow & {_revision?:number})|undefined)?._revision
      if(revision===undefined) await deletePost(BOARD_TABLE_MAP["공지"], id)
      else await deletePost(BOARD_TABLE_MAP["공지"], id, revision)
      if (!active.current) return
      if (editing?.id === id) setEditing(null)
      await loadPosts()
    } catch {
      if (active.current) setMutationError("삭제하지 못했거나 결과를 확인할 수 없습니다. 목록을 새로고침해 확인해 주세요.")
    } finally {
      mutationLock.current = false
      if (active.current) setDeleting(false)
    }
  }

  const filteredPosts = posts.filter((post) =>
    filter === "공지" ? !!post.is_noti : !post.is_noti,
  )

  const matchesFilter = (post: { is_noti?: unknown }) =>
    filter === "공지" ? !!post.is_noti : !post.is_noti

  const drag = useDragAndDrop({
    enabled: false,
    items: filteredPosts,
    onReorder: async (reorderedFiltered) => {
      const snapshot = dragSnapshot.current
      const reorderedAll = snapshot && snapshot.posts === posts &&
        snapshot.posts === latestPosts.current && snapshot.filter === filter &&
        snapshot.rows.length === posts.length && snapshot.rows.every((row, index) => row === posts[index])
        ? mergeNoticeOrder(posts, reorderedFiltered, matchesFilter)
        : null
      dragSnapshot.current = null
      if (reorderedAll === null) {
        alert("목록이 변경되었거나 정렬 목록이 일치하지 않아 저장을 취소했습니다. 현재 목록에서 다시 드래그해 주세요.")
        return
      }

      await persistOrder(BOARD_TABLE_MAP["공지"], reorderedAll)
      latestPosts.current = reorderedAll
      setPosts(reorderedAll)
      loadPosts()
    },
  })

  return (
    <div className="space-y-6">
      <p role="status" className="text-sm text-gray-600">안전한 순서 컬럼 확인 전까지 정렬 저장을 사용할 수 없습니다. 기존 조회 순서를 유지합니다.</p>
      {listError && <p role="alert" className="text-sm text-red-600">{listError}</p>}
      {editError && <p role="alert" className="text-sm text-red-600">{editError}</p>}
      {mutationError && <p role="alert" className="text-sm text-red-600">{mutationError}</p>}
      {(listError || mutationError) && <button type="button" onClick={() => void loadPosts()}>목록 새로고침</button>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <fieldset disabled={loading || saving || deleting} className="contents">
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
          disabled={loading || saving || deleting}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:bg-gray-400"
        >
          등록
        </button>
        </fieldset>
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
          <AdminSessionLoading/>
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
                  draggable={false}
                  onDragStart={(e) => {
                    dragSnapshot.current = { posts, rows: [...posts], filter }
                    drag.handleDragStart(e, index)
                  }}
                  onDragOver={(e) => drag.handleDragOver(e, index)}
                  onDrop={(e) => drag.handleDrop(e, index)}
                  onDragEnd={() => {
                    dragSnapshot.current = null
                    drag.handleDragEnd()
                  }}
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
                  {(["text", "description"] as const).map((field) => (
                    <td key={field} className="border p-2" onDoubleClick={() => {
                      if (editing?.id !== post.id || editing.field !== field) startEditing(post, field)
                    }}>
                      {editing?.id === post.id && editing.field === field ? (
                        <div className="space-y-2">
                          <textarea
                            aria-label={field === "text" ? "공지 제목 수정" : "공지 내용 수정"}
                            className="w-full border px-2 py-1"
                            value={editing.value}
                            disabled={saving || loading || deleting}
                            autoFocus
                            onChange={(event) => setEditing({ ...editing, value: event.target.value })}
                          />
                          <div className="flex gap-2">
                            <button type="button" disabled={saving || loading || deleting} onClick={() => void saveEdit()} className="rounded bg-blue-600 px-2 py-1 text-white disabled:opacity-50">저장</button>
                            <button type="button" disabled={saving || loading || deleting} onClick={() => { setEditing(null); setEditError(null) }} className="rounded border px-2 py-1">취소</button>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <span>{post[field]}</span>{" "}
                          <button type="button" disabled={saving || loading || deleting} onClick={() => startEditing(post, field)} aria-label={field === "text" ? "공지 제목 편집" : "공지 내용 편집"} className="text-blue-700 underline disabled:opacity-50">수정</button>
                        </div>
                      )}
                    </td>
                  ))}
                  <td className="border p-2 text-center">
                    <button
                      disabled={saving || loading || deleting}
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
