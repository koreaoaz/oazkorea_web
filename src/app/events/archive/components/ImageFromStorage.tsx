"use client"


import Image from "next/image"
import { getPublicImageUrl } from "../services/storage.service"

type Props = {
  filename: string
  board: string
  className?: string
}

export function ImageFromStorage({ filename, board, className }: Props) {
  const bucket = board === "프로젝트" ? "project_img" : board === "스터디" ? "study-images" : board === "행사" ? "card_news" : ""
  const url = bucket ? getPublicImageUrl(bucket, filename) : ""

  if (!url) return null

  return <Image src={url} alt="" width={64} height={64} className={className} />
}
