import {createHash} from 'node:crypto'
import bindings from '@/data/news-source-bindings.json'
import catalog from '@/data/instagram-news.json'
import {getEventImages} from '@/app/editor/utils/parsing_first'

export function verifiedNewsSource(row:{id:number; title:string|null; filenames:unknown; created_at:string}) {
  const names = getEventImages(row.filenames).sort((a,b)=>a.order-b.order).map(frame=>frame.filename)
  const hash=createHash('sha256').update(JSON.stringify([row.title,row.created_at,names])).digest('hex')
  if (bindings[String(row.id) as keyof typeof bindings]!==hash) return undefined
  return catalog.entries.find(entry=>entry.id===row.id)
}

