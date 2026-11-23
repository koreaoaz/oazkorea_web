import {notFound,redirect} from 'next/navigation'
export const dynamic='force-dynamic'
export default async function Page({params}:{params:Promise<{key:string}>}){const {key}=await params;if(!/^[a-f0-9]{64}$/.test(key))notFound();redirect('/admin/content/promotions/approvals/'+key)}
