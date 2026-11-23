import {createHash} from 'node:crypto'
import catalog from '@/data/project-sections.json'
import {mainRecordSections} from './main-record-sections'
import type {ProjectSection} from '@/types/project'

const desktopId: Record<string, keyof typeof catalog> = {'1':'36','2':'35','3':'37','4':'34'}

export function publicProjectSections(row:Record<string,unknown>): ProjectSection[] | undefined {
  const fields = ['project_name','description','detailed_description']
  if (!fields.every(field => Object.hasOwn(row,field))) return
  const hash = createHash('sha256').update(JSON.stringify(fields.map(field=>row[field]))).digest('hex')
  const id = String(row.id)
  const main = mainRecordSections('project',row,hash)
  if (main) return main
  // These four public records have different desktop IDs. Always require the full source hash.
  const entry = catalog[id as keyof typeof catalog] ?? (row.year === 2025 && row.semester === 1 ? catalog[desktopId[id]] : undefined)
  if (entry?.hash === hash) return entry.sections as ProjectSection[]
  // The three distinct desktop activities receive fresh IDs when approved for import.
  if (Number.isSafeInteger(row.id) && Number(row.id)>33 && !desktopId[id]) {
    for (const [key, year, semester] of [['31',2024,2],['32',2026,1],['33',2026,1]] as const) {
      if (row.year===year && row.semester===semester && catalog[key]?.hash===hash) {
        return catalog[key].sections as ProjectSection[]
      }
    }
  }
}

