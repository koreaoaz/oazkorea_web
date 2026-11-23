'use client'
import {useEffect,useRef,useState} from 'react'
import Link from 'next/link'
import {T} from '@/components/LocaleProvider'
import {promotionCommand} from '@/lib/admin/promotion-client'
import {reviewCall,reviewError} from '@/lib/admin/review-client'
import {approvalItems,type MailListItem} from '@/lib/promotion-approval-list'
import {PROMOTION_CATEGORIES,type DraftList} from '@/lib/admin/promotion-contract'

export function ApprovalList(){
 const [drafts,setDrafts]=useState<DraftList|null>(null),[mails,setMails]=useState<MailListItem[]>([]),[cursor,setCursor]=useState<string|null>(null)
 const [status,setStatus]=useState('pending'),[category,setCategory]=useState('all'),[search,setSearch]=useState(''),[page,setPage]=useState(0),[epoch,setEpoch]=useState(0)
 const [draftError,setDraftError]=useState(''),[mailError,setMailError]=useState(''),[loading,setLoading]=useState(true),pending=useRef(false)
 useEffect(()=>{let live=true;const timer=setTimeout(()=>{void promotionCommand<DraftList>({action:'list',status:status==='reviewing'?'pending':status,category,search,page,pageSize:10}).then(r=>{if(live){setDrafts(r);setDraftError('')}}).catch(()=>{if(live)setDraftError('가져온 초안 목록을 불러오지 못했습니다. 현재 승인 권한과 연결을 확인하세요.')})},200);return()=>{live=false;clearTimeout(timer)}},[status,category,search,page,epoch])
 useEffect(()=>{let live=true;void reviewCall('gmail-review',{action:'list'}).then(r=>{if(live){setMails(r.items);setCursor(r.nextCursor);setMailError('')}}).catch(e=>{if(live&&e.message!=='SUPER_ADMIN_AAL2_REQUIRED')setMailError(reviewError(e.message))}).finally(()=>{if(live)setLoading(false)});return()=>{live=false}},[epoch])
 async function more(){if(pending.current||!cursor)return;pending.current=true;setLoading(true);try{const r=await reviewCall('gmail-review',{action:'list',cursor});setMails(old=>[...new Map([...old,...r.items].map((m:MailListItem)=>[m.key,m])).values()]);setCursor(r.nextCursor);setMailError('')}catch(e){setMailError(reviewError(e instanceof Error?e.message:''))}finally{pending.current=false;setLoading(false)}}
 const items=approvalItems(drafts?.rows??[],mails).filter(i=>(status==='all'||status==='pending'&&i.status!=='approved'||i.status===status)&&(category==='all'||i.category===category)&&i.title.toLocaleLowerCase().includes(search.toLocaleLowerCase()))
 const reset=()=>{setPage(0);setDrafts(null)}
 return <section className="space-y-5"><header><h1><T text="홍보 승인"/></h1><p className="mt-2 text-sm text-slate-600"><T text="상세보기에서 게시할 문안·영문·첨부를 확인하고 승인하면 바로 게시됩니다. 원본은 비공개로 보존됩니다."/></p></header>
  <div className="admin-panel admin-form-grid"><label><T text="제목 검색"/><input value={search} maxLength={100} onChange={e=>{reset();setSearch(e.target.value)}}/></label><label><T text="검토 상태"/><select value={status} onChange={e=>{reset();setStatus(e.target.value)}}>{[['pending','승인 대기'],['reviewing','검토중'],['approved','승인 완료'],['all','전체 상태']].map(([v,t])=><option key={v} value={v}><T text={t}/></option>)}</select></label><label><T text="홍보 분류"/><select value={category} onChange={e=>{reset();setCategory(e.target.value)}}><option value="all"><T text="전체 분류"/></option>{Object.entries(PROMOTION_CATEGORIES).map(([v,t])=><option key={v} value={v}><T text={t}/></option>)}</select></label></div>
  <button disabled={loading} onClick={()=>{setLoading(true);setEpoch(n=>n+1)}}><T text="목록 새로고침"/></button>{[draftError,mailError].filter(Boolean).map(e=><p key={e} role="alert"><T text={e}/></p>)}{loading&&<p role="status"><T text="승인 목록을 불러오는 중…"/></p>}
  <ul className="divide-y rounded-xl border bg-white">{items.map(i=><li key={i.id} data-approval-id={i.id} className="flex flex-wrap items-center justify-between gap-3 p-5"><div className="min-w-0 flex-1"><Link prefetch={false} className="break-words font-semibold underline" href={'/admin/content/promotions/approvals/'+i.id}>{i.title}</Link><p className="mt-2 text-sm text-slate-500">{i.date.slice(0,10)} · <T text={i.status==='approved'?'승인 완료':i.status==='reviewing'?'검토중':'승인 대기'}/>{i.source==='fixture'&&<> · <T text="로컬 가상 초안"/></>}</p></div><Link prefetch={false} className="admin-link-button" href={'/admin/content/promotions/approvals/'+i.id}><T text="상세보기"/></Link></li>)}</ul>
  {!loading&&drafts&&!items.length&&<p><T text="현재 조건에 해당하는 초안이 없습니다."/></p>}
  <nav className="admin-actions" aria-label="Approval pages"><button disabled={page===0} onClick={()=>{setDrafts(null);setPage(n=>n-1)}}><T text="이전"/></button><span>{page+1} / {Math.max(1,Math.ceil((drafts?.total??0)/10))}</span><button disabled={!drafts||(page+1)*10>=drafts.total} onClick={()=>{setDrafts(null);setPage(n=>n+1)}}><T text="다음"/></button>{cursor&&<button disabled={loading} onClick={()=>void more()}><T text="다음 수신 자료 보기"/></button>}</nav>
 </section>
}
