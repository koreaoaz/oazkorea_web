import EventDetail from '../components/EventDetail'

export default function EventArchivePage({params}:{params:Promise<{id:string}>}) {
  return <EventDetail params={params}/>
}
