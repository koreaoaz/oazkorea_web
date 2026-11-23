'use client'
import {unpackSections} from '@/lib/record-sections'
import {publicScheduleText,schedulePreview} from '@/lib/public-schedules'
import {useEffect,useState} from 'react'
import {useLocale} from './LocaleProvider'
import {publicContentRpc} from '@/lib/public-content-rpc'
/** Display-only, reviewed/current translations. Never fabricates a translation of source text. */
export function ContentExcerpt({table,id,body,part,automaticBody}:{automaticBody?:string;table:string;id:number;body:string;part?:"title"|"preview"|"full"}){
 const locale=useLocale(),key=table+':'+id+':'+body,[translated,setTranslated]=useState<{key:string;body:string}|null>(null)
 useEffect(()=>{if(locale!=='en')return;let live=true;void publicContentRpc<{translationStatus:string;translation?:{body:string}}>('oaz_public_content_meta_v1',{tbl:table,rid:id}).then(({data,error})=>{if(live&&!error&&data?.translationStatus==='automatic'&&automaticBody)setTranslated({key,body:automaticBody});else if(live&&!error&&data&&['reviewed','automatic'].includes(data.translationStatus)&&data.translation?.body)setTranslated({key,body:data.translation.body})},()=>{});return()=>{live=false}},[table,id,key,locale,automaticBody])
 const text=locale==='en'&&translated?.key===key?translated.body:body
 if(table==='editor_2_studies'||table==='editor_1_projects'){const saved=unpackSections(text);if(saved)return <>{saved.texts[0]}</>}
 return <>{part==='full'?publicScheduleText(text):part?schedulePreview(text)[part]:text}</>
}
