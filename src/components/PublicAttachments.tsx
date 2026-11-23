'use client'
import {useEffect,useState} from 'react'
import {publicContentRpc} from '@/lib/public-content-rpc'
import {useLocale} from './LocaleProvider'
type Document={id:string;title:string;byteCount:number}
export function PublicAttachments({table,id}:{table:string;id:number}){
 const [rows,setRows]=useState<Document[]>([]),en=useLocale()==='en';
 useEffect(()=>{let live=true;void publicContentRpc<Document[]>('oaz_public_attachments_v1',{tbl:table,rid:id}).then(({data,error})=>{if(live)setRows(error?[]:data??[])});return()=>{live=false}},[table,id]);
 if(!rows.length)return null;
 return <section className="space-y-3 border-t pt-5"><h2 className="font-semibold">{en?'Approved public documents':'공개 승인 문서'}</h2><ul>{rows.map(d=><li key={d.id}><a className="underline" href={`/api/documents/${d.id}`}>{d.title} · PDF ({Math.ceil(d.byteCount/1024)} KiB)</a></li>)}</ul></section>
}
