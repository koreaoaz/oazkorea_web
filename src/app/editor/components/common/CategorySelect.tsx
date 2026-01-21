"use client"

import { useRef, useState } from "react"
import {  CATEGORY_OPTIONS, CategoryKey,} from "../../constants"
import { inputBase } from "../../utils/inputformClasses"


type Props = {
  value: CategoryKey | ""
  onChange: (v: CategoryKey) => void
  label?: string
}

export function CategorySelect({
  value,
  onChange,
  label = "카테고리",
}: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  return (
    <div ref={ref} className="relative">
      <span className="sr-only">{label}</span>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`w-full h-10 px-3 border rounded-md text-left bg-white flex items-center justify-between ${inputBase}`}
      >
        <span>{value || "카테고리 선택"}</span>
        <span>▾</span>
      </button>

      {open && (
        <ul className="absolute z-50 mt-1 w-full border bg-white rounded-md shadow">
          {CATEGORY_OPTIONS.map((opt) => (
            <li key={opt}>
              <button
                type="button"
                onClick={() => {
                  onChange(opt)
                  setOpen(false)
                }}
                className="w-full px-3 py-2 text-left hover:bg-gray-100"
              >
                {opt}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
