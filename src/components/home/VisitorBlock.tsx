"use client";
import { useState, useSyncExternalStore } from "react";
import { createVisitorResource, getServerVisitorSnapshot } from "@/lib/visitorResource";

export default function VisitorBlock() {
  const [resource] = useState(createVisitorResource);
  const { count, today } = useSyncExternalStore(resource.subscribe, resource.getSnapshot, getServerVisitorSnapshot);

  return (
    <div className="w-full max-w-sm mx-auto bg-white shadow-md rounded-xl p-6 text-center border border-gray-200 mt-10">
      {/* <img
        src="/block title/daily-visitors-title.png"
        alt="오늘 방문자 수"
        className="mb-2 mx-auto"
      /> */}
      <p className="text-5xl font-bold text-blue-600 mb-2">
        {typeof count === "number" ? count : "..."}
      </p>
      <p className="text-sm text-gray-500">{today}</p>
    </div>
  );
}
