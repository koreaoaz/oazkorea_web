"use client";


export default function Notification() {
  const notifications = [
    "신공학관 가스 누출 사고로 금일 신공학관 폐쇄",
    "RTX3090, Dram 32gb 장비 추가 (5/2...)",
    "MT 준비위원회 인원 모집 (~6/29)",
    "대원외고 멘토링 봉사자 모집 (~9/12)",
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
