"use client";

import { useEffect, useState } from "react";

export default function VisitorBlock() {
  const [count, setCount] = useState<number>(0);
  const [today, setToday] = useState("");

  useEffect(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    setToday(todayStr);

    const lastVisited = localStorage.getItem("lastVisitDate");
    const totalStr = localStorage.getItem("visitCount");

    let total = totalStr ? parseInt(totalStr) : 0;

    if (lastVisited !== todayStr) {
      total += 1;
      localStorage.setItem("lastVisitDate", todayStr);
      localStorage.setItem("visitCount", total.toString());
    }

    setCount(total);
  }, []);

  return (
    <div className="w-full max-w-sm mx-auto bg-white shadow-md rounded-xl p-6 text-center border border-gray-200 mt-10">
      <img
        src="/block title/daily-visitors-title.png"
        alt="오늘 방문자 수"
        className="mb-2 mx-auto"
    />
      <p className="text-5xl font-bold text-blue-600 mb-2">{count}</p>
      <p className="text-sm text-gray-500">{today}</p>
    </div>
  );
}
