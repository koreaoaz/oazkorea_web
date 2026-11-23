import type {RawTimetableRow} from '@/types/timetable'
export type StudySlot={id:string;name:string;leader:string;color:string;day:string;startTime:string;endTime:string;startSlot:number;endSlot:number;studyId?:number;outline?:string;englishName?:string}
const days=new Set(['월요일','화요일','수요일','목요일','금요일','토요일'])
function time(value:string|null){
 const match=value?.match(/^(월요일|화요일|수요일|목요일|금요일|토요일) (\d{2}):(00|30)$/)
 if(!match||!days.has(match[1]))return null
 const minutes=Number(match[2])*60+Number(match[3]);if(minutes<9*60||minutes>23*60)return null
 return {day:match[1],minutes,label:match[2]+':'+match[3]}
}
export function parseTimetableRows(rows:readonly RawTimetableRow[]):StudySlot[]{
 const seen=new Set<number>()
 return rows.flatMap(row=>{
  const start=time(row.start_time),end=time(row.end_time)
  if(!Number.isSafeInteger(row.id)||row.id<=0||seen.has(row.id)||!row.study_name?.trim()||!start||!end||start.day!==end.day||start.minutes>=end.minutes)return []
  seen.add(row.id)
  return [{id:String(row.id),name:row.study_name,leader:row.leader??'',color:/^#[0-9a-f]{6}$/i.test(row.color??'')?row.color!:'#6b7280',day:start.day,startTime:start.label,endTime:end.label,startSlot:(start.minutes-9*60)/30,endSlot:(end.minutes-9*60)/30}]
 })
}
