import {Fragment} from 'react'
import Link from 'next/link'

/** Keep plain text escaped. Only explicit HTTP(S) URLs become links; no HTML/Markdown parser. */
export function PlainTextLinks({text}:{text:string}){
 const parts=text.split(/(https?:\/\/[^\s<>"']+|(?<![\w/])\/about\/notice\/[1-9][0-9]*(?![\w/]))/g)
 return <>{parts.map((part,i)=>{
  if(/^\/about\/notice\/[1-9][0-9]*$/.test(part)&&Number.isSafeInteger(Number(part.split('/').at(-1))))return <Link key={i} href={part} className="break-all text-blue-700 underline">{part}</Link>
  if(!/^https?:\/\//.test(part))return <Fragment key={i}>{part}</Fragment>
  const href=part.replace(/[.,;!?)\]}]+$/,'')
  try{const url=new URL(href);if(!['http:','https:'].includes(url.protocol)||url.username||url.password)throw Error('INVALID_LINK')}
  catch{return <Fragment key={i}>{part}</Fragment>}
  return <Fragment key={i}><a href={href} target="_blank" rel="noopener noreferrer" className="break-all text-blue-700 underline">{href}</a>{part.slice(href.length)}</Fragment>
 })}</>
}
