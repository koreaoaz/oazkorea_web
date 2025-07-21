"use client";


export default function AlumniIssue() {
  const notifications = [
    "[부고] 35기 xxx 교수 부친상",
    "[부고] 16기 xxx 모친상",
    "[결혼] 24기 xxx 결혼 공지",
    "[결혼] 6기 xxx 자제 결혼 공지",
  ];

  return (
    <div className="overflow-hidden">

      {/* 본문 영역 */}
      <ul className="px-4 py-3 text-sm text-gray-800 list-disc list-inside space-y-2">
        {notifications.map((item, index) => (
            <li
            key={index}
            className="truncate whitespace-nowrap overflow-hidden"
            >
            {item}
            </li>
        ))}
      </ul>

    </div>
  );
}
