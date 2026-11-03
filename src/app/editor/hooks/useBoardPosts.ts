import { useCallback, useEffect, useRef, useState } from "react";
import { BoardType, BOARD_TABLE_MAP } from "../constants"
import { fetchPosts, type EditorPost } from "../services/board.service";
import { privateEditorTable } from '@/lib/privacy/policy';

export function useBoardPosts(board: BoardType) {
  const [posts, setPosts] = useState<EditorPost[]>([])
  const [loading, setLoading] = useState(false)
  const generation = useRef(0)
  const invalidate = useCallback(() => { generation.current++ }, [])

  const load = useCallback(async () => {
    const request = ++generation.current
    setLoading(true)
    const table = BOARD_TABLE_MAP[board]
    try {
      const data = privateEditorTable(table) ? [] : await fetchPosts(table)
      if (request === generation.current) setPosts(data)
    } catch { if (request === generation.current) setPosts([]) }
    finally { if (request === generation.current) setLoading(false) }
  }, [board])

  useEffect(() => {
    let active = true
    void Promise.resolve().then(() => { if (active) return load() }).catch(() => { if (active) setPosts([]) })
    return () => { active = false; invalidate() }
  }, [load, invalidate])

  return {
    posts,
    setPosts,
    reload: load,
    loading,
  }
}
