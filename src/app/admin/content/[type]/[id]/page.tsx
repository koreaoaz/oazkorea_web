import {notFound} from 'next/navigation'
import {AdminArea} from '../../../area'
import {ContentBoard} from '../../board'
import {boardFor} from '@/lib/admin/boards'
export const dynamic='force-dynamic'
export default async function Page({params,searchParams}:{params:Promise<{type:string;id:string}>;searchParams:Promise<{saved?:string}>}){const {type,id}=await params;if(!boardFor(type)||!/^\d+$/.test(id)||!Number.isSafeInteger(Number(id))||Number(id)<0)notFound();return <AdminArea><ContentBoard type={type} id={Number(id)} mode="detail" saved={(await searchParams).saved==='1'}/></AdminArea>}
