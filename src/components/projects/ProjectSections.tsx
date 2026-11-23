import {PlainTextLinks} from '@/components/PlainTextLinks'
import {sectionKeys,sectionLabels,type RecordKind} from '@/lib/record-sections'
import type {ProjectSection} from '@/types/project'

export function ProjectSections({sections,english,body,recordKind='project'}:{sections:ProjectSection[];english:boolean;body:string;recordKind?:RecordKind}) {
  const cards=sections.length?sections:[{kind:'overview' as const,ko:body,en:body}]
  return <div data-project-sections={recordKind==='project'?'':undefined} data-record-sections={recordKind} className={recordKind==='project'?'grid items-start gap-3 md:grid-cols-2':'space-y-3'}>
    {cards.map(card=>{
      const index=sectionKeys.indexOf(card.kind)
      return <section key={card.kind} className="min-w-0 rounded-xl bg-zinc-50 p-4 sm:p-5">
        <h4 className="mb-2 flex items-baseline gap-2 text-sm font-semibold text-zinc-900"><span aria-hidden="true" className="font-mono text-xs text-zinc-500">{String(index+1).padStart(2,'0')}</span>{sectionLabels[recordKind][index][english?1:0]}</h4>
        <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere] leading-7 text-zinc-700">{recordKind==='project'?<PlainTextLinks text={english?card.en:card.ko}/>:english?card.en:card.ko}</p>
      </section>
    })}
  </div>
}
