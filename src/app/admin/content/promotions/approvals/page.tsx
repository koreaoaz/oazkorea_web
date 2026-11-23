import {AdminArea} from '../../../area'
import {PromotionNav} from '../nav'
import {ApprovalList} from './list'
export const dynamic='force-dynamic'
export default function Page(){return <AdminArea><div className="space-y-6"><PromotionNav active="approvals"/><ApprovalList/></div></AdminArea>}
