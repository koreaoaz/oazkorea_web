"use client";

import Timetable from "@/components/home/features/Timetable";
import Calendar01 from "@/components/home/features/Calender01";
import FeatureCard from "@/components/home/features/FeatureCard";
import Notification from "@/components/home/features/Notification";
import PersonalTimeTable from "@/components/home/features/PersonalTimeTable";
import ProjectList from "@/components/home/features/ProjectList";
import AlumniIssue from "@/components/home/features/AlumniIssue";
import LineChart from "@/components/home/features/LineChart";
import ImageSlider from "@/components/home/features/ImageSlider";

import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Palette, Accessibility, Zap, Code2, Sparkles } from "lucide-react";
import { motion } from "framer-motion";


export default function FeaturesSection() {
  
 /* 전체 JSX 구조 */
  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        
        {/* 카드 영역 (grid) */}
        <div className="columns-1 md:columns-2 lg:columns-2 gap-8 space-y-8">
          <div className="columns-1 lg:columns-2 gap-8 space-y-8">
            <FeatureCard  className="break-inside-avoid mb-8" contentClassName="p-0">
              {/* 상단 헤더 */}
              <div>
                <h3 className="text-base font-bold text-black bg-gray-100 px-4 py-2 rounded-t-xl shadow-sm">Notification</h3>
              </div>
              <Notification />
            </FeatureCard>

            <FeatureCard contentClassName="p-0" className="break-inside-avoid mb-8">
              {/* 상단 헤더 */}
              <div>
                <h3 className="text-base font-bold text-black bg-gray-100 px-4 py-2 rounded-t-xl shadow-sm">Project Gallery</h3>
              </div>
              <ProjectList />
            </FeatureCard>

            <FeatureCard className="break-inside-avoid mb-8" contentClassName="py-6">
              <img
                src="/block title/study-timetable-title.png"
                alt="Study Timetable"
                className="w-80 mx-auto mb-6"
              />
              <Timetable />
            </FeatureCard>

            <FeatureCard contentClassName="p-0">
              <ImageSlider />
            </FeatureCard>
          </div>

          <div className="columns-1 lg:columns-2 gap-8 space-y-8">
            <FeatureCard className="break-inside-avoid mb-8" contentClassName="py-6">
              <div className="flex flex-col items-center">
                <Calendar01 />
              </div>
            </FeatureCard>

            <FeatureCard className="break-inside-avoid mb-8" contentClassName="p-0">
              <div className="rounded-t-xl overflow-hidden border-t-1 border-gray-150">
                <PersonalTimeTable/>
              </div>
              {/* 하단 헤더 */}
              <div>
                <h3 className="text-base font-bold text-black bg-gray-100 px-4 py-2 rounded-b-xl text-center">겹강-자기 시간표 등록</h3>
              </div>
            </FeatureCard>

            <FeatureCard className="break-inside-avoid mb-8 [column-span:all]" contentClassName="py-12">
              <div className="text-center">
                <h2 className="text-2xl font-bold text-gray-900">누적회원수</h2>
                <p className="text-4xl font-bold text-blue-600 mt-4">12,345</p>
                <p className="text-gray-600 mt-2">총 가입자 수</p>
              </div>
            </FeatureCard>

            <FeatureCard  className="break-inside-avoid mb-8" contentClassName="p-0">
              {/* 상단 헤더 */}
              <div>
                <h3 className="text-base font-bold text-black bg-gray-100 px-4 py-2 rounded-t-xl shadow-sm">회원 경조사</h3>
              </div>
              <AlumniIssue />
            </FeatureCard>

            <FeatureCard  className="break-inside-avoid mb-8" contentClassName="p-0">
              {/* 상단 헤더 */}
              <div>
                <h3 className="text-base font-bold text-black bg-gray-100 px-4 py-2 rounded-t-xl shadow-sm">Line Chart</h3>
              </div>
              <LineChart />
            </FeatureCard>

          </div>
        </div>

        {/* 기존 상단 설명 영역*/}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 mb-6">
            Why choose shadcn/ui?
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            A component library that gives you everything you need to build beautiful, 
            accessible, and customizable user interfaces.
          </p>
        </motion.div>
    
      </div>
    </section>
  );
}