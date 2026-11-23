'use client'
import {noticeEnglishStatus,usePublicContentMeta} from './usePublicContentMeta'
import {PublicAttachments} from './PublicAttachments'
import {PromotionExtras} from './PromotionExtras'
import {useLocale} from './LocaleProvider'
import type {ProjectSection} from '@/types/project'
import {unpackSections,savedSections} from '@/lib/record-sections'
import {ProjectSections} from './projects/ProjectSections'
import {noticeHeading} from '@/lib/notice-heading'
import {PlainTextLinks} from './PlainTextLinks'
/** Render current public translations as text, retaining access to the original. */
export function TranslatedContent({table,id,title,body,automaticBody,sections,promotion=false,heading=true,linkify=false}:{table:string;id:number;title:string;body:string;automaticBody?:string;sections?:ProjectSection[];promotion?:boolean;heading?:boolean;linkify?:boolean}){
 const locale=useLocale(),key=JSON.stringify([table,id,title,body])
 const meta=usePublicContentMeta(table,id,key)
 const current=meta?.translationStatus==='automatic'&&automaticBody&&meta.translation?{...meta.translation,body:automaticBody}:meta?.translation
 const translated=locale==='en'&&meta&&['reviewed','automatic'].includes(meta.translationStatus??'')&&(!body||current?.body)?current:null
 const kind=table==='editor_2_studies'?'study':'project'
 const original=unpackSections(body)?.original || (unpackSections(body)?.texts.join('\n\n')??body)
 const reviewed=translated&&meta?.translationStatus==='reviewed'?translated.body:undefined
 const parsed=savedSections(body,translated?.body)
 const aligned=parsed?.every(s=>s.en)?parsed:sections??parsed
 const englishCards=locale==='en' && aligned?.length===4 && aligned.every(s=>s.en.trim())?aligned:undefined
 const reviewedText=reviewed&&!unpackSections(reviewed)?reviewed:undefined
 const bodyText=(text:string)=>linkify?<PlainTextLinks text={text}/>:text
 const day=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul'}).format(new Date())
 const status=meta?.closesOn?(meta.closesOn<day?(locale==='en'?'Recruitment closed':'모집 종료'):(locale==='en'?'Closes ':'마감 ')+meta.closesOn):(locale==='en'?'Deadline unconfirmed':'모집 기간 미확인')
 const waitingForNotice = locale==='en' && table==='editor_0_noti' && !translated
 const noticePlaceholder = waitingForNotice ? <>
   <div lang="en">
     {heading && meta?.fallbackTitle && <h1 className="mb-4 break-words text-2xl font-bold">{noticeHeading(meta.fallbackTitle,!promotion,true)}</h1>}
     <p role="status" className="text-sm text-slate-600">{noticeEnglishStatus(meta)}</p>
   </div>
   <details lang="ko">
     <summary lang="en" className="cursor-pointer text-sm underline">Korean original</summary>
     <h3 className="mb-3 font-semibold">{title}</h3>
     <p className="whitespace-pre-wrap break-words">{bodyText(body)}</p>
   </details>
 </> : null
 return <section className="space-y-4" data-translated-content={id}>
 {promotion&&<p className="inline-flex rounded-full border bg-slate-50 px-3 py-1 text-sm" data-promotion-deadline>{status}</p>}
 {meta?.activityOn&&<p className="text-sm">{locale==='en'?'Activity date: ':'활동일: '}{meta.activityOn}</p>}
 {noticePlaceholder ?? (englishCards?<><div lang="en">{heading&&<h1 className="text-2xl font-bold">{translated?.title??meta?.fallbackTitle??title}</h1>}{reviewedText&&<p className="mb-4 whitespace-pre-wrap">{bodyText(reviewedText)}</p>}<ProjectSections sections={englishCards} english recordKind={kind} body={body}/></div><details key={key} lang="ko"><summary lang="en" className="cursor-pointer text-sm underline">Korean original</summary><p className="whitespace-pre-wrap break-words">{bodyText(original)}</p></details></>:translated?<><div lang="en">{heading&&<h1 className="mb-4 break-words text-2xl font-bold">{noticeHeading(translated.title, table==='editor_0_noti'?!promotion:undefined,true)}</h1>}{sections?<ProjectSections sections={[]} english recordKind={kind} body={unpackSections(translated.body)?.texts.join('\n\n')??translated.body}/>:<p className="whitespace-pre-wrap break-words">{bodyText(translated.body)}</p>}</div>{meta?.translationStatus==='automatic'&&<p className="text-xs text-gray-500">{sections?.length?'Automatically translated title':'Machine translation'} · <a className="underline" href="https://huggingface.co/Helsinki-NLP/opus-mt-tc-big-ko-en" target="_blank" rel="noreferrer">Helsinki-NLP OPUS-MT</a> (CC BY 4.0)</p>}<details lang="ko" aria-label="한국어 원문"><summary lang="en" className="cursor-pointer text-sm underline">Korean original</summary><h3 className="mb-3 font-semibold">{title}</h3><p className="whitespace-pre-wrap break-words">{bodyText(body)}</p></details></>:<div lang="ko">{locale==='en'&&<p role="status" className="mb-3 text-sm text-slate-600">{meta?.translationStatus==='pending'?'English translation is in progress. The Korean original is shown below.':meta?.translationStatus==='retry'?'English translation will be retried. The Korean original is shown below.':promotion?'This promotion is provided in Korean.':meta?.translationStatus==='stale'?'The original has changed. The English translation requires review.':'English translation is not available. The Korean original is shown below.'}</p>}{heading&&<h1 lang={locale==='en'&&meta?.fallbackTitle?'en':undefined} className="mb-4 break-words text-2xl font-bold">{noticeHeading((locale==='en'&&meta?.fallbackTitle)||title,table==='editor_0_noti'?!promotion:undefined,locale==='en')}</h1>}{aligned?<ProjectSections sections={aligned} english={false} recordKind={kind} body={body}/>:<p className="whitespace-pre-wrap break-words">{bodyText(body)}</p>}</div>)}
 {promotion&&<PromotionExtras id={id} title={title} body={body}/>}
 <PublicAttachments table={table} id={id}/>
 </section>
}
