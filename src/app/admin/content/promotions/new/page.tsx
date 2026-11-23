import {AdminArea} from '../../../area'
import {ContentBoard} from '../../board'
import {PromotionNav} from '../nav'
export const dynamic='force-dynamic'
export default function Page(){return <AdminArea><div className="space-y-6"><PromotionNav active="board"/><ContentBoard type="promotions" mode="new"/></div></AdminArea>}
