export type TrafficStats={day:string;today:number;total:number;refreshMs:number}
export function validStats(value:unknown):value is TrafficStats {
 if(!value||typeof value!=='object')return false
 const s=value as TrafficStats
 return /^\d{4}-\d{2}-\d{2}$/.test(s.day)&&Number.isSafeInteger(s.today)&&s.today>=0&&Number.isSafeInteger(s.total)&&s.total>=s.today&&Number.isInteger(s.refreshMs)&&s.refreshMs>0&&s.refreshMs<=86400000
}
export function publicVisitPath(path:string){
 return path==='/'||/^\/(about|studies|projects|schedule|recruit|community|events|alumni|news|sns|blog)(\/|$)/.test(path)
}
export const healthPath='/api/operations/daily'
export function scheduledCheckLate(last:string|null,started:string,now=Date.now()){
 // Hobby may invoke anywhere within 00:00–00:59 UTC. Allow five minutes for delivery.
 const due=new Date(now);due.setUTCHours(0,0,0,0)
 if(now<due.getTime()+65*60000)due.setUTCDate(due.getUTCDate()-1)
 return Date.parse(started)<due.getTime()&&(!last||Date.parse(last)<due.getTime())
}
