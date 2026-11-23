/** 확인된 코드의 실제 마감/발표/총회 날짜. 시작일은 원본에 없으므로 추측하지 않는다. */
export const RECRUITMENT={end:'2026-09-08T23:59:00+09:00',announcement:'2026-09-09',meeting:'2026-09-11',start:null as string|null}
export function recruitmentStatus(now:number,start:string|null,end:string){
 const until=Date.parse(end),from=start?Date.parse(start):null
 if(!Number.isFinite(now)||!Number.isFinite(until)||(from!==null&&(!Number.isFinite(from)||from>until)))return 'unknown'
 if(now>until)return 'closed'
 if(from===null)return 'unknown'
 return now<from?'upcoming':'open'
}
export function koreanDate(now:number){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(now))}
