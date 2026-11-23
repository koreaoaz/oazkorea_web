import {englishFields} from './public-english-server'
import {publicStudySections} from './public-study-sections'
import {savedSections} from './record-sections'
import {publicProjectSections} from './public-project-sections'
import {publicDataQuery} from './public-data-contract'
import {inspectSupabaseConfig} from './supabaseConfig'
const responseHeaders = {'Cache-Control':'no-store, max-age=0','X-Content-Type-Options':'nosniff'}
export async function servePublicData(request: Request, table: string, env: NodeJS.ProcessEnv = process.env, transport: typeof fetch = fetch) {
  const fail = (status: number) => Response.json({message:'PUBLIC_DATA_UNAVAILABLE'}, {status,headers:responseHeaders})
  if (!['GET','HEAD'].includes(request.method)) return fail(405)
  const query = publicDataQuery(table,new URL(request.url).searchParams)
  if (!query) return fail(400)
  const origin = env.NEXT_PUBLIC_SUPABASE_URL, key = env.NEXT_PUBLIC_SUPABASE_KEY
  if (inspectSupabaseConfig(origin,key).some(issue => issue.severity === 'error')) return fail(503)
  // Anonymous key only. Incoming Authorization, cookies, schema/profile, URL and
  // internal-gateway headers never influence the upstream identity or destination.
  const headers = new Headers({apikey:key!,Authorization:'Bearer '+key!,'Accept-Profile':'public'})
  const accept = request.headers.get('accept')
  if (accept && ['application/json','application/vnd.pgrst.object+json'].includes(accept)) headers.set('Accept',accept)
  const prefer = request.headers.get('prefer')
  if (prefer && /^count=(exact|planned|estimated)$/.test(prefer)) headers.set('Prefer',prefer)
  const range = request.headers.get('range')
  if (range) {
    const match = /^(\d+)-(\d+)$/.exec(range)
    if (!match || !Number.isSafeInteger(Number(match[2])) || Number(match[2]) < Number(match[1]) || Number(match[2])-Number(match[1]) >= 1000) return fail(400)
    headers.set('Range',range); headers.set('Range-Unit','items')
  }
  try {
    const result = await transport(new URL('/rest/v1/'+table+'?'+query,origin), {
      method:request.method,headers,cache:'no-store',redirect:'error',
      signal:AbortSignal.any([request.signal,AbortSignal.timeout(20000)]),
    })
    if (!result.ok) return fail(result.status === 406 ? 406 : 503)
    const output = new Headers(responseHeaders)
    output.set('Content-Type','application/json')
    for (const name of ['content-range','range-unit']) {const value=result.headers.get(name);if(value)output.set(name,value)}
    const body = request.method === 'HEAD' ? null : await result.text()
    if (body && new TextEncoder().encode(body).length > 4*1024*1024) return fail(503)
    const english = request.headers.get('x-oaz-public-language')==='en'
    if (body && (table==='editor_1_projects' || table==='editor_2_studies' || (english && table==='editor_3_study_timetable'))) {
      const rows=JSON.parse(body)
      if (Array.isArray(rows)) return Response.json(await Promise.all(rows.map(async row=>{
        const fields=english?await englishFields(table,row.id,row):undefined
        const sections=table==='editor_2_studies'?publicStudySections(row,fields?.outline):
          table==='editor_1_projects'?(savedSections(String(row.detailed_description??''),fields?.detailed_description)??publicProjectSections(row)):undefined
        return {...row,_english:fields,_sections:sections}
      })),{status:result.status,headers:output})
    }
    return new Response(body,{status:result.status,headers:output})
  } catch { return fail(503) }
}
