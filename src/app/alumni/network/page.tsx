import Link from 'next/link'
import {LocalizedText} from '@/components/LocaleProvider'

export const metadata={title:'Network | OaZ'}
const topics=[
 {ko:'재학생과 졸업생의 교류',en:'Connecting students and alumni',body:'하나와영은 재학생과 졸업생이 서로의 경험을 나누며 이어지는 학회 공동체입니다.',bodyEn:'OaZ is a society community connecting current students and graduates through shared experiences.'},
 {ko:'졸업 후 진로와 경험 이야기',en:'Life and experience after graduation',body:'졸업한 선배님들의 진로 이야기를 들으며 서로 다른 경험을 접하고 함께 교류합니다.',bodyEn:'Hearing graduates’ career stories brings different experiences into the conversation.'},
]
export default function NetworkPage(){return <div data-alumni-network className="mx-auto max-w-5xl space-y-8 break-keep py-8 [overflow-wrap:anywhere] sm:py-12">
 <header className="rounded-2xl border bg-slate-50 p-6 sm:p-10"><p className="text-sm font-semibold text-slate-500">OaZ Alumni · Network</p><h1 className="mt-3 text-balance text-3xl font-bold leading-snug sm:text-4xl"><LocalizedText ko="하나와영 동문 네트워크" en="OaZ Alumni Network"/></h1><p className="mt-5 max-w-3xl whitespace-pre-line leading-8 text-slate-600"><LocalizedText ko="하나와영은 재학생과 졸업생이 서로의 경험을 나누며 이어지는 학회 공동체입니다." en="OaZ connects current students and graduates through shared experiences."/></p></header>
 <div className="grid gap-5 md:grid-cols-2">{topics.map(t=><section key={t.en} className="rounded-2xl border p-6"><h2 className="text-lg font-semibold"><LocalizedText ko={t.ko} en={t.en}/></h2><p className="mt-4 leading-7 text-slate-600"><LocalizedText ko={t.body} en={t.bodyEn}/></p></section>)}</div>
 <section className="rounded-2xl bg-slate-50 p-6 sm:p-8"><h2 className="text-xl font-semibold"><LocalizedText ko="공식 문의 채널" en="Official contact channels"/></h2><p className="mt-3 leading-7 text-slate-600"><LocalizedText ko="학회 활동과 교류에 관한 문의는 기존 공식 채널을 이용해 주세요." en="Please use the existing official channels for enquiries about society activities and exchanges."/></p><Link href="/sns" className="mt-5 inline-flex rounded-lg bg-slate-900 px-4 py-3 font-medium text-white"><LocalizedText ko="공식 채널 보기" en="View official channels"/></Link></section>
 </div>}
