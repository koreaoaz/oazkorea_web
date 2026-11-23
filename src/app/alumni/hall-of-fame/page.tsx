import Donators from '@/components/home/features/Donators'
import {LocalizedText} from '@/components/LocaleProvider'

export const metadata={title:'Hall of Fame | OaZ'}
export default function HallOfFamePage(){return <div data-alumni-honor className="mx-auto max-w-5xl space-y-8 py-8 sm:py-12">
 <header className="rounded-2xl border bg-slate-50 p-6 sm:p-10"><p className="text-sm font-semibold text-slate-500">OaZ Alumni · Hall of Fame</p><h1 className="mt-3 text-3xl font-bold sm:text-4xl"><LocalizedText ko="명예의 전당" en="Hall of Fame"/></h1><p className="mt-5 max-w-3xl break-keep leading-8 text-slate-600"><LocalizedText ko="하나와영에 따뜻한 관심과 도움을 보내주신 분들께 감사의 마음을 전하는 공간입니다. 학회 활동을 지켜봐 주시고 함께해 주셔서 진심으로 감사드립니다." en="A place to thank those who have supported OaZ with their care and contributions. We sincerely appreciate your interest and involvement in our society’s activities."/></p><p className="mt-2 text-sm text-slate-600"><LocalizedText ko="※ 이름은 가나다순으로 정렬하였습니다." en="※ Names are listed in Korean alphabetical order."/></p></header>
 <Donators showHeading={false} detailed/>
 </div>}
