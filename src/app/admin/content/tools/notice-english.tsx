'use client'

import {useCallback,useEffect,useRef,useState} from 'react'
import {finalCommand} from '@/lib/admin/final-client'

const table='editor_0_noti'
const labels:Record<string,string>={private:'비공개',pending:'번역 중',retry:'재시도 예정',automatic:'자동 번역 완료',reviewed:'수동 수정 포함'}
type Row={id:number;korean:string;english:string|null;status:string;updated:string|null}
type Previous={id:number;field:'title'|'body';english:string;saved_at:string;manual:boolean}
type Version={source:{title:string;body:string|null};sourceHash:string;revision:number;title:string|null;body:string|null;history:Previous[]}
function date(value:string|null){return value?new Date(value).toLocaleString('ko-KR'):'—'}
function errorText(e:unknown){return e instanceof Error?e.message:'번역을 불러오지 못했습니다.'}

export function NoticeEnglish(){
 const [rows,setRows]=useState<Row[]>([]),[cursor,setCursor]=useState<number[]>([])
 const [selected,setSelected]=useState<{id:number;version:Version}|null>(null)
 const [title,setTitle]=useState(''),[body,setBody]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState('')
 const page=cursor.at(-1)
 const serial=useRef(0)
 const reload=useCallback(async()=>{
   const n=++serial.current
   try{
     const items=await finalCommand<Row[]>({action:'translation.list',table,id:page})
     if(n===serial.current)setRows(items)
   }catch(e){if(n===serial.current)setMessage(errorText(e))}
 },[page])
 useEffect(()=>{
   const timer=setTimeout(()=>void reload(),0)
   return ()=>clearTimeout(timer)
 },[reload])
 useEffect(()=>{
   if(selected||!rows.some(r=>r.status==='pending'||r.status==='retry'))return
   const timer=setInterval(()=>{if(!document.hidden)void reload()},10000)
   return ()=>clearInterval(timer)
 },[rows,reload,selected])
 async function edit(id:number){
   setBusy(true);setMessage('')
   try{
     const version=await finalCommand<Version>({action:'translation.get',table,id})
     setSelected({id,version});setTitle(version.title??'');setBody(version.body??'')
   }catch(e){setMessage(errorText(e))}finally{setBusy(false)}
 }
 async function save(){
   if(!selected||busy)return
   setBusy(true)
   try{
     const {id,version}=selected
     await finalCommand({action:'translation.save',table,id,sourceHash:version.sourceHash,revision:version.revision,title,body})
     setSelected(null);setMessage('영어 번역을 저장했습니다. 게시글의 공개 설정은 유지됩니다.');await reload()
   }catch(e){setMessage(errorText(e))}finally{setBusy(false)}
 }
 return <section className="space-y-4"><h1>영어 번역 관리</h1>
 <p>공개된 공지와 홍보는 자동으로 번역됩니다. 영어만 수정하려면 게시글을 선택하세요.</p>
 {message&&<p role="status">{message}</p>}
 {selected?<form className="admin-panel space-y-4" onSubmit={e=>{e.preventDefault();void save()}}>
 <h2>#{selected.id} 영어 번역 수정</h2><div className="grid gap-6 md:grid-cols-2">
 <section lang="ko" className="min-w-0 space-y-3"><h3>한국어 원문</h3><p className="font-semibold break-words">{selected.version.source.title}</p><p className="whitespace-pre-wrap break-words">{selected.version.source.body}</p></section>
 <section className="min-w-0 space-y-3"><label className="block">영어 제목<input lang="en" required maxLength={500} disabled={busy} value={title} onChange={e=>setTitle(e.target.value)}/></label>
 <label className="block">영어 본문<textarea lang="en" rows={12} required={!!selected.version.source.body?.trim()} maxLength={40000} disabled={busy} value={body} onChange={e=>setBody(e.target.value)}/></label></section></div>
 {selected.version.history.length>0&&<details><summary>이전 번역 복원</summary>{selected.version.history.map(h=><div key={h.id} className="space-y-1 border-t py-2"><p>{date(h.saved_at)} · {h.field==='title'?'제목':'본문'} · {h.manual?'수동':'자동'}</p><p className="whitespace-pre-wrap break-words" lang="en">{h.english}</p><button type="button" disabled={busy} onClick={()=>h.field==='title'?setTitle(h.english):setBody(h.english)}>이 버전 사용</button></div>)}</details>}
 <div className="admin-actions"><button disabled={busy}>저장</button><button type="button" disabled={busy} onClick={()=>{setSelected(null);setMessage('')}}>취소</button></div></form>:
 <><div className="admin-actions"><button onClick={()=>void reload()}>새로고침</button></div>
 <ul className="divide-y">{rows.map(r=><li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div className="min-w-0 break-words"><strong>#{r.id} {r.korean}</strong><p lang="en">{r.english}</p><small>{labels[r.status]??r.status} · {date(r.updated)}</small></div><button disabled={busy} onClick={()=>void edit(r.id)}>영어 번역 수정</button></li>)}</ul>
 <div className="admin-actions">{cursor.length>0&&<button onClick={()=>setCursor(cursor.slice(0,-1))}>이전</button>}{rows.length===50&&<button onClick={()=>setCursor([...cursor,rows[rows.length-1].id])}>다음</button>}</div></>}
 </section>
}
