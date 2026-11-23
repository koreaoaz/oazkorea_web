export type PublicSchedule={id:number;description:string;start_date:string;end_date:string}
export const dateKey=(date:Date)=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`
export function validSchedule(row:PublicSchedule){return /^\d{4}-\d{2}-\d{2}$/.test(row.start_date)&&/^\d{4}-\d{2}-\d{2}$/.test(row.end_date)&&row.start_date<=row.end_date}
export function schedulesInRange(rows:readonly PublicSchedule[],from:string,to:string){return rows.filter(r=>validSchedule(r)&&r.start_date<=to&&r.end_date>=from).sort((a,b)=>a.start_date.localeCompare(b.start_date)||a.end_date.localeCompare(b.end_date)||a.id-b.id)}
export function schedulePreview(description:string){const lines=publicScheduleText(description).trim().split(/\r?\n/).filter(Boolean);return {title:lines[0]||'일정 안내',preview:lines.slice(1).join(' ')}}
// 공개 표시만 정리한다. DB 원문과 Asia/Seoul 시간 계산에는 적용하지 않는다.
export function publicScheduleText(description:string){return description.replace(/[ \t]*\(Asia\/Seoul\)/g,'')}
