'use client'
import {useEffect,useState} from 'react'
import {useLocale} from './LocaleProvider'
import {packSections,sectionKeys,sectionLabels,unpackSections,type RecordKind} from '@/lib/record-sections'
import type {ProjectSection} from '@/types/project'

type Seed = {id:number; title:string; summary?:string; original:string}
export function usePublicRecordSections(kind:RecordKind,seed?:Seed){
  const [suggestion,setSuggestion]=useState<{key:string;cards:ProjectSection[]}|null>(null)
  const sourceKey=seed?JSON.stringify(seed):''
  useEffect(()=>{
    if(!sourceKey)return
    const snapshot=JSON.parse(sourceKey) as Seed
    const controller=new AbortController()
    const project=kind==='project'
    const table=project?'editor_1_projects':'editor_2_studies'
    const cols=project?'project_name,description,detailed_description':'study_name,outline'
    void fetch('/api/public/data/'+table+'?select=id,year,semester,'+cols+'&id=eq.'+snapshot.id,{signal:controller.signal,credentials:'omit'})
      .then(async r=>r.ok?(await r.json())[0]:null)
      .then(row=>{
        if(!controller.signal.aborted && row?._sections?.length===4 &&
           (project?row.project_name:row.study_name)===snapshot.title &&
           ((project?row.detailed_description:row.outline)??'')===snapshot.original &&
           (!project||(row.description??'')===(snapshot.summary??''))) setSuggestion({key:sourceKey,cards:row._sections})
      }).catch(()=>{})
    return ()=>controller.abort()
  },[kind,sourceKey])
  return suggestion?.key===sourceKey?suggestion.cards:undefined
}

export function RecordSectionEditor({kind,value,onChange,disabled=false,seed}:{kind:RecordKind;value:string;onChange:(value:string)=>void;disabled?:boolean;seed?:Seed}){
  const en=useLocale()==='en'
  const suggested=usePublicRecordSections(kind,seed)
  const saved=unpackSections(value)
  const texts=saved?.texts??suggested?.map(s=>s.ko)??[value,'','','']
  const original=saved?.original??value
  return <fieldset disabled={disabled} className="space-y-3 rounded-xl border border-zinc-200 p-4" data-record-section-editor={kind}>
    <legend className="px-1 font-semibold">{en?'Detail sections':'상세 설명'}</legend>
    {sectionKeys.map((key,i)=><label className="block" key={key}>{sectionLabels[kind][i][en?1:0]}
      <textarea name={kind+'_'+key} rows={3} required={!!saved || !seed} value={texts[i]} onChange={e=>onChange(packSections(texts.map((text,j)=>i===j?e.target.value:text),original))}/>
    </label>)}
    {original&&<details><summary>{en?'Original description':'기존 원문'}</summary><p className="whitespace-pre-wrap break-words">{original}</p></details>}
  </fieldset>
}
