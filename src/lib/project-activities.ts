import type {Project} from '@/types/project'
import {importedNewsIds} from './news'
export type ActivityKind='project'|'hackathon'|'academic'|'community'
export const ACTIVITY_LABELS:Record<ActivityKind,string>={project:'프로젝트',hackathon:'해커톤',academic:'세미나·학술활동',community:'학회 소식'}
export function activityKind(project:Project):ActivityKind{
 const title=project.title+' '+project.category
 if(/해커톤|hackathon|ha:chathon/i.test(title))return 'hackathon'
 if(project.sourceTable==='editor_6_events')return isNewsActivity(project)?'community':'academic'
 return 'project'
}
export const NEWS_EVENT_IDS:readonly number[]=[...new Set([6,7,...importedNewsIds])]
export const isNewsActivity=(p:Pick<Project,'sourceTable'|'id'|'reviewedNews'>)=>p.sourceTable==='editor_6_events'&&(process.env.NEXT_PUBLIC_OAZ_DESKTOP_INTEGRATION==='owned-v1'||p.reviewedNews===true||NEWS_EVENT_IDS.includes(p.id))
export const activityKey=(p:Project)=>(p.sourceTable??'editor_1_projects')+':'+p.id
/** Only exact, nonempty title/body and explicit year/semester matches are aliases.
 * Similar titles or IDs across tables are never evidence of the same activity. */
export function uniqueActivities(rows:readonly Project[]):Project[]{
 const normalize=(s:string)=>s.normalize('NFC').replace(/\s+/g,' ').trim()
 const seen=new Set<string>()
 return rows.filter(p=>{
  const body=normalize(p.detailed_description||p.description),title=normalize(p.title)
  if(!body||!title||!p.year)return true
  const identity=JSON.stringify([title,body,p.year,p.semester??null])
  if(seen.has(identity))return false
  seen.add(identity);return true
 })
}
