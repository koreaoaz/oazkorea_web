import {notFound} from 'next/navigation'
import {UUID_PATTERN} from '@/lib/admin/protocol'
import {AdminArea} from '../../../../area'
import {PromotionNav} from '../../nav'
import {PromotionApprovals} from '../review'
import {MailDetail} from '../mail-detail'
export const dynamic='force-dynamic'
export default async function Page({params}:{params:Promise<{draftId:string}>}){const {draftId}=await params;const mail=/^[a-f0-9]{64}$/.test(draftId);if(!mail&&!UUID_PATTERN.test(draftId))notFound();return <AdminArea superOnly={mail}><div className="space-y-6"><PromotionNav active="approvals"/>{mail?<MailDetail key={draftId} sourceKey={draftId}/>:<PromotionApprovals key={draftId} draftId={draftId}/>}</div></AdminArea>}
