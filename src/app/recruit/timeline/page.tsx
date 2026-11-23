
import {RecruitHero} from '@/components/RecruitHero'
import {LegacyRecruitAnchor} from '@/components/home/LegacyRecruitAnchor';
import {T} from '@/components/LocaleProvider';
import {RecruitStatus} from "@/components/home/features/RecruitStatus";
import {RECRUITMENT} from "@/lib/recruitment";
import { Metadata } from "next";
import Image from "next/image";

export const metadata: Metadata = {
  title: "Timeline | OaZ",
  description: "고려대학교 소프트웨어 학회 One and Zero 2026 신입 학회원 모집",
};

export default function RecruitmentTimeline() {



  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans selection:bg-blue-100">
      <LegacyRecruitAnchor/>
      {/* 1. 히어로 섹션 */}
      <RecruitHero title={<T text="모집 안내"/>} subtitle={<T text="모집 일정과 지원 방법을 확인하세요."/>}/>

      <div className="max-w-7xl mx-auto py-6 sm:py-8 space-y-8">
        
        <RecruitStatus/>

        {/* 3. 모집 일정 (타임라인) */}
        <section data-recruit-schedule className="space-y-6">
          <h3 className="text-2xl font-bold text-center border-b border-gray-100 pb-6"><T text="2026년 2학기 일정"/></h3>
          <div className="relative flex flex-wrap justify-between gap-8 md:gap-0">
            <div className="hidden md:block absolute top-5 left-0 w-full h-[2px] bg-gray-100 -z-10" />
            
            <TimelineItem date="~ 09.08 (화)" label="서류 모집" />
            <TimelineItem date={`${RECRUITMENT.announcement.slice(5).replace('-','.')} (수)`} label="서류 발표" />
            <TimelineItem date="09.11 (금)" label="개강총회" />
          </div>


        </section>

        {/* 일정 다음: 원본 비율을 유지하는 학회실 안내 */}
          <div data-recruit-room className="bg-gray-50 rounded-2xl overflow-hidden border border-gray-100 flex flex-col md:flex-row shadow-sm">
            <div className="md:w-1/2 bg-gray-100">
               <Image
                src="/106b.jpg" // 이미지 파일명 반영
                alt="하나와영 학회실 위치"
                width={722}
                height={332}
                unoptimized
                loading="eager"
                decoding="auto"
                className="h-auto w-full object-contain"
               />
            </div>
            <div className="md:w-1/2 p-5 flex flex-col justify-center space-y-4">
              <h4 className="text-xl font-bold text-gray-900"><T text="📍 학회실 위치"/></h4>
              <p className="text-gray-600 leading-relaxed">
                <span className="font-semibold text-blue-600"><T text="신공학관 106B호 (하나와영 학회실)"/></span><br /><T text="오시는 길: 신공학관 로비층 엘리베이터 근처에 위치해 있습니다."/></p>
            </div>
          </div>

      </div>
    </div>
  );
}

function TimelineItem({ date, label, isHighlight = false }: { date: string; label: string; isHighlight?: boolean }) {
  return (
    <div className="mobile-timeline-step flex flex-col items-center space-y-4 w-full md:w-1/4">
      <span className={`text-sm font-semibold ${isHighlight ? 'text-blue-600' : 'text-gray-600'}`}><T text={date}/></span>
      <div className={`w-10 h-10 rounded-full flex items-center justify-center border-4 border-white shadow-sm ${isHighlight ? 'bg-blue-500' : 'bg-gray-200'}`}>
        <div className="w-2 h-2 bg-white rounded-full" />
      </div>
      <span className={`text-base font-bold px-5 py-2 rounded-full border ${isHighlight ? 'bg-blue-50 border-blue-100 text-blue-700' : 'bg-white border-gray-100 text-gray-700'}`}>
        <T text={label}/>
      </span>
    </div>
  );
}
