import catalog from '@/data/main-record-sections.json'
import type {ProjectSection} from '@/types/project'
import type {RecordKind} from './record-sections'

export function mainRecordSections(kind:RecordKind, row:Record<string,unknown>, hash:string) {
  const entry=catalog[(kind+'/'+row.id) as keyof typeof catalog]
  if (entry?.hash===hash && entry.year===row.year && entry.semester===row.semester) {
    return entry.sections as ProjectSection[]
  }
}
