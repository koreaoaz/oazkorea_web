"use client";

import { useEffect, useState } from "react";

export default function VisitorBlock() {
  const [count, setCount] = useState<number | null>(null);
  const [today, setToday] = useState("");

  useEffect(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    setToday(todayStr);

    const lastVisited = localStorage.getItem("lastVisitDate");

    if (lastVisited !== todayStr) {
      fetch("/api/visitor", { method: "POST" })
        .then((res) => res.json())
        .then((data) => {
          console.log("✅ POST 응답:", data);
          setCount(data.count);
          localStorage.setItem("lastVisitDate", todayStr);
        })
        .catch((err) => {
          console.error("❌ POST 실패", err);
          setCount(-1);
        });
    } else {
      fetch("/api/visitor")
        .then((res) => res.json())
        .then((data) => {
          console.log("📦 GET 응답:", data);
          setCount(data.count);
        })
        .catch((err) => {
          console.error("❌ GET 실패", err);
          setCount(-1);
        });
    }
  }, []);

  return (
    <div className="w-full max-w-sm mx-auto bg-white shadow-md rounded-xl p-6 text-center border border-gray-200 mt-10">
      <img
        src="/block title/daily-visitors-title.png"
        alt="오늘 방문자 수"
        className="mb-2 mx-auto"
      />
      <p className="text-5xl font-bold text-blue-600 mb-2">
        {typeof count === "number" ? count : "..."}
      </p>
      <p className="text-sm text-gray-500">{today}</p>
    </div>
  );
}
