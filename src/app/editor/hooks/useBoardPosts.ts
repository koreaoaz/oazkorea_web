import { useEffect, useState } from "react"
import { BoardType, BOARD_TABLE_MAP } from "../constants"
import { fetchPosts } from "../services/board.service"

export function useBoardPosts(board: BoardType) {
  const [posts, setPosts] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    const table = BOARD_TABLE_MAP[board]
    const data = await fetchPosts(table)
    setPosts(data)
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [board])

  return {
    posts,
    setPosts,
    reload: load,
    loading,
  }
}
