'use client'

import {T,useUIText} from '@/components/LocaleProvider';
import {presentationMediaLimit} from '@/lib/main-presentation'
import {useRef,useState} from 'react'
import {supabase} from '@/lib/supabaseClient'
type Document={id:string;title:string;status:string;revision:number;byteCount:number}
export function DocumentTools({table,id}:{table:string;id:string}){
 const uiText=useUIText();

 const [title,setTitle]=useState(''),[rights,setRights]=useState(false),[file,setFile]=useState<File|null>(null),[rows,setRows]=useState<Document[]>([]),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),pending=useRef(false);
 async function token(){const {data}=await supabase.auth.getSession();if(!data.session)throw Error();return data.session.access_token}
 async function command(c:Record<string,unknown>){const r=await fetch('/api/admin/attachments',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+await token()},body:JSON.stringify({...c,requestId:crypto.randomUUID()})});if(!r.ok)throw Error();return (await r.json()).result}
 async function refresh(){if(!/^\d+$/.test(id))throw Error();setRows(await command({action:'list',table,recordId:Number(id)}))}
 async function run(fn:()=>Promise<void>){if(pending.current)return;pending.current=true;setBusy(true);setMessage('');try{await fn()}catch{setMessage('문서 처리를 완료하지 못했습니다. 권한·공개 목적·파일 형식·수정 충돌을 확인해 주세요.')}finally{pending.current=false;setBusy(false)}}
 return <section className="admin-panel space-y-4"><h2><T text="일반 공개 PDF 첨부"/></h2><p><T text={`위에서 선택한 게시물에 연결합니다. 강의·과제·회원·회계 문서는 금지합니다. 최대 ${presentationMediaLimit()/1024/1024}MiB·100쪽이며 링크·양식·스크립트가 있는 PDF는 거부됩니다. 업로드 후 비공개 검토 상태로 보관됩니다.`}/></p>
 <label><T text="공개 문서 제목"/><input value={title} maxLength={100} onChange={e=>setTitle(e.target.value)}/></label><input type="file" accept="application/pdf" aria-label={uiText("일반 공개 PDF")} disabled={busy} onChange={e=>{setFile(e.target.files?.[0]??null);setRights(false)}}/>
 <label className="flex items-start gap-2"><input type="checkbox" checked={rights} onChange={e=>setRights(e.target.checked)}/><T text="일반 공개 문서이며 개인정보·강의·과제 원문이 없고 저작권과 공개 권한을 확인했습니다."/></label>
 <div className="admin-actions"><button disabled={busy||!file||!rights||!title.trim()} onClick={()=>void run(async()=>{if(!file||file.size>presentationMediaLimit()||!/^\d+$/.test(id))throw Error();const r=await fetch('/api/admin/attachments',{method:'POST',headers:{Authorization:'Bearer '+await token(),'Content-Type':'application/pdf','x-oaz-table':table,'x-oaz-record-id':id,'x-oaz-title':encodeURIComponent(title),'x-oaz-public-rights':'general-public-document'},body:file});if(!r.ok)throw Error();await refresh();setMessage('비공개 업로드 완료. 검토본을 확인한 후 별도로 공개 승인해 주세요.')})}><T text="비공개 업로드"/></button><button disabled={busy} onClick={()=>void run(refresh)}><T text="문서 목록 조회"/></button></div>
 {message&&<p role="status"><T text={message}/></p>}{rows.map(d=><article key={d.id} className="space-y-2 border-t pt-3"><h3>{d.title} · {d.status}</h3><div className="admin-actions"><button disabled={busy} onClick={()=>void run(async()=>{const r=await fetch(`/api/documents/${d.id}?preview=1`,{headers:{Authorization:'Bearer '+await token()}});if(!r.ok)throw Error();const url=URL.createObjectURL(await r.blob()),a=document.createElement('a');a.href=url;a.download='oaz-review.pdf';a.click();setTimeout(()=>URL.revokeObjectURL(url),60000)})}><T text="검토본 받기"/></button>{d.status==='pending'&&<button disabled={busy||!rights} onClick={()=>void run(async()=>{if(!confirm(uiText('검토한 이 일반 PDF만 공개 다운로드로 제공할까요?')))return;await command({action:'approve',id:d.id,revision:d.revision,rightsConfirmed:true});await refresh()})}><T text="공개 승인"/></button>}{d.status==='approved'&&<button disabled={busy} onClick={()=>void run(async()=>{await command({action:'revoke',id:d.id,revision:d.revision});await refresh()})}><T text="공개 회수"/></button>}</div></article>)}
 </section>
}
