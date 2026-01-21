"use client"

import type { ReactNode } from "react"

type Props = {
  children: ReactNode
}

export function EditorLayout({ children }: Props) {
  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">
          관리자 게시판
        </h1>
      </div>

      <main className="max-w-6xl mx-auto p-4">
        {children}
      </main>
    </div>
  )
}
