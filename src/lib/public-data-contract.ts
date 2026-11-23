/** Explicit public projections. No identity, donor, private schema or RPC forwarding. */
export const PUBLIC_DATA_COLUMNS: Record<string, readonly string[]> = {
  oaz_notice_feed: ['id','text','description','created_at','is_noti','filename','pinned_at','publication_date','attachment_status','schedule_ids'],
  editor_1_projects: ['id','project_name','category','duration','team_size','members','description','created_at','year','semester','detailed_description','tech_stack','achievements','filename','image_url','github_url'],
  editor_2_studies: ['id','study_name','outline','leader','filename','year','semester','created_at'],
  editor_3_study_timetable: ['id','study_name','leader','color','start_time','end_time','created_at'],
  editor_4_schedules: ['id','description','start_date','end_date'],
  editor_6_events: ['id','title','description','filenames','created_at'],
}
export const PUBLIC_DATA_PREFIX = '/api/public/data/'
export function publicDataQuery(table: string, input: URLSearchParams): URLSearchParams | null {
  const fields = Object.hasOwn(PUBLIC_DATA_COLUMNS,table) ? PUBLIC_DATA_COLUMNS[table] : null
  if (!fields || input.toString().length > 8192) return null
  const query = new URLSearchParams(input)
  for (const key of new Set(query.keys())) {
    if (query.getAll(key).length !== 1) return null
    const value = query.get(key)!
    if (key === 'select') {
      const selected = value.replace(/\s/g,'')
      if (selected !== '*' && (!selected || selected.split(',').some(field => !fields.includes(field)))) return null
      query.set(key,selected === '*' ? fields.join(',') : selected)
    } else if (key === 'order') {
      if (!value.split(',').every(part => {
        const [field,...modifiers] = part.split('.')
        return fields.includes(field) && modifiers.length <= 2 && modifiers.every(m => ['asc','desc','nullsfirst','nullslast'].includes(m))
      })) return null
    } else if (key === 'limit' || key === 'offset') {
      if (!/^(0|[1-9]\d*)$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) > (key === 'limit' ? 1000 : 1000000)) return null
    } else if (!fields.includes(key) || !/^(eq|neq|gt|gte|lt|lte|like|ilike|is|in)\.[^\x00-\x1f]+$/.test(value)) return null
  }
  if (!query.has('select')) query.set('select',fields.join(','))
  if (!query.has('limit')) query.set('limit','1000')
  return query
}
