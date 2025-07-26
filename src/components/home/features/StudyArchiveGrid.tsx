// components/study/StudyArchiveGrid.tsx

"use client";

import Link from "next/link";

const studySemesters = [
    { label: "2025 1학기", path: "/studies/2025-1" },
    { label: "2024 1학기", path: "/studies/2024-1" },
    { label: "2023 1학기", path: "/studies/2023-1" },
    { label: "2022 1학기", path: "/studies/2022-1" },
    { label: "2024 2학기", path: "/studies/2024-2" },
    { label: "2023 2학기", path: "/studies/2023-2" },
    { label: "2022 2학기", path: "/studies/2022-2" },
    { label: "2021 2학기", path: "/studies/2021-2" },
];

export default function StudyArchiveGrid() {
    return (
        <section className="py-16 px-4 sm:px-6 lg:px-8">
            <div className="max-w-7xl mx-auto">
                <h2 className="text-2xl font-semibold mb-8">지난 스터디</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                    {studySemesters.map((study) => (
                        <Link
                            key={study.label}
                            href={study.path}
                            className="block bg-white rounded-xl border border-gray-200 hover:shadow-md transition-all text-center p-6"
                        >
                            <p className="text-md font-semibold text-gray-800">{study.label}</p>
                            <p className="text-sm text-gray-500 mt-1">스터디 모음</p>
                        </Link>
                    ))}
                </div>
            </div>
        </section>
    );
}
