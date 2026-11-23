'use client'


import {AdminSessionLoading} from '@/components/AdminSessionLoading'
import {T,useUIText} from '@/components/LocaleProvider';
import {imageURL} from '@/lib/image-delivery'
import Link from 'next/link'
import Image from 'next/image'
import {useEffect,useRef,useState} from 'react'
import {promotionCommand} from '@/lib/admin/promotion-client'
import {PROMOTION_CATEGORIES,safeApplicationURL,type Draft,type ApprovalResult,type PromotionCommand} from '@/lib/admin/promotion-contract'
import {supabase} from '@/lib/supabaseClient'
import {useUnsavedChanges} from '../../../unsaved'
import {manualMailKey} from '@/lib/promotion-approval-list'
import {MailDetail} from './mail-detail'
import {seoulDateKey} from '@/lib/korean-holidays'
const categoryLabel=(key:string)=>PROMOTION_CATEGORIES[key as keyof typeof PROMOTION_CATEGORIES]??'기타'
const date=(value:string|null|undefined)=>value&&Number.isFinite(Date.parse(value))?new Date(value).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'}):'미등록'
export function PromotionApprovals({draftId}:{draftId:string}){
 const uiText=useUIText();

 const [draft,setDraft]=useState<Draft|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[result,setResult]=useState<ApprovalResult|null>(null)
 const [editing,setEditing]=useState(false),[editTitle,setEditTitle]=useState(''),[editBody,setEditBody]=useState(''),[opens,setOpens]=useState(''),[closes,setCloses]=useState('');
 const pending=useRef(false),retry=useRef<{intent:string;command:PromotionCommand}|null>(null)
 useUnsavedChanges(editing)
 useEffect(()=>{let live=true;void promotionCommand<Draft>({action:'get',id:draftId}).then(data=>{if(live)setDraft(data)}).catch(()=>{if(live)setError('초안을 불러오지 못했습니다.')});return()=>{live=false}},[draftId])
 async function approve(items:{id:string;revision:number}[]){
  if(pending.current||!items.length||!window.confirm(uiText(`선택한 초안 ${items.length}개만 공개 홍보 게시글로 승인할까요? 내용과 마감일을 확인해 주세요.`)))return
  pending.current=true;setBusy(true);setError('')
  try{
   const intent=JSON.stringify(items.toSorted((a,b)=>a.id.localeCompare(b.id)));if(retry.current?.intent!==intent)retry.current={intent,command:{action:'approve',items,requestId:crypto.randomUUID()}}
   const saved=await promotionCommand<ApprovalResult>(retry.current.command);setResult(saved);retry.current=null
   setDraft(await promotionCommand<Draft>({action:'get',id:draftId}))
  }catch(e){setError(e instanceof Error?e.message:'승인 결과를 확인하지 못했습니다. 선택 내용을 유지했습니다.')}finally{pending.current=false;setBusy(false)}
 }
 async function saveEdit(){
  if(!draft||pending.current)return;pending.current=true;setBusy(true);setError('');
  try{await promotionCommand({action:'edit',id:draft.id,revision:draft.revision,title:editTitle,body:editBody,opensOn:opens||null,closesOn:closes||null});setDraft(await promotionCommand<Draft>({action:'get',id:draft.id}));setEditing(false)}
  catch{setError('초안 저장에 실패했습니다. 현재 권한·MFA·수정 충돌을 확인해 주세요. 입력은 유지됩니다.')}
  finally{pending.current=false;setBusy(false)}
 }
 const feedback=result&&<div className="admin-panel space-y-2" role="status">{result.englishPending&&<p><T text="게시되었습니다. 이전에 작성한 영문 초안을 반영하지 못했습니다. 번역 관리에서 현재 영문을 확인할 수 있습니다."/></p>}<p><T text="승인"/>{' '}{result.items.filter(i=>i.status==='approved').length}<T text="개 · 이미 승인"/>{' '}{result.items.filter(i=>i.status==='already_approved').length}<T text="개 · 실패"/>{' '}{result.items.filter(i=>i.status==='failed').length}<T text="개"/></p>{result.items.filter(i=>i.status==='failed').map(i=><p key={i.id} className="break-all text-sm"><T text="초안 #"/>{i.id} · <T text={i.error==='CONFLICT'?'다른 수정과 충돌했습니다.':'자료 검증에 실패했습니다.'}/><T text="승인 대기 항목을 다시 확인해 주세요."/></p>)}</div>
 const metadata=(row:Draft)=><><span className="admin-badge"><T text={row.source_type==='local_fixture'?'로컬 가상 초안':row.source_type==='gmail'?'이메일 출처 초안':'가져온 자료 초안'}/></span><span className="admin-badge"><T text={row.status==='pending'?'승인 대기':'승인 완료'}/></span>{row.closes_on&&row.closes_on<seoulDateKey(new Date())&&<span className="admin-badge"><T text="모집 마감일 지남"/></span>}</>
 if(draft&&manualMailKey(draft))return <MailDetail sourceKey={manualMailKey(draft)!}/>
 return <section className="space-y-5"><Link prefetch={false} className="admin-link-button" href="/admin/content/promotions/approvals"><T text="승인 목록으로"/></Link>{error&&<p role="alert"><T text={error}/></p>}{feedback}{!draft&&!error&&<AdminSessionLoading/>}{draft&&<><article className="admin-panel space-y-5" data-promotion-draft={draft.id}><h1>{draft.title}</h1><div className="flex flex-wrap gap-2">{metadata(draft)}</div><dl className="admin-form-grid">{[['기업·기관',draft.organization],['홍보 분류',categoryLabel(draft.category)],['모집 대상',draft.audience],['지원 시작',draft.opens_on],['지원 마감',draft.closes_on],['생성 시각',date(draft.created_at)],['최근 수정',date(draft.updated_at)],['출처',draft.source_label]].map(([label,value])=><div key={label}><dt className="font-semibold"><T text={label}/></dt><dd className="break-words"><T text={value||'미등록'}/></dd></div>)}</dl>{draft.image_path&&draft.image_public_approved&&<Image src={imageURL('notice-images',draft.image_path,supabase.storage.from('notice-images').getPublicUrl(draft.image_path).data.publicUrl)} alt={uiText("공개 확인된 초안 이미지")} width={900} height={600} unoptimized className="h-auto max-w-full object-contain"/>}<p className="whitespace-pre-wrap break-words">{draft.body}</p>{safeApplicationURL(draft.application_url)?<a className="underline" href={safeApplicationURL(draft.application_url)!} target="_blank" rel="noopener noreferrer"><T text="공식 지원 링크 확인"/></a>:<p className="text-sm text-slate-600"><T text="등록된 지원 링크가 없습니다."/></p>}{!!draft.attachments?.length&&<div><h2><T text="첨부 자료"/></h2><ul>{draft.attachments.map((a,i)=><li key={i}><T text={a.label??'첨부 자료'}/><T text="· 별도 공개 검토 필요"/></li>)}</ul></div>}<p className="text-sm text-slate-600"><T text="초안은 승인 전까지 공개 페이지에 표시되지 않습니다. 최고관리자는 승인 전에 본문과 모집 기간을 검토·수정할 수 있습니다."/></p>{draft.status==='approved'&&<p><T text="승인 관리자:"/><T text={draft.approved_by_slot??'기록 확인 필요'}/> · {date(draft.approved_at)} · <Link className="underline" href={`/about/notice/${draft.published_post_id}`}><T text="발행 이력 #"/>{draft.published_post_id}</Link></p>}</article>
{draft.status==='pending'&&<section className="admin-panel space-y-4">{!editing?<button disabled={busy} onClick={()=>{setEditTitle(draft.title);setEditBody(draft.body??'');setOpens(draft.opens_on??'');setCloses(draft.closes_on??'');setEditing(true)}}><T text="승인 전 초안 수정"/></button>:<><label><T text="제목"/><input value={editTitle} maxLength={300} onChange={e=>setEditTitle(e.target.value)}/></label><label><T text="공개 본문"/><textarea rows={12} maxLength={40000} value={editBody} onChange={e=>setEditBody(e.target.value)}/></label><label><T text="모집 시작"/><input type="date" value={opens} onChange={e=>setOpens(e.target.value)}/></label><label><T text="모집 마감"/><input type="date" value={closes} onChange={e=>setCloses(e.target.value)}/></label><div className="admin-actions"><button disabled={busy||!editTitle.trim()} onClick={()=>void saveEdit()}><T text="수정 저장"/></button><button disabled={busy} onClick={()=>setEditing(false)}><T text="취소"/></button></div></>}</section>}<button disabled={busy||editing||draft.status!=='pending'} onClick={()=>void approve([{id:draft.id,revision:draft.revision}])}><T text={busy?'승인 처리 중…':draft.status==='approved'?'승인 완료':'승인 및 게시'}/></button></>}</section>

}
