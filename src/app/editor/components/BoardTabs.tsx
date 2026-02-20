"use client";

import { BoardType, BOARD_LIST } from "../constants"
import { cx } from "../utils/cx"

type Props = {
  board: BoardType
  onChange: (b: BoardType) => void
}

export function BoardTabs({ board, onChange }: Props) {
  return (
    <div className="flex flex-wrap gap-2 mb-6">
      {BOARD_LIST.map((b) => (
        <button
          key={b}
          onClick={() => onChange(b)}
          className={cx(
            "px-4 py-2 rounded-md text-sm font-medium transition",
            board === b
              ? "bg-blue-600 text-white"
              : "bg-gray-200 text-gray-700 hover:bg-gray-300",
          )}
        >
          {b}
        </button>
      ))}
    </div>
  )
}
