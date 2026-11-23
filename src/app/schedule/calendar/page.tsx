import Calendar01 from '@/components/home/features/Calender01'
import {LocalizedText} from '@/components/LocaleProvider'

export const metadata={title:'Calendar | OaZ'}
export default async function CalendarPage({searchParams}:{searchParams:Promise<{event?:string|string[]}>}){
 const {event}=await searchParams
 const id=typeof event==='string'&&/^[1-9][0-9]*$/.test(event)&&Number.isSafeInteger(Number(event))?Number(event):undefined
 return <div className="mx-auto max-w-3xl space-y-6 py-8 sm:py-10"><h1 className="text-3xl font-bold">Calendar</h1><p className="text-gray-600"><LocalizedText ko="학회 일정을 날짜별로 확인하고, 일정을 눌러 자세한 내용을 보세요." en="Browse society events by date and select an event for details."/></p><section className="rounded-2xl border bg-white p-4 sm:p-6"><Calendar01 initialEventId={id} expandedList/></section></div>
}
