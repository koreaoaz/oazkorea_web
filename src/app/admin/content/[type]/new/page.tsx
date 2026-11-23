import {notFound} from 'next/navigation'
import {AdminArea} from '../../../area'
import {ContentBoard} from '../../board'
import {boardFor} from '@/lib/admin/boards'
export const dynamic='force-dynamic'
export default async function Page({params}:{params:Promise<{type:string}>}){const {type}=await params;if(!boardFor(type))notFound();return <AdminArea><ContentBoard type={type} mode="new"/></AdminArea>}
