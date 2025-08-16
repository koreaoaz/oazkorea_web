"use client";

import React, { useState, useRef } from "react";
import Image from "next/image";

const CARD_COUNT = 6;
const TOTAL_ITEMS = 18;
const imageSrc1 = "/study-logo/파이썬스터디.png";
const imageSrc2 = "/study-logo/파이썬스터디확장.png";

export default function StudyArchiveGrid() {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const hoverTimerRef = useRef<NodeJS.Timeout | null>(null);
  const leaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // pagination
  const [currentPage, setCurrentPage] = useState(0);
  const totalPages = Math.ceil(TOTAL_ITEMS / CARD_COUNT);
  const start = currentPage * CARD_COUNT;
  const end = Math.min(start + CARD_COUNT, TOTAL_ITEMS);
  const visibleIndices = Array.from({ length: end - start }, (_, i) => start + i);

  const handleMouseEnter = (index: number) => {
    if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current);
    hoverTimerRef.current = setTimeout(() => setExpandedIndex(index), 500);
  };
  const handleMouseLeave = () => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    leaveTimerRef.current = setTimeout(() => setExpandedIndex(null), 500);
  };

  const goPrev = () => setCurrentPage((p) => Math.max(0, p - 1));
  const goNext = () => setCurrentPage((p) => Math.min(totalPages - 1, p + 1));

  return (
    <div className="w-full px-10 py-8">
      <h2 className="text-3xl font-bold mb-6">2025-2 스터디 목록</h2>

      <div className="relative w-full max-w-5xl mx-auto">
        {/* 카드 그리드 */}
        <div className="grid grid-cols-3 gap-6">
          {visibleIndices.map((globalIdx) => (
            <div
              key={globalIdx}
              className={`relative aspect-square rounded-md shadow-md bg-[#1A1B26] overflow-hidden transition-opacity duration-300 ${
                expandedIndex !== null ? "opacity-0" : "opacity-100"
              }`}
              onMouseEnter={() => handleMouseEnter(globalIdx)}
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
        </div>

        {/* 확장 오버레이 */}
        <div
          className={`absolute inset-0 z-20 flex items-center justify-center bg-[#1A1B26] rounded-md shadow-md transform transition-all duration-700 ease-in-out ${
            expandedIndex !== null ? "opacity-100 scale-100" : "opacity-0 scale-90 pointer-events-none"
          }`}
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

        {/* 페이지 화살표 — 항상 표시 */}
        {currentPage > 0 && (
          <button
            type="button"
            onClick={goPrev}
              className="absolute bottom-4 -left-14 -translate-x-[10px] h-11 w-11 rounded-full bg-black text-white shadow backdrop-blur flex items-center justify-center transform transition-transform duration-200 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-white/40"
            aria-label="Previous page"
          >
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
              <path
                d="M15 19l-7-7 7-7"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        )}

        {currentPage < totalPages - 1 && (
          <button
            type="button"
            onClick={goNext}
              className="absolute bottom-4 -right-14 translate-x-[10px] h-11 w-11 rounded-full bg-black text-white shadow backdrop-blur flex items-center justify-center transform transition-transform duration-200 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-white/40"
            aria-label="Next page"
          >
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
              <path
                d="M9 5l7 7-7 7"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
