import { useState } from "react"

export type DropPosition = "top" | "bottom" | null

type Params<T> = {
  items: T[]
  onReorder: (items: T[]) => Promise<void> | void
}

export function useDragAndDrop<T>({ items, onReorder }: Params<T>) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  const [dropPosition, setDropPosition] = useState<DropPosition>(null)

  const handleDragStart = (_: React.DragEvent, index: number) => {
    setDraggedIndex(index)
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    const rect = e.currentTarget.getBoundingClientRect()
    const y = e.clientY - rect.top
    setDropPosition(y < rect.height / 2 ? "top" : "bottom")
    setDragOverIndex(index)
  }

  const handleDrop = async (_: React.DragEvent, index: number) => {
    if (draggedIndex === null) return

    let targetIndex = index
    if (dropPosition === "bottom") targetIndex += 1
    if (draggedIndex < targetIndex) targetIndex -= 1
    if (draggedIndex === targetIndex) return reset()

    const reordered = [...items]
    const [moved] = reordered.splice(draggedIndex, 1)
    reordered.splice(targetIndex, 0, moved)

    await onReorder(reordered)
    reset()
  }

  const reset = () => {
    setDraggedIndex(null)
    setDragOverIndex(null)
    setDropPosition(null)
  }

  return {
    draggedIndex,
    dragOverIndex,
    dropPosition,
    handleDragStart,
    handleDragOver,
    handleDrop,
    handleDragEnd: reset,
  }
}
