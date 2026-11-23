'use client'
import {useEffect,useRef,useState} from 'react'
import Link from 'next/link'
import {supabase} from '@/lib/supabaseClient'
import {reviewCall,reviewError,reviewRequest} from '@/lib/admin/review-client'
import {useUnsavedChanges} from '../../../unsaved'
type Copy={title:string;summary:string;body:string;deadline:string;links:{name:string;url:string}[]}
type PDF={fingerprint:string;name:string;status:'ready'|'blocked';source:string}
const empty:Copy={title:'',summary:'',body:'',deadline:'',links:[]}
const warn:Record<string,string>={SENSITIVE_CONTENT_REVIEW:'원문에 민감한 내용이 있어 게시를 보류했습니다. 확인 체크만으로 이 차단을 해제할 수 없습니다.',MIME_CHARSET_UNSUPPORTED:'문자 인코딩을 확인할 수 없어 게시를 보류했습니다.',DEADLINE_CONFLICT:'자료의 모집 날짜가 서로 다릅니다. 확인 후 마감일을 입력하세요.',DEADLINE_YEAR_UNCONFIRMED:'마감일의 연도를 확인할 수 없어 비워 두었습니다.',DEADLINE_NON_DATE:'선착순·상시 등의 모집 안내는 특정 날짜로 바꾸지 않았습니다.',OFFICIAL_SOURCE_UNAVAILABLE:'일부 공식 링크의 내용을 자동으로 확인하지 못했습니다.',OFFICIAL_SOURCE_LIMIT:'일부 링크는 자동 조회 범위를 넘었습니다.',PDF_LIMIT_REVIEW:'첨부 후보가 많아 일부는 자동 확인하지 못했습니다.',LINK_LIMIT_REVIEW:'일부 링크는 자동 입력 범위를 넘었습니다.'}
const errors:Record<string,string>={INVALID_PUBLIC_COPY:'제목·본문·날짜·링크를 확인하세요. 개인정보나 인증정보가 들어간 문안은 저장할 수 없습니다.',PUBLICATION_REVIEW_REQUIRED:'최신 편집본과 마지막 공개 확인을 확인하세요. 선택한 PDF는 최대 10개입니다.',PRIVATE_SELECTION:'게시용 문안에 개인정보·기밀·인증정보가 있는지 확인하세요.',SENSITIVE_SOURCE_REVIEW_REQUIRED:'민감한 원문에 대한 추가 확인이 필요합니다. 아직 게시할 수 없습니다.',PUBLIC_DOCUMENT_REVIEW_REQUIRED:'PDF의 파일명·개인정보·공개 권한을 확인하세요.',GMAIL_LABEL_CHANGED:'메일의 승인 라벨이 변경되었습니다. 승인 목록을 새로 확인하세요.'}
export function MailDetail({sourceKey}:{sourceKey:string}){
 const [copy,setCopy]=useState<Copy>(empty),[ready,setReady]=useState(false),[revision,setRevision]=useState(0),[postId,setPostId]=useState<number|null>(null),[busy,setBusy]=useState(false),[dirty,setDirty]=useState(false),[confirmed,setConfirmed]=useState(false),[blocked,setBlocked]=useState(false),[warnings,setWarnings]=useState<string[]>([]),[message,setMessage]=useState(''),[pdfs,setPDFs]=useState<PDF[]>([]),[selected,setSelected]=useState<string[]>([])
 const lock=useRef(false),attempts=useRef(new Map<string,string>()),fileInput=useRef<HTMLInputElement>(null)
 const [invalid,setInvalid]=useState<string[]>([])
 useUnsavedChanges(dirty&&postId===null)
 useEffect(()=>{let live=true;void reviewCall('gmail-autofill',{action:'get',key:sourceKey}).then(r=>{if(!live)return;setCopy(r.copy);setRevision(r.revision);setPostId(r.postId);setBlocked(r.blocked);setWarnings(r.warnings);setPDFs(r.pdfs);setSelected(r.pdfs.filter((p:PDF)=>p.status==='ready').map((p:PDF)=>p.fingerprint));setReady(true);if(r.manualPreserved)setMessage('기존에 수정한 비공개 초안을 보존했습니다.')}).catch(e=>{if(live)setMessage(errors[e.message]??reviewError(e.message))});return()=>{live=false}},[sourceKey])
 function changed(){setDirty(true);setConfirmed(false)}
 function update<K extends keyof Copy>(key:K,value:Copy[K]){setCopy(c=>({...c,[key]:value}));setInvalid(fields=>fields.filter(f=>f!==key));changed()}
 async function run(task:()=>Promise<void>){if(lock.current)return;lock.current=true;setBusy(true);setMessage('');try{await task()}catch(e){const code=e instanceof Error?e.message:'';setMessage(errors[code]??reviewError(code));setConfirmed(false)}finally{lock.current=false;setBusy(false)}}
 async function send(action:'save'|'publish'){
  const issues:string[]=[]
  if(!copy.title.trim())issues.push('title')
  if(copy.body.trim().length<20)issues.push('body')
  if(copy.links.some(l=>{try{const url=new URL(l.url);return !l.name.trim()||url.protocol!=='https:'||!!url.username||!!url.password}catch{return true}}))issues.push('links')
  setInvalid(issues);if(issues.length)throw Error('INVALID_PUBLIC_COPY')
  const command={action,key:sourceKey,revision,copy,...(action==='publish'?{confirmed,pdfs:selected}:{})},intent=JSON.stringify(command)
  if(!attempts.current.has(intent))attempts.current.set(intent,crypto.randomUUID())
  const r=await reviewCall('gmail-autofill',{...command,requestId:attempts.current.get(intent)})
  setRevision(r.result.revision);setDirty(false)
  if(r.result.postId){setPostId(r.result.postId);setMessage(' 홍보 게시글을 승인하고 게시했습니다.')}else setMessage('비공개 편집본을 저장했습니다.')
 }
 return <section className="mx-auto max-w-4xl space-y-6">
  <Link className="admin-link-button" href="/admin/content/promotions/approvals">승인 목록으로</Link>
  <h1>홍보 게시글 편집 및 승인</h1>
  {message&&<p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">{message}</p>}
  {!ready&&!message&&<p role="status">메일과 연결 자료에서 게시 초안을 준비하고 있습니다…</p>}
  {ready&&(postId!==null?<section className="admin-panel space-y-3"><h2>승인 및 게시 완료</h2><Link className="admin-link-button" href={'/about/notice/'+postId}>게시글 보기</Link><Link className="admin-link-button" href={'/admin/content/promotions/'+postId}>게시글 수정·회수 관리</Link></section>:<>
   {!!warnings.length&&<div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm" role="status">{[...new Set(warnings.map(w=>warn[w]??'일부 자료는 자동 확인하지 못했습니다.'))].map(w=><p key={w}>{w}</p>)}</div>}
   <section className="admin-panel space-y-5">
    <label>제목<input aria-invalid={invalid.includes('title')} value={copy.title} maxLength={300} disabled={busy} onChange={e=>update('title',e.target.value)}/></label>{invalid.includes('title')&&<p className="text-sm text-red-700">게시할 제목을 입력하세요.</p>}
    <label>요약<textarea value={copy.summary} maxLength={2000} rows={3} disabled={busy} onChange={e=>update('summary',e.target.value)}/></label>
    <label>공개 본문<textarea aria-invalid={invalid.includes('body')} value={copy.body} maxLength={25000} rows={14} disabled={busy} onChange={e=>update('body',e.target.value)}/></label>{invalid.includes('body')&&<p className="text-sm text-red-700">공개 본문을 20자 이상 입력하세요.</p>}
    <label>모집 마감일<input type="date" value={copy.deadline.slice(0,10)} disabled={busy} onChange={e=>update('deadline',e.target.value?(e.target.value+(copy.deadline.includes('T')?copy.deadline.slice(10):'')):'')}/></label>
    <label>마감 시각 · 한국 시간 (선택)<input type="time" value={copy.deadline.split('T')[1]??''} disabled={busy||!copy.deadline} onChange={e=>update('deadline',copy.deadline.slice(0,10)+(e.target.value?'T'+e.target.value:''))}/></label>
    <p className="text-sm text-slate-500">마감일이 없는 안내는 비워 두세요.</p>
    <fieldset className="space-y-3"><legend className="font-semibold">공식 관련 링크</legend>
     {invalid.includes('links')&&<p role="alert" className="text-sm text-red-700">링크 이름과 인증정보가 없는 HTTPS 주소를 입력하거나 빈 행을 삭제하세요.</p>}
     {copy.links.map((l,i)=><div key={i} className="grid min-w-0 gap-2 sm:grid-cols-[1fr_2fr_auto]"><input aria-label={'링크 이름 '+(i+1)} value={l.name} maxLength={100} disabled={busy} onChange={e=>update('links',copy.links.map((v,n)=>n===i?{...v,name:e.target.value}:v))}/><input aria-label={'링크 URL '+(i+1)} type="url" value={l.url} maxLength={2048} disabled={busy} onChange={e=>update('links',copy.links.map((v,n)=>n===i?{...v,url:e.target.value}:v))}/><button type="button" disabled={busy} aria-label={'링크 '+(i+1)+' 삭제'} onClick={()=>update('links',copy.links.filter((_,n)=>n!==i))}>삭제</button></div>)}
     <button disabled={busy||copy.links.length>=20} onClick={()=>update('links',[...copy.links,{name:'',url:''}])}>+ 링크 추가하기</button>
    </fieldset>
    <button disabled={busy||blocked} onClick={()=>void run(()=>send('save'))}>변경사항 저장</button>
   </section>
   <section className="admin-panel space-y-4"><h2>PDF 첨부</h2><p className="text-sm text-slate-500">선택한 PDF만 최종 승인 후 공개됩니다. 최대 5MiB·100쪽이며 강의 원본·과제·회원·회계 자료는 첨부할 수 없습니다.</p>
    {!pdfs.length&&<p className="text-sm">첨부된 PDF가 없습니다.</p>}
    {pdfs.map(p=><div key={p.fingerprint} className="flex flex-wrap items-center gap-3 rounded-lg border p-3"><label className="flex min-w-0 flex-1 gap-2"><input type="checkbox" checked={selected.includes(p.fingerprint)} disabled={busy||p.status!=='ready'} onChange={e=>{setSelected(ids=>e.target.checked?[...ids,p.fingerprint]:ids.filter(id=>id!==p.fingerprint));changed()}}/><span className="break-all">{p.name}</span></label>{p.status==='blocked'?<span className="text-sm text-amber-700">안전성·개인정보 확인 필요 · 첨부 불가</span>:<button disabled={busy} onClick={()=>void run(async()=>{const r=await reviewRequest('gmail-autofill',{action:'pdf.download',key:sourceKey,fingerprint:p.fingerprint}),url=URL.createObjectURL(await r.blob()),a=document.createElement('a');a.href=url;a.download=p.name;a.click();setTimeout(()=>URL.revokeObjectURL(url),60000)})}>검토본 받기</button>}<button disabled={busy} onClick={()=>{setPDFs(rows=>rows.filter(x=>x.fingerprint!==p.fingerprint));setSelected(ids=>ids.filter(id=>id!==p.fingerprint));changed()}}>제거</button></div>)}
    <input ref={fileInput} aria-label="PDF 추가" type="file" accept="application/pdf" disabled={busy} onChange={e=>{const file=e.target.files?.[0];if(!file)return;changed();void run(async()=>{if(file.size>5242880)throw Error('PUBLIC_DOCUMENT_REVIEW_REQUIRED');const {data}=await supabase.auth.getSession();if(!data.session)throw Error('AUTH_REQUIRED');const r=await fetch('/api/admin/gmail-autofill',{method:'POST',cache:'no-store',headers:{Authorization:'Bearer '+data.session.access_token,'Content-Type':'application/pdf','x-oaz-review-key':sourceKey,'x-oaz-title':encodeURIComponent(file.name)},body:file});const v=await r.json();if(!r.ok)throw Error(v.error);setPDFs(rows=>rows.some(x=>x.fingerprint===v.pdf.fingerprint)?rows:[...rows,v.pdf]);setSelected(ids=>ids.includes(v.pdf.fingerprint)?ids:[...ids,v.pdf.fingerprint]);if(fileInput.current)fileInput.current.value=''})}}/>
   </section>
   <section className="admin-panel space-y-4"><p className="text-sm text-slate-500">홍보를 게시하면 공개된 한국어 제목과 본문을 자동으로 영어로 번역합니다.</p><label className="flex items-start gap-3"><input type="checkbox" checked={confirmed} disabled={busy||blocked} onChange={e=>setConfirmed(e.target.checked)}/><span>개인정보, 기밀 및 공개에 문제가 없음을 확인했습니다.</span></label><button className="w-full sm:w-auto" disabled={busy||!confirmed||blocked} onClick={()=>void run(()=>send('publish'))}>{busy?'처리 중…':'승인 및 게시'}</button></section>
  </>)}
 </section>
}
