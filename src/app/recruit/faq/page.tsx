import type {Metadata} from "next";
import {RecruitHero} from '@/components/RecruitHero'
import {LocalizedText,T} from '@/components/LocaleProvider';
export const metadata:Metadata={title:"FAQ | OaZ"};
export default function RecruitmentFAQ(){return <div className="min-h-screen bg-white text-gray-900 font-sans"><RecruitHero title="FAQ" subtitle={<LocalizedText ko="모집에 관해 자주 묻는 질문" en="Frequently asked questions about recruitment"/>}/><div className="max-w-7xl mx-auto py-6 sm:py-8">
        {/* 질문·순서는 유지하고 요청된 세 번째 답변의 첫 문장만 정정한다. */}
        <section id="faq" data-recruit-faq className="space-y-5">

          <div className="grid gap-4 md:grid-cols-2">
            <FAQItem 
              question="프로젝트 관련 경험이 없어도 되나요?"
              answer="네, 가능합니다. OaZ는 숙련된 경험자가 아니더라도 소프트웨어에 대한 관심과 열정 있는 모든 지원자를 환영합니다."
            />
            <FAQItem 
              question="(면접이 있을 경우) 기술 면접인가요?"
              answer="아닙니다. 면접 과정에서 학습 정도에 대한 질문이 있을 수 있으나, 정해진 답을 요구하는 기술면접은 진행하지 않습니다."
            />
            <FAQItem 
              question="모집 과정 이후에 추가 지원이 가능한가요?"
              answer="불가능합니다. 학기 내 스터디 및 프로젝트 커리큘럼을 위해 정해진 모집 기간 외에는 지원을 받지 않고 있습니다."
            />
            <FAQItem 
              question="합격자만 연락을 받나요?"
              answer="서류 결과, 최종 결과 모두 합격자 및 탈락자 분 모두에게 개별 연락을 드립니다."
            />
          </div>
        </section>


</div></div>}
function FAQItem({ question, answer }: { question: string; answer: string }) {
  return (
    <details open className="group bg-white border border-gray-100 rounded-2xl p-5 hover:border-blue-200 hover:shadow-md transition-all">
      <summary className="text-lg font-bold text-gray-900 cursor-pointer rounded-md focus-visible:outline-2 focus-visible:outline-offset-4">
        <span className="text-blue-500">Q.</span> <T text={question}/>
      </summary>
      <p className="mt-3 text-gray-600 leading-relaxed pl-7 border-l-2 border-gray-100 group-hover:border-blue-100 transition-colors">
        <T text={answer}/>
      </p>
    </details>
  );
}
