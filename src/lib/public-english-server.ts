import {createHash} from 'node:crypto'
import {readFile} from 'node:fs/promises'
import path from 'node:path'
import sourceHolds from './public-translation-holds.json'
import reviewedNotices from '@/data/reviewed-notice-english.json'
import noticeTitles from '@/data/main-notice-titles.json'

import recordEnglish from '@/data/public-record-english.json'

const currentRecords: Record<string,{sourceHash:string;title:string;body?:string}> = recordEnglish
const model = 'opus-ko-en-0703446-v3'
const root = process.env.OAZ_DESKTOP_DEV==='true' && process.env.LOCALAPPDATA
  ? path.join(process.env.LOCALAPPDATA,'OAZ-Translation','published',model)
  : path.join(process.cwd(),'server-data','public-english',model)
const columns: Record<string, string[]> = {
  editor_0_noti: ['text', 'description'],
  editor_1_projects: ['project_name', 'detailed_description'],
  editor_2_studies: ['study_name', 'outline'],
  editor_4_schedules: ['description', 'description'],
  editor_6_events: ['title', 'description'],
  editor_3_study_timetable: ['study_name'],
  about: ['name','lead','greeting','belief','founded','direction','activities','support'],
}
type Saved = {sourceHash: string | null; fields: Record<string,{hash:string; en:string}>}

async function record(table: string, id: number): Promise<Saved | null> {
  if (!Object.hasOwn(columns, table) || !Number.isSafeInteger(id) || id < 0) return null
  try {
    const data = JSON.parse(await readFile(path.join(root, table, id + '.json'), 'utf8'))
    const hold = (sourceHolds as Record<string,string>)[table + '/' + id]
    if (hold && data.sourceHash === hold) return null
    return data.model === model && data.locale === 'en' && data.fields ? data : null
  } catch { return null }
}

// This is invoked only after the anonymous public metadata RPC authorizes the record.
export async function translatedMeta(table: string, id: number, value: unknown) {
  if (table === 'editor_0_noti' && value && typeof value === 'object' && 'noticeEnglish' in value && value.noticeEnglish === true) {
    if (!('translationStatus' in value) || !['pending','retry'].includes(String(value.translationStatus)) || !('sourceHash' in value)) return value
    if ('fallbackTitle' in value && typeof value.fallbackTitle==='string' && value.fallbackTitle.trim()) return value
    const reviewed = reviewedNotices[String(id) as keyof typeof reviewedNotices]
    const title = reviewed?.sourceHash === value.sourceHash ? reviewed : noticeTitles[String(id) as keyof typeof noticeTitles]
    const cached = !title || title.sourceHash!==value.sourceHash ? await record(table,id) : null
    if(cached?.sourceHash===value.sourceHash && typeof cached?.fields?.text?.en==='string')return {...value,fallbackTitle:cached.fields.text.en}
    return title && title.sourceHash === value.sourceHash && (sourceHolds as Record<string,string>)[table+'/'+id] !== value.sourceHash
      ? {...value, fallbackTitle:title.title} : value
  }
  const notice = table === 'editor_0_noti' && reviewedNotices[String(id) as keyof typeof reviewedNotices]
  if (notice && value && typeof value === 'object' && 'sourceHash' in value && value.sourceHash === notice.sourceHash &&
      'translationStatus' in value && ['missing','stale','automatic'].includes(String(value.translationStatus)) &&
      (sourceHolds as Record<string,string>)[table+'/'+id] !== notice.sourceHash) {
    return {...value, translationStatus: 'reviewed', translation: {title: notice.title, body: notice.body}}
  }
  if (!value || typeof value !== 'object' || !('sourceHash' in value) ||
      typeof value.sourceHash !== 'string' || !('translationStatus' in value) ||
      !['missing','stale'].includes(String(value.translationStatus))) return value
  const edition=currentRecords[table+'/'+id]
  const matchingEdition=edition?.sourceHash === value.sourceHash &&
    (sourceHolds as Record<string,string>)[table+'/'+id] !== value.sourceHash ? edition : undefined
  if (matchingEdition?.body) return {...value, translationStatus:'reviewed', translation:{title:matchingEdition.title,body:matchingEdition.body}}
  const saved = await record(table, id)
  if (!saved || saved.sourceHash !== value.sourceHash) return matchingEdition ? {...value,fallbackTitle:matchingEdition.title} : value
  const [titleField, bodyField] = columns[table]
  const title = matchingEdition?.title ?? saved.fields[titleField]?.en ?? ''
  const body = saved.fields[bodyField]?.en ?? ''
  return {...value, translationStatus:'automatic', translation:{title,body}, translationModel:model}
}

// Match individual fields against the anonymous response, including fields outside the metadata RPC.
export async function englishFields(table:string, id:number, row:Record<string,unknown>) {
  const saved = await record(table,id)
  const english:Record<string,string> = {}
  if (saved) for (const [field, item] of Object.entries(saved.fields)) {
    const source=row[field]
    if (typeof source==='string' && typeof item.en==='string' &&
        item.hash===createHash('sha256').update(source).digest('hex')) english[field]=item.en
  }
  return english
}
