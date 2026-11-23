
import {T} from '@/components/LocaleProvider';
import StudySchedule from '@/components/StudySchedule'
export default function Page(){return <div className="mx-auto max-w-6xl px-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 sm:px-4 sm:pt-3 space-y-2"><h1 className="text-xl sm:text-2xl font-bold"><T text="학회실 스터디 사용 시간표"/></h1><StudySchedule/></div>}
