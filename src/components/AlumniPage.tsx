
import {T} from '@/components/LocaleProvider';
import {HomecomingTabs} from '@/components/HomecomingTabs'
import {ALUMNI_PAGES,EXECUTIVE_TERMS} from '@/data/alumni'
export function AlumniPage({slug}:{slug:typeof ALUMNI_PAGES[number]['slug']}){
 const page=ALUMNI_PAGES.find(p=>p.slug===slug)!
 return <div className="mx-auto max-w-5xl space-y-7 py-10">
  <div><p className="mb-2 text-sm font-semibold text-gray-500">OaZ Alumni</p><h1 className="text-3xl font-bold"><T text={page.title}/></h1></div>
  {slug==='homecoming'?<HomecomingTabs/>:<>
  <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm"><T text="자료 준비 중 · 확인되지 않은 행사 정보와 개인 명단은 표시하지 않습니다."/></p>
  <p className="leading-relaxed text-gray-600"><T text={page.intro}/></p>
  <div className="grid gap-4">{page.sections.map(section=><section data-alumni-section key={section.title} className="rounded-xl border bg-white p-5 sm:p-6"><h2 className="mb-3 text-lg font-semibold"><T text={section.title}/></h2><p className="whitespace-pre-wrap break-words leading-relaxed text-gray-600"><T text={section.body}/></p></section>)}</div>
  {slug==='former-execs'&&EXECUTIVE_TERMS.map(term=><section key={term.years} className="rounded-xl border bg-white p-5"><h2 className="font-semibold">{term.generation} {term.years}</h2><ul>{term.members.map(member=><li key={member.role+member.displayName}>{member.role} · {member.displayName}</li>)}</ul></section>)}
  </>}
 </div>
}
