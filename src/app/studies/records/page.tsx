// app/studies/records/page.tsx

import StudyArchiveGrid from "@/components/study/StudyArchiveGrid"; // ✅ 불러오기

export default function Page() {
  return (
    <div className="bg-white min-h-screen py-12 px-4">
      <h1 className="text-3xl font-bold mb-8">스터디 기록</h1>
      <p className="text-gray-600 mb-8">년도와 학기별로 지난 스터디를 확인할 수 있습니다.</p>

      <StudyArchiveGrid /> {/* ✅ 사용 */}
    </div>
  );
}

/*
export default function Page() {
  return (
    <div>
      스터디 기록
      년도별로 탭 설정
    </div>
  );
}
  */