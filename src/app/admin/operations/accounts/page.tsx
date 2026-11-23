import {AdminArea} from '../../area'
import {AdminAccounts} from '../../accounts/management'
export const dynamic='force-dynamic'
export default function Page(){return <AdminArea superOnly><AdminAccounts/></AdminArea>}
