import {redirect} from 'next/navigation'
export default async function Page({searchParams}:{searchParams:Promise<{lang?:string|string[]}>}){
 const {lang}=await searchParams
 redirect('/alumni/network'+(lang==='en'?'?lang=en':lang==='ko'?'?lang=ko':''))
}
