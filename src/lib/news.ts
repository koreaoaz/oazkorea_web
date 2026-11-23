import catalog from '@/data/instagram-news.json'
import {mainPresentation} from './main-presentation'
/** The reviewed import belongs to the isolated 3304, never another database. */
export const importedNews = !mainPresentation()&&process.env.NEXT_PUBLIC_OAZ_FINAL_ACCEPTANCE==='true'&&process.env.NEXT_PUBLIC_OAZ_DESKTOP_INTEGRATION!=='owned-v1'?catalog.entries:[]
export const importedNewsIds:readonly number[]=importedNews.map(row=>row.id)
export const newsSource=(id:number)=>importedNews.find(row=>row.id===id)
export function newsDate(value:string){
 const date=new Date(value)
 if(!Number.isFinite(date.getTime()))return ''
 const parts=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date)
 const get=(type:string)=>parts.find(p=>p.type===type)?.value??''
 return `${get('year')}-${get('month')}-${get('day')}`
}

// A leading edition or event year belongs to the content. The timestamp remains
// the publication date, including for historical records added to the site later.
export function newsContentYear(koreanTitle:string, publishedAt:string) {
 const explicit = /^(\d{4})(?=년(?:\s|$)|[-\s]|$)/.exec(koreanTitle.trim())
 return explicit ? Number(explicit[1]) : Number(newsDate(publishedAt).slice(0,4))
}

type NewsSortKey = {year:number;date:string;key:string}
export function compareNews(a:NewsSortKey,b:NewsSortKey,oldest:boolean) {
 const delta = a.year-b.year || (Date.parse(a.date)||0)-(Date.parse(b.date)||0)
   || a.key.localeCompare(b.key,'en',{numeric:true})
 return oldest ? delta : -delta
}
