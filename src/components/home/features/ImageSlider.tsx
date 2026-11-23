"use client"


import {useUIText} from '@/components/LocaleProvider';
import { useEffect, useState, useRef } from "react"
import Image from "next/image"
import clsx from "clsx"

const rawImages = [
  "/sliderimages/1EROlogodarkmode.png",
  "/sliderimages/1EROlogolightmode.png",
  "/sliderimages/applecoffecomputer.png",
]
const images = [rawImages[rawImages.length - 1], ...rawImages, rawImages[0]] // 가짜 슬라이드: [3, 1, 2, 3, 1]

export default function ImageSlider() {
 const uiText=useUIText();

  const [slide, setSlide] = useState({ index: 1, transitioning: true })
  const { index, transitioning } = slide
  const sliderRef = useRef<HTMLDivElement>(null)

  // 자동 슬라이드
  // 무한 순환 보정은 transition 없이 끝내고, 다음 실제 이동과 함께 transition을 다시 켠다.
  useEffect(() => {
    const interval = setInterval(() => {
      setSlide((previous) => ({ index: previous.index + 1, transitioning: true }))
    }, 4000)
    return () => clearInterval(interval)
  }, [])

  // 슬라이드 이동 후 끝 처리 (loop)
  useEffect(() => {
    if (index === images.length - 1) {
      // 마지막 가짜 이미지로 간 뒤 → 첫 진짜 이미지로 순간 이동
      const timer = setTimeout(() => {
        setSlide({ index: 1, transitioning: false })
      }, 700)
      return () => clearTimeout(timer)
    }

    if (index === 0) {
      // 첫 가짜 이미지 → 마지막 진짜로 순간 이동
      const timer = setTimeout(() => {
        setSlide({ index: images.length - 2, transitioning: false })
      }, 700)
      return () => clearTimeout(timer)
    }

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
              alt={uiText(`슬라이드 이미지 ${i}`)}
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
