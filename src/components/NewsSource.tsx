import {newsSource} from '@/lib/news'
import {T} from './LocaleProvider'
export function NewsSource({id,verified}:{id:number;verified?:ReturnType<typeof newsSource>}){
 const source=verified??newsSource(id)
 if(!source)return null
 return <aside data-news-source className="mt-8 space-y-2 border-t pt-4 text-sm text-slate-600">
  <p><T text="출처: 하나와영 공식 Instagram @ku_oaz"/></p>
  <a href={source.sourceUrl??source.profileUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center underline"><T text="공식 Instagram 계정 보기"/></a>
  {(source.contactDetailsOmitted||source.omittedMedia>0)&&<p><T text="개인 연락처와 공개 확인이 필요한 일부 자료는 제외했습니다."/></p>}
 </aside>
}
