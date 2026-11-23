import {TechnologyBadges,TechTags} from '@/components/projects/TechTags'
import {ProjectSections} from '@/components/projects/ProjectSections'
import {PlainTextLinks} from '@/components/PlainTextLinks'
import {usePublicRecordSections} from '@/components/RecordSectionEditor'
import {T,useLocale} from '@/components/LocaleProvider'
import {techGroups,technologyNames} from '@/lib/project-tech'
import {projectAchievements} from '@/lib/project-achievements'
import {sectionKeys,unpackSections} from '@/lib/record-sections'
import type {ContentRow} from './editor'

export function ProjectDetail({row}:{row:ContentRow}){
  const detail=String(row.detailed_description??''), parsed=unpackSections(detail)
  const en=useLocale()==='en'
  const reviewed=usePublicRecordSections('project',{id:row.id,title:String(row.project_name??''),summary:typeof row.description==='string'?row.description:undefined,original:detail})
  const cards=reviewed??parsed?.texts.map((ko,i)=>({kind:sectionKeys[i],ko,en:''}))
  const original=parsed?.original??detail
  const names=technologyNames(row.tech_stack)
  const achievements=projectAchievements(row.achievements)
  const fields=[['학년도',row.year],['학기',row.semester],['분류',row.category],['기간',row.duration],['팀 규모',row.team_size],['팀원',row.members]] as const
  return <div className="min-w-0 space-y-4 [overflow-wrap:anywhere]">
    <dl className="flex flex-wrap gap-x-6 gap-y-2">{fields.map(([label,value])=>(typeof value==='number'||typeof value==='string')&&value!==''&&<div key={label}><dt className="text-xs text-zinc-500"><T text={label}/></dt><dd>{value}</dd></div>)}</dl>
    <TechTags groups={techGroups(row.tech_stack)} exclude={names}/><TechnologyBadges names={names}/>
    {typeof row.description==='string'&&<p className="whitespace-pre-wrap"><PlainTextLinks text={row.description}/></p>}
    {cards?<><ProjectSections sections={cards} english={en&&cards.every(s=>s.en.trim())} body={detail}/>{original&&<details><summary><T text="원문"/></summary><p className="whitespace-pre-wrap"><PlainTextLinks text={original}/></p></details>}</>:detail&&<p className="whitespace-pre-wrap"><PlainTextLinks text={detail}/></p>}
    {achievements.length>0&&<section><h2><T text="성과 및 수상"/></h2><ul>{achievements.map((text,i)=><li key={i} className="whitespace-pre-wrap">{text}</li>)}</ul></section>}
    {typeof row.github_url==='string'&&/^https?:\/\//i.test(row.github_url)&&<a className="underline" href={row.github_url} target="_blank" rel="noopener noreferrer">{row.github_url}</a>}
  </div>
}
