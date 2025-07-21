"use client"

import { useEffect, useState, useRef } from "react"
import Image from "next/image"
import clsx from "clsx"

const rawImages = [
  "/sliderimages/1EROlogodarkmode.png",
  "/sliderimages/1EROlogolightmode.png",
  "/sliderimages/applecoffecomputer.png",
]

export default function ImageSlider() {
  const images = [rawImages[rawImages.length - 1], ...rawImages, rawImages[0]] // 가짜 슬라이드: [3, 1, 2, 3, 1]
  const [index, setIndex] = useState(1) // 실제 슬라이드 시작은 1 (첫번째 진짜 이미지)
  const [transitioning, setTransitioning] = useState(true)
  const sliderRef = useRef<HTMLDivElement>(null)

  // 자동 슬라이드
  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((prev) => prev + 1)
    }, 4000)
    return () => clearInterval(interval)
  }, [])

  // 슬라이드 이동 후 끝 처리 (loop)
  useEffect(() => {
    if (index === images.length - 1) {
      // 마지막 가짜 이미지로 간 뒤 → 첫 진짜 이미지로 순간 이동
      const timer = setTimeout(() => {
        setTransitioning(false)
        setIndex(1)
      }, 700)
      return () => clearTimeout(timer)
    }

    if (index === 0) {
      // 첫 가짜 이미지 → 마지막 진짜로 순간 이동
      const timer = setTimeout(() => {
        setTransitioning(false)
        setIndex(images.length - 2)
      }, 700)
      return () => clearTimeout(timer)
    }

    setTransitioning(true)
  }, [index])

  return (
    <div className="relative w-full aspect-video overflow-hidden rounded-xl">
      {/* 슬라이드 */}
      <div
        ref={sliderRef}
        className={clsx("flex", transitioning && "transition-transform duration-700 ease-in-out")}
        style={{ transform: `translateX(-${index * 100}%)` }}
      >
        {images.map((src, i) => (
          <div key={i} className="relative flex-shrink-0 w-full aspect-video">
            <Image
              src={src}
              alt={`슬라이드 이미지 ${i}`}
              fill
              className="object-cover"
              priority={i === 1}
            />
          </div>
        ))}
      </div>

      {/* 도트 표시 */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-10">
        {rawImages.map((_, i) => (
          <div
            key={i}
            className={clsx(
              "w-2 h-2 rounded-full bg-white/70",
              (index - 1 + rawImages.length) % rawImages.length === i && "bg-white"
            )}
          />
        ))}
      </div>
    </div>
  )
}
