'use client'
import {useLocale} from '@/components/LocaleProvider'
import {TECH_GROUPS, stackObject, techGroups} from '@/lib/project-tech'

export function TechPicker({value, descriptions=[], disabled=false, onChange}:{value:unknown; descriptions?:unknown[]; disabled?:boolean; onChange:(next:Record<string,unknown>)=>void}) {
  const en=useLocale()==='en'
  const selected=techGroups(value,descriptions)
  return <fieldset disabled={disabled}><legend className="mb-2">{en?'Technology categories':'사용 기술 분류'}</legend><div className="flex flex-wrap gap-2">{TECH_GROUPS.map(group=><label key={group} className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm has-checked:border-black has-checked:bg-zinc-100">
    <input type="checkbox" checked={selected.includes(group)} onChange={event=>onChange({...stackObject(value),groups:event.target.checked?[...selected,group]:selected.filter(g=>g!==group)})}/>{group}
  </label>)}</div></fieldset>
}

