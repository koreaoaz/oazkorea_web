"use client"

import type { ReactNode } from "react"
import { inputBase, textareaBase } from "../../utils/inputformClasses"

type Props = {
  children: ReactNode
}

export function FormField({ children }: Props) {
  return (
    <div className="space-y-1">
      <label className={'block text-sm font-medium text-gray-700'}>
      {children}
      </label>
    </div>
  )
}
