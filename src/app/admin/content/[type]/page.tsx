import {notFound} from 'next/navigation'
import {AdminArea} from '../../area'
import {ContentBoard} from '../board'
import {HonorManagement} from '../../honor/management'
import {boardFor} from '@/lib/admin/boards'
export const dynamic='force-dynamic'
export default async function Page({params}:{params:Promise<{type:string}>}){const {type}=await params;if(type==='honor')return <AdminArea><HonorManagement/></AdminArea>;if(!boardFor(type))notFound();return <AdminArea><ContentBoard type={type} mode="list"/></AdminArea>}
