// app/studies/records/page.tsx
"use client";

import StudyArchiveGrid from "@/components/home/features/StudyArchiveGrid"; // StudyArchiveGrid 불러오기

export default function StudyRecordsPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">스터디 기록</h1>
      <p className="text-gray-600 mb-10">
        연도 및 학기별 스터디 목록이 나와야 하는건데, layout은 정말로 자동 적용이 되는거야??? gpt믿는다???
      </p>

      <StudyArchiveGrid />
    </div>
  );
}