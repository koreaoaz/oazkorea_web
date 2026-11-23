'use client'
import {useLocale} from './LocaleProvider'
import {noticeEnglishStatus,usePublicContentMeta} from './usePublicContentMeta'
/** The public reader selects reviewed or locally generated text for the current source. */
import {noticeHeading} from '@/lib/notice-heading'
export function ContentTitle({table,id,title,isNotice}:{table:string;id:number;title:string;isNotice?:boolean}){
 const locale=useLocale(),key=table+':'+id+':'+title
 const meta=usePublicContentMeta(table,id,key,locale==='en')
 const english=meta&&['reviewed','automatic'].includes(meta.translationStatus??'')?meta.translation?.title:null
 if(locale==='en' && table==='editor_0_noti'){
   return <>{noticeHeading(english || meta?.fallbackTitle || noticeEnglishStatus(meta),isNotice,true)}</>
 }
 return <>{noticeHeading((locale==='en'&&(english||meta?.fallbackTitle))||title,isNotice,locale==='en')}</>
}
