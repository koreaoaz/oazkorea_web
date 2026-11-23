import {createHash} from 'node:crypto'
import catalog from '@/data/study-sections.json'
import {mainRecordSections} from './main-record-sections'
import {savedSections} from './record-sections'
import type {ProjectSection} from '@/types/project'

const desktopIds: Record<string,keyof typeof catalog> = {'1':'31','5':'26','6':'27','7':'28','8':'29','9':'30'}

export function publicStudySections(row:Record<string,unknown>,english?:string):ProjectSection[]|undefined{
  if(typeof row.outline!=='string'||typeof row.study_name!=='string')return
  const saved=savedSections(row.outline,english)
  if(saved)return saved
  const id = String(row.id)
  const hash=createHash('sha256').update(JSON.stringify([row.study_name,row.outline])).digest('hex')
  const main = mainRecordSections('study',row,hash)
  if (main) return main
  const entry=catalog[id as keyof typeof catalog] ?? (row.year === 2025 && row.semester === 1 ? catalog[desktopIds[id]] : undefined)
  if (!entry || row.year !== entry.year || row.semester !== entry.semester) return
  if(entry.hash===hash)return entry.sections as ProjectSection[]
}
