import {T} from '@/components/LocaleProvider'
import {TimetableDemo} from '@/components/home/features/Timetable'
import {CURRENT_ROOM_SEMESTER} from '@/lib/study-schedule'

export default function StudySchedule() {
  return <section className="rounded-xl border bg-white p-2 sm:p-3">
    <header className="mb-2 flex flex-wrap items-baseline gap-x-4 gap-y-0.5"><h2 className="text-base font-bold"><T text={`${CURRENT_ROOM_SEMESTER.year}년 ${CURRENT_ROOM_SEMESTER.semester}학기`}/></h2>
    <p className="text-xs text-gray-600"><T text="각 스터디를 클릭하면 상세 정보를 확인할 수 있습니다."/></p></header>
    <div data-room-weekly-frame className="min-w-0">
      <TimetableDemo wide showHint={false}/>
    </div>
  </section>
}
