import holidays from '@/data/korean-holidays.json'
const names=holidays as Readonly<Record<string,readonly string[]>>
export const HOLIDAY_YEAR_RANGE=[2018,2027] as const
export function seoulDateKey(date:Date){
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date)
 const field=(key:string)=>parts.find(p=>p.type===key)!.value
 return `${field('year')}-${field('month')}-${field('day')}`
}
export function holidayNames(date:Date){return names[seoulDateKey(date)]??[]}
export function koreanDayColor(date:Date){
 const weekday=new Date(seoulDateKey(date)+'T00:00:00Z').getUTCDay()
 return holidayNames(date).length||weekday===0?'#b91c1c':weekday===6?'#1d4ed8':undefined
}
