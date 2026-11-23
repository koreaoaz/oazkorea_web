import {notFound} from 'next/navigation'
import {AdminArea} from '../../../../area'
import {ContentBoard} from '../../../board'
import {PromotionNav} from '../../nav'
export const dynamic='force-dynamic'
export default async function Page({params}:{params:Promise<{id:string}>}){const {id}=await params;if(!/^[1-9][0-9]*$/.test(id)||!Number.isSafeInteger(Number(id)))notFound();return <AdminArea><div className="space-y-6"><PromotionNav active="board"/><ContentBoard type="promotions" mode="edit" id={Number(id)}/></div></AdminArea>}
