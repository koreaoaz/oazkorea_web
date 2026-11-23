'use client'
import {useState} from 'react'
import {supabase} from '@/lib/supabaseClient'
import {T} from '@/components/LocaleProvider'
export function DraftEnglishReview({id,revision}:{id:string;revision:number}){
 const [title,setTitle]=useState(''),[body,setBody]=useState(''),[confirmed,setConfirmed]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState('')
 async function save(){if(busy||!confirmed)return;setBusy(true);setMessage('');try{const {data}=await supabase.auth.getSession();if(!data.session)throw Error();const r=await fetch('/api/admin/gmail-review',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+data.session.access_token},body:JSON.stringify({action:'english',id,revision,title,body,confirmed})});if(!r.ok)throw Error();setMessage('영문 초안 검수본을 비공개로 저장했습니다. 원문을 수정하면 다시 검수해야 합니다.')}catch{setMessage('최고관리자 추가 인증·원문 버전·입력 내용을 확인해 주세요.')}finally{setBusy(false)}}
 return <section className="admin-panel space-y-4"><h2><T text="Gmail 초안 영문 검토"/></h2><p><T text="admin1 추가 인증 후 현재 초안과 대응하는 영문을 저장하세요. 자동 번역·자동 승인은 하지 않습니다."/></p><label>English title<input value={title} maxLength={300} onChange={e=>{setTitle(e.target.value);setConfirmed(false)}}/></label><label>English body<textarea rows={8} value={body} maxLength={30000} onChange={e=>{setBody(e.target.value);setConfirmed(false)}}/></label><label className="flex gap-2"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/><T text="날짜·인명·학기·수치·성과가 원문과 일치함을 검수했습니다."/></label><button disabled={busy||!confirmed||!title.trim()||!body.trim()} onClick={()=>void save()}><T text="영문 초안 검수 저장"/></button>{message&&<p role="status"><T text={message}/></p>}</section>
}
