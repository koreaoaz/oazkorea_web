"use client";

import { BoardType, BOARD_LIST, BOARD_TABLE_MAP } from "../constants"
import { cx } from "../utils/cx"
import {adminEditorEnabled} from '@/lib/admin/protocol'
import {CONTENT_TABLES} from '@/lib/admin/policy'

type Props = {
  board: BoardType
  onChange: (b: BoardType) => void
  allowed?: readonly BoardType[]
}

export function BoardTabs({ board, onChange, allowed=BOARD_LIST }: Props) {
  return (
    <div className="flex flex-wrap gap-2 mb-6">
      {allowed.filter(b=>!adminEditorEnabled()||CONTENT_TABLES.some(t=>t===BOARD_TABLE_MAP[b])).map((b) => (
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
