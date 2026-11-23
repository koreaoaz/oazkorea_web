import type {StudySlot} from './timetable'
/** 공개 Room Schedule의 현재 학기. 기존 학기 데이터와 홈 시간표는 독립적으로 보존한다. */
export const CURRENT_ROOM_SEMESTER = {year:2026, semester:2} as const
export type ScheduleStudy={id:number;study_name:string|null;outline:string|null;leader?:string|null;year:number|null;semester:number|null}
export type StudySessionLink={timetableId:number;studyId:number;year:number;semester:number;section:string}
export function linkedStudy(slot:StudySlot,studies:readonly Pick<ScheduleStudy,'id'|'study_name'|'leader'>[],links?:readonly StudySessionLink[]){
 if(links){const match=links.filter(l=>String(l.timetableId)===String(slot.id));return match.length===1?studies.find(s=>s.id===match[0].studyId):undefined}
 const matches=studies.filter(s=>s.study_name===slot.name);return matches.length===1?matches[0]:undefined;
}
/** 유일하게 연결된 스터디의 공개 담당자가 기준이다. 비운 값도 옛 시간표 값으로 되돌리지 않는다. */
export function withStudyLeaders(slots:readonly StudySlot[],studies:readonly Pick<ScheduleStudy,'id'|'study_name'|'leader'>[],links?:readonly StudySessionLink[]):StudySlot[]{
 return slots.map(slot=>{const study=linkedStudy(slot,studies,links);return study?{...slot,leader:study.leader??'',studyId:study.id}:slot})
}
/** 학기는 명시적인 세션 연결을 우선한다. 알 수 없는 학기를 추측하지 않는다. */
export function filterStudySlots(slots:readonly StudySlot[],studies:readonly ScheduleStudy[],links:readonly StudySessionLink[]|undefined,semester:string){
 if(semester==='all')return [...slots]
 return slots.filter(slot=>{
  const relations=links?.filter(l=>String(l.timetableId)===slot.id)
  const source=relations?.length===1?relations[0]:(!links?linkedStudy(slot,studies):undefined)
  const key=source&&'year' in source&&source.year&&source.semester?`${source.year}-${source.semester}`:'unknown'
  return key===semester
 })
}
/** 명시적 FK가 없는 기존 모델. 이름이 유일하게 일치하는 경우만 연결하고 불명확한 연결은 만들지 않는다. */
export function studyTimes(study:ScheduleStudy,studies:readonly ScheduleStudy[],slots:readonly StudySlot[],links?:readonly StudySessionLink[]){
 if(!links&&!study.study_name)return [];
 return slots.filter(slot=>linkedStudy(slot,studies,links)?.id===study.id&&(!links||links.some(l=>String(l.timetableId)===String(slot.id)&&l.year===study.year&&l.semester===study.semester))).sort((a,b)=>['월요일','화요일','수요일','목요일','금요일','토요일'].indexOf(a.day)-['월요일','화요일','수요일','목요일','금요일','토요일'].indexOf(b.day)||a.startSlot-b.startSlot)
}
