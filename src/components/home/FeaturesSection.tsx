"use client";

import Timetable from "@/components/home/features/Timetable";
import Calendar01 from "@/components/home/features/Calender01";
import FeatureCard from "@/components/home/features/FeatureCard";
import Notification from "@/components/home/features/Notification";
import PersonalTimeTable from "@/components/home/features/PersonalTimeTable";
import ProjectList from "@/components/home/features/ProjectList";

import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Palette, Accessibility, Zap, Code2, Sparkles } from "lucide-react";
import { motion } from "framer-motion";


export default function FeaturesSection() {
  
 /* 전체 JSX 구조 */
  return (
    <section className="pt-10 pb-80 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">

        {/* 카드 영역 (grid) */}
        <div className="grid grid-cols-1 lg:grid-cols-[1.3fr_1fr] gap-8">
        {/* 왼쪽 column */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* 왼쪽 column_0 */}
            <div className="flex flex-col">
              <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} viewport={{ once: true }}>
                <h3 className="text-base font-bold mb-2" style={{ fontFamily: "Inter, sans-serif", fontSize: "20px" }} >스터디 시간표</h3>
              </motion.div>
              <FeatureCard className="break-inside-avoid mb-8" contentClassName="p-0">
                <Timetable />
              </FeatureCard>
            </div>
            {/* 왼쪽 column_1 */}
            <div className="flex flex-col">
              <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} viewport={{ once: true }}>
                <h3 className="text-base font-bold mb-2" style={{ fontFamily: "Inter, sans-serif", fontSize: "20px" }} >공지</h3>
              </motion.div>
              <FeatureCard  className="break-inside-avoid mb-8" contentClassName="p-0">
                <Notification />
              </FeatureCard>

              <FeatureCard contentClassName="p-0" className="break-inside-avoid mb-8">
                <div>
                  <h3 className="text-base font-bold text-black bg-gray-100 px-4 py-2 rounded-t-xl">Project Gallery</h3>
                </div>
                <ProjectList />
              </FeatureCard>
            </div>
          </div>

           {/* 오른쪽 column */}
          <div className="grid grid-cols-1 lg:grid-cols-2">
            {/* 오른쪽 column_0 */}
            {/* <div className="flex flex-col gap-8">
            </div> */}
            {/* 오른쪽 column_1 */}
            {/* <div className="flex flex-col gap-8">
            </div> */}
            <FeatureCard className="break-inside-avoid mb-8 lg:col-span-2" contentClassName="py-6">
                <div className="flex flex-col items-center">
                  <Calendar01 />
                </div>
              </FeatureCard>
            <FeatureCard className="break-inside-avoid mb-8 [column-span:all] lg:col-span-2" contentClassName="py-12">
              <div className="text-center">
                <h2 className="text-2xl font-bold text-gray-900">누적회원수</h2>
                <p className="text-4xl font-bold text-blue-600 mt-4">12,345</p>
                <p className="text-gray-600 mt-2">총 가입자 수</p>
              </div>
            </FeatureCard>
        
          </div>
        </div>
      </div>
    </section>
  );
}