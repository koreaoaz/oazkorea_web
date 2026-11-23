import type {TechGroup} from '@/lib/project-tech'
export function TechTags({groups,exclude=[]}:{groups?:TechGroup[];exclude?:readonly string[]}) {
  const names=new Set(exclude.map(name=>name.normalize('NFC').toLowerCase()))
  const tags=groups?.filter(group=>!names.has(group.toLowerCase()))
  if (!tags?.length) return null
  return <span data-project-tech className="mt-2 flex flex-wrap gap-1">{tags.map(g=><span key={g} className="rounded-full bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-700">{g}</span>)}</span>
}


export function TechnologyBadges({names}:{names:readonly string[]}) {
  if(!names.length) return null
  return <ul data-technology-names className="flex min-w-0 flex-wrap gap-1.5">
    {names.map(name=><li key={name} className="max-w-full rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-xs text-zinc-700 [overflow-wrap:anywhere]">{name}</li>)}
  </ul>
}
