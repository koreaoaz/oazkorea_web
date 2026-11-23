import {AdminArea} from '../../area'
import {ActivityViewer} from './viewer'
export const dynamic='force-dynamic'
export default function Page(){return <AdminArea superOnly><ActivityViewer/></AdminArea>}
