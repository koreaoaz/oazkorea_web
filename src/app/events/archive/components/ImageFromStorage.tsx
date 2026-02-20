"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import { getPublicImageUrl } from "../services/storage.service"

type Props = {
  filename: string
  board: string
  className?: string
}

export function ImageFromStorage({ filename, board, className }: Props) {
  const [url, setUrl] = useState<string>("")

  useEffect(() => {
    let bucket = ""
    if (board === "프로젝트") bucket = "project_img"
    if (board === "스터디") bucket = "study-images"
    if (board === "행사") bucket = "card_news"

    if (bucket) {
      setUrl(getPublicImageUrl(bucket, filename))
    }
  }, [filename, board])

  if (!url) return null

  return <Image src={url} alt="" width={64} height={64} className={className} />
}
