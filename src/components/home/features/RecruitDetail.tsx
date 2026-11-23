"use client";


import {T} from '@/components/LocaleProvider';
import { ExternalLink } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

type Props = { formUrl: string };

export default function RecruitDetail({ formUrl }: Props) {
  return (
    <section className="mx-auto max-w-7xl">
      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6">
        <Card className="bg-white/60 backdrop-blur-sm border-gray-200">
          <CardContent className="p-6">

            <h3 className="text-2xl font-bold mb-4"><T text="하나와영 25-2 학회원 모집 일정"/></h3>

            <div className="space-y-2">
                <p><T text="고려대학교 전기전자공학부 소프트웨어 학회 하나와영(One and Zero)에서 신입 학회원을 모집합니다!"/></p>
            </div>
            <div className="space-y-2 text-gray-700"></div>
            <div className="space-y-2 text-gray-700">
              <p><span className="font-semibold"><T text="모집 기간"/></span> : 2025.08.29 - 2025.09.11</p>
              <p className="flex items-center gap-2">
                <span className="font-semibold"><T text="구글 폼 링크"/></span> :
                <a href={formUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
                  {formUrl}
                </a>
              </p>
            </div>

            <div className="mt-6 space-y-2 text-gray-800">
              <p className="font-semibold"><T text="🧑‍💻 이런 분들께 추천 드립니다"/></p>
              <ul className="list-disc pl-5 space-y-1">
                <li><T text="코딩과 소프트웨어에 관심이 있고 함께 배우며 성장하고 싶은 분"/></li>
                <li><T text="새로운 아이디어를 함께 실현할 팀원을 찾는 분"/></li>
                <li><T text="코딩을 이제 시작하지만 열정적으로 배우고 싶은 분"/></li>
                <li><T text="소프트웨어 관련 프로젝트와 대회에 도전하고 싶은 분"/></li>
              </ul>
            </div>
    
            <div className="pt-6 text-gray-800 leading-relaxed space-y-4">
                <div>
                    <p className="font-semibold"><T text="✨ 하나와영 활동 소개"/></p>
                    <p><T text="학기 중 최소 1개 이상의 스터디 참여를 권장하며, 원하는 주제로 스터디를 직접 개설할 수도 있습니다."/></p>
                        <ul className="list-disc pl-5 space-y-2">
                        <p className="font-semibold"><T text="[지난 학기 운영 스터디]"/></p>
                        <ul className="list-disc pl-5 space-y-1">
                            <li><T text="언어 스터디 : Java 기초, C 언어 기초·중급, Python"/></li>
                            <li><T text="인공지능 스터디 : 자연어처리 입문, AI 논문, 강화학습"/></li>
                            <li><T text="기타 : flutter, 데이터 분석 기초, 언리얼"/></li>
                        </ul>
                        <p className="font-semibold"><T text="[지난 학기 주요 활동]"/></p>
                        <ul className="list-disc pl-5 space-y-1">
                          <li><T text="하나와영 홈커밍데이"/></li>
                          <li><T text="여름 MT"/></li>
                          <li><T text="학회 웹사이트 구축"/></li>
                        </ul>
                    </ul>
                </div>

                <div>
                    <p className="font-semibold"><T text="✨ 이번 학기 예정 스터디"/></p>
                    <li>Python</li>
                    <li><T text="딥러닝 스터디"/></li>
                    <li><T text="웹사이트 생성 프로젝트 (프론트엔드, 디자인)"/></li>
                    <li><T text="게임개발 프로젝트"/></li>
                    <li><T text="* 위 스터디는 추후 사정에 따라 변경, 추가될 수 있습니다."/></li>
                </div>

                <div>
                    <p className="font-semibold"><T text="📅 모집 일정"/></p>
                    <ul className="list-disc pl-5 space-y-1">
                        <li><T text="2025.09.11(목) 11:59pm : 지원서 제출 마감"/></li>
                        <li><T text="2025.09.13(토) : 합격자 발표"/></li>
                        <li><T text="2025.09.15(월) : 개강 총회"/></li>
                    </ul>
                </div>

                <div>
                    <p className="font-semibold"><T text="📝 신청 링크"/></p>
                    <a href={formUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-blue-600 hover:underline">
                        {formUrl} <ExternalLink className="w-4 h-4" />
                    </a>
                </div>

                <div>
                    <p className="font-semibold">❓ FAQ</p>
                    <ul className="list-disc pl-5 space-y-1">
                        <li><T text="신입생, 복학생, 휴학생, 고학번도 지원 가능한가요?"/></li>
                        <p><T text=": 열심히 참여할 의지와 열정 있는 분들이면 누구나 환영입니다!"/></p>
                        <li><T text="전공이 전전이 아닌데 괜찮은가요?"/></li>
                        <p><T text=": 전기전자 전공이 아닌 분들도 참여하실 수 있으니 걱정 말고 지원하세요!"/></p>
                        <li><T text="코딩을 해본 적이 아예 없는데 참여할 수 있나요?"/></li>
                        <p><T text=": 경험이 있다면 더 수월하겠지만 새롭게 시작하더라도 괜찮습니다. 본인의 열정만 있다면 함께 공부할 동료들이 있습니다!"/></p>
                    </ul>
                </div>

                <div>
                    <p className="font-semibold"><T text="📞 기타 궁금한 사항은 편하게 문의주세요 📞"/></p>
                    <p><T text="모집 관련 문의는 아래 QnA 오픈 채팅방을 이용해 주세요."/></p>
                    <p><T text="QnA 오픈 채팅방 : https://open.kakao.com/o/sQdAzFih"/></p>
                </div>
            </div>

            {/* <div className="mt-4">
              <Button variant="outline" onClick={() => setOpen(v => !v)} className="w-full justify-center">
                {open ? <>전문 접기 <ChevronUp className="ml-1 w-4 h-4" /></> : <>전문 보기 <ChevronDown className="ml-1 w-4 h-4" /></>}
              </Button>
            </div>

            <AnimatePresence initial={false}>
              {open && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.35 }}
                  className="overflow-hidden"
                >
                </motion.div>
              )}
            </AnimatePresence> */}
          </CardContent>
        </Card>

      </div>
    </section>
  );
}
