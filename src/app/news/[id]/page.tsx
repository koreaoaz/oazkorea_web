import {notFound} from 'next/navigation'
import {isNewsActivity} from '@/lib/project-activities'
import {releaseNewsIds} from '@/lib/news-release'
import EventDetail from '@/app/events/archive/components/EventDetail'

type Props = {
  params: Promise<{id:string}>
  searchParams: Promise<{lang?:string}>
}

export const dynamic = 'force-dynamic'

export default async function NewsDetail({params,searchParams}: Props) {
  const {id} = await params
  const number = Number(id)
  if (!/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(number)) notFound()
  if (!isNewsActivity({sourceTable:'editor_6_events',id:number}) && !releaseNewsIds().includes(number)) notFound()
  return <EventDetail params={params} newsOnly language={(await searchParams).lang}/>
}
