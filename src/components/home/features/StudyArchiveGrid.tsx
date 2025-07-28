"use client";

import React, { useState, useRef } from "react";
import Image from "next/image";

const CARD_COUNT = 6;
const imageSrc1 = "/study-logo/파이썬스터디.png";
const imageSrc2 = "/study-logo/파이썬스터디확장.png";

export default function StudyArchiveGrid() {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const hoverTimerRef = useRef<NodeJS.Timeout | null>(null);
  const leaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 마우스를 카드 위에 올렸을 때
  const handleMouseEnter = (index: number) => {
    if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current);
    hoverTimerRef.current = setTimeout(() => {
      setExpandedIndex(index);
    }, 500); // 0.5초 후 확장
  };

  // 마우스를 카드에서 뗐을 때
  const handleMouseLeave = () => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    leaveTimerRef.current = setTimeout(() => {
      setExpandedIndex(null);
    }, 500); // 0.5초 후 복구
  };

  return (
    <div className="w-full px-10 py-8">
      <h2 className="text-3xl font-bold mb-6">2025-2 스터디 목록</h2>

      <div className="relative grid grid-cols-3 gap-6">
        {/* 카드 6개 */}
        {Array.from({ length: CARD_COUNT }).map((_, idx) => (
          <div
            key={idx}
            className={`
              relative aspect-square rounded-md shadow-md bg-[#1A1B26] overflow-hidden
              transition-opacity duration-300
              ${expandedIndex !== null ? "opacity-0" : "opacity-100"}
            `}
            onMouseEnter={() => handleMouseEnter(idx)}
          >
            <Image
              src={imageSrc1}
              alt="파이썬 스터디"
              fill
              className="object-contain"
              priority
            />
          </div>
        ))}

        {/* 확장 카드 */}
        <div
          className={`
            absolute inset-0 z-20 flex items-center justify-center
            bg-[#1A1B26] rounded-md shadow-md
            transform transition-all duration-700 ease-in-out
            ${expandedIndex !== null ? "opacity-100 scale-100" : "opacity-0 scale-90 pointer-events-none"}
          `}
          onMouseLeave={handleMouseLeave}
        >
          <Image
            src={imageSrc2}
            alt="확장된 파이썬 스터디"
            fill
            className="object-contain p-4"
            priority
          />
        </div>
      </div>
    </div>
  );
}
