"use client"

import { useState } from "react"
import Image from "next/image"
import { getPublicImageUrl } from "../services/storage.service"

type Props = {
  filename: string
  board: string
  className?: string
}

export function ImageFromStorage({ filename, board, className }: Props) {
  const [failedUrl, setFailedUrl] = useState("")
  const bucket = board === "프로젝트" ? "project_img" : board === "스터디" ? "study-images" : board === "행사" ? "card_news" : ""
  const url = bucket && filename ? getPublicImageUrl(bucket, filename) : ""
  if (!url || failedUrl === url) return <div className={className} role="img" aria-label="이미지 없음">없음</div>

  return <Image src={url} alt="" width={64} height={64} className={className} onError={() => setFailedUrl(url)} />
}
