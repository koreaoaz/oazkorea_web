'use client'
import {useEffect,useState} from 'react'
import {useLocale} from './LocaleProvider'
type Extra={deadline:string;links:{name:string;url:string}[];translationStatus:string}
export function PromotionExtras({id,title,body}:{id:number;title:string;body:string}){
 const locale=useLocale(),[extra,setExtra]=useState<Extra|null>(null),[now,setNow]=useState(()=>Date.now())
 useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),60000);return()=>clearInterval(timer)},[])
 useEffect(()=>{let live=true;void Promise.resolve().then(()=>fetch('/api/public/promotion-copy?id='+id,{cache:'no-store'})).then(r=>r.ok?r.json():null).then(v=>{if(live)setExtra(v)},()=>{});return()=>{live=false}},[id,title,body])
 if(!extra)return null
 const ended=extra.deadline?now>Date.parse(extra.deadline.includes('T')?extra.deadline+':00+09:00':extra.deadline+'T23:59:59+09:00'):false
 return <section className="space-y-3" data-promotion-extras>{extra.deadline&&<p className="text-sm">{locale==='en'?'Application deadline (KST): ':'모집 마감 (한국 시간): '}{extra.deadline.replace('T',' ')}{ended?(locale==='en'?' · Closed':' · 모집 종료'):''}</p>}{extra.links.length>0&&<ul className="space-y-2">{extra.links.map(l=><li key={l.url}><a className="break-all text-blue-700 underline" href={l.url} target="_blank" rel="noopener noreferrer">{l.name}</a></li>)}</ul>}</section>
}
