import RecruitCountdownBlock from "@/components/home/features/RecruitCountdownBlock";
import RecruitDetail from "@/components/home/features/RecruitDetail";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Recruitment | OaZ",
  description: "고려대학교 소프트웨어 학회 One and Zero 2026 신입 학회원 모집",
};

export default function RecruitmentPage() {
  const FORM_URL = "https://forms.gle/dk8WUjpeHwyGzeVJ6";
  const DEADLINE = "2026-03-05T23:59:00+09:00";

  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans selection:bg-blue-100">
      {/* 1. 히어로 섹션 */}
      <section className="relative h-[350px] w-full flex flex-col items-center justify-center overflow-hidden border-b border-gray-100">
        <div className="absolute inset-0 bg-white/60 z-10" />
        <img 
          src="/oaz_homecomming.jpg" // 탐색기의 활동 사진 파일로 변경
          alt="Recruit Background"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="relative z-20 text-center space-y-4">
          <h1 className="text-5xl font-extrabold tracking-tight text-gray-900">지원하기</h1>
          <p className="text-gray-600 text-lg font-medium">OaZ에 가입하고 싶으신가요? 언제나 환영입니다.</p>
        </div>
      </section>

      <main className="max-w-4xl mx-auto px-6 py-20 space-y-28">
        
        {/* 2. 현재 상태 알림 & 카운트다운 */}
        <section className="text-center space-y-10">
          <div className="space-y-3">
            <h2 className="text-3xl font-bold text-gray-900">지금은 지원 기간입니다</h2>
            <p className="text-gray-500">이진수의 무한한 가능성, OaZ와 함께할 여러분을 기다립니다.</p>
          </div>
          
          <div className="bg-gray-50 rounded-3xl p-2">
            <RecruitCountdownBlock title="서류 제출 마감까지" deadline={DEADLINE} />
          </div>
          
          <div className="pt-6">
            <a 
              href={FORM_URL}
              target="_blank"
              className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-10 py-4 rounded-full font-bold shadow-lg shadow-blue-200 transition-all hover:-translate-y-1"
            >
              지원서 작성하러 가기
            </a>
          </div>
        </section>

        {/* 3. 모집 일정 (타임라인) */}
        <section className="space-y-16">
          <h3 className="text-2xl font-bold text-center border-b border-gray-100 pb-6">2026년 1학기 일정</h3>
          <div className="relative flex flex-wrap justify-between gap-8 md:gap-0">
            <div className="hidden md:block absolute top-5 left-0 w-full h-[2px] bg-gray-100 -z-10" />
            
            <TimelineItem date="~ 03.05 (목)" label="서류 모집" />
            <TimelineItem date="03.06 (금)" label="서류 발표" isHighlight />
            <TimelineItem date="03.03 ~ 03.06" label="면접 진행" />
            <TimelineItem date="03.08 (일)" label="최종 발표" />
          </div>

          {/* 학회실 위치 섹션 - 이미지 경로 수정 */}
          <div className="mt-16 bg-gray-50 rounded-2xl overflow-hidden border border-gray-100 flex flex-col md:flex-row shadow-sm">
            <div className="md:w-1/2 h-64 bg-gray-200">
               <img 
                src="/106b.jpg" // 이미지 파일명 반영
                alt="하나와영 학회실 위치"
                className="w-full h-full object-cover"
               />
            </div>
            <div className="md:w-1/2 p-8 flex flex-col justify-center space-y-4">
              <h4 className="text-xl font-bold text-gray-900">📍 면접 및 학회실 위치</h4>
              <p className="text-gray-600 leading-relaxed">
                <span className="font-semibold text-blue-600">신공학관 106B호 (하나와영 학회실)</span><br />
                오시는 길: 신공학관 로비층 엘리베이터 근처에 위치해 있습니다. 면접 시간에 맞춰 방문해 주세요.
              </p>
            </div>
          </div>
        </section>

        {/* 4. FAQ 섹션 */}
        <section className="space-y-10">
          <h3 className="text-3xl font-bold text-center">FAQ</h3>
          <div className="grid gap-4">
            <FAQItem 
              question="프로젝트 관련 경험이 없어도 되나요?"
              answer="네, 가능합니다. OaZ는 숙련된 경험자가 아니더라도 소프트웨어에 대한 관심과 열정 있는 모든 지원자를 환영합니다."
            />
            <FAQItem 
              question="기술면접인가요?"
              answer="아닙니다. 면접 과정에서 학습 정도에 대한 질문이 있을 수 있으나, 정해진 답을 요구하는 기술면접은 진행하지 않습니다."
            />
            <FAQItem 
              question="모집 과정 이후에 추가 지원이 가능한가요?"
              answer="아닙니다. 학기 내 스터디 및 프로젝트 커리큘럼을 위해 정해진 모집 기간 외에는 지원을 받지 않고 있습니다."
            />
            <FAQItem 
              question="합격자만 연락을 받나요?"
              answer="서류 결과, 최종 결과 모두 합격자 및 탈락자 분 모두에게 개별 연락을 드립니다."
            />
          </div>
        </section>

      </main>
    </div>
  );
}

function TimelineItem({ date, label, isHighlight = false }: { date: string; label: string; isHighlight?: boolean }) {
  return (
    <div className="flex flex-col items-center space-y-4 w-full md:w-1/4">
      <span className={`text-sm font-semibold ${isHighlight ? 'text-blue-600' : 'text-gray-400'}`}>{date}</span>
      <div className={`w-10 h-10 rounded-full flex items-center justify-center border-4 border-white shadow-sm ${isHighlight ? 'bg-blue-500' : 'bg-gray-200'}`}>
        <div className="w-2 h-2 bg-white rounded-full" />
      </div>
      <span className={`text-base font-bold px-5 py-2 rounded-full border ${isHighlight ? 'bg-blue-50 border-blue-100 text-blue-700' : 'bg-white border-gray-100 text-gray-700'}`}>
        {label}
      </span>
    </div>
  );
}

function FAQItem({ question, answer }: { question: string; answer: string }) {
  return (
    <div className="group bg-white border border-gray-100 rounded-2xl p-7 hover:border-blue-200 hover:shadow-md transition-all">
      <h4 className="text-lg font-bold text-gray-900 flex gap-3">
        <span className="text-blue-500">Q.</span> {question}
      </h4>
      <p className="mt-4 text-gray-600 leading-relaxed pl-7 border-l-2 border-gray-100 group-hover:border-blue-100 transition-colors">
        {answer}
      </p>
    </div>
  );
}