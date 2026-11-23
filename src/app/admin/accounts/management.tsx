'use client'

import {useUnsavedChanges} from '../unsaved'
import {AdminSessionLoading} from '@/components/AdminSessionLoading'
import {T,useUIText} from '@/components/LocaleProvider';
import {rolePasswordClient} from '@/lib/admin/role-password-policy'
import {PasswordManagement} from './password-management'
import {AccountRecovery} from './recovery'
import {AccountCredentials} from './credentials'
import {AdminInvitations} from './invitations'
import {useEffect,useRef,useState} from 'react'
import {promotionCommand} from '@/lib/admin/promotion-client'
import type {PromotionCommand,PromotionRights} from '@/lib/admin/promotion-contract'
import {adminCommand} from '@/lib/admin/client'
import {supabase} from '@/lib/supabaseClient'
import {CONTENT_TABLES} from '@/lib/admin/policy'
import {usePathname,useRouter,useSearchParams} from 'next/navigation'
type Account={slot:string;user_id:string;role:string;status:'active'|'disabled';revision:number;display_name:string;scopes:string[];promotion?:PromotionRights}
const labels=['공지','프로젝트','스터디','시간표','일정','행사']
export function AdminAccounts(){
 const uiText=useUIText();

 const router=useRouter(),pathname=usePathname(),query=useSearchParams()
 const tabs=rolePasswordClient ? [['list','관리자 목록'],['create','신규 관리자 생성']] : [['list','관리자 목록']]
 const tab=tabs.some(([key])=>key===query.get('tab'))?query.get('tab')!:'list'
 const [search,setSearch]=useState(''),[status,setStatus]=useState('all')
 const [rows,setRows]=useState<Account[]>([]),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[editing,setEditing]=useState<Account|null>(null)
 const [slot,setSlot]=useState('admin2'),[name,setName]=useState(''),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[scopes,setScopes]=useState<string[]>([...CONTENT_TABLES])
 const [manualEdit,setManualEdit]=useState(false),[approveDrafts,setApproveDrafts]=useState(false)
 const promotionAttempt=useRef<{intent:string;command:PromotionCommand}|null>(null)
 const pending=useRef(false),attempt=useRef(crypto.randomUUID())
 const [dirty,setDirty]=useState(false),[failed,setFailed]=useState(false)
 useUnsavedChanges(dirty)
 function discard(){return !dirty||window.confirm(uiText('저장하지 않은 변경사항이 있습니다. 버리고 계속할까요?'))}
 function selectTab(key:string){if(busy)return false;if(key===tab)return true;if(!discard())return false;reset();const next=new URLSearchParams(query);next.set('tab',key);window.history.replaceState(null,'',pathname+'?'+next);return true}
 async function reload(){const s=await adminCommand({action:'session',version:0}) as {version:number};const r=await adminCommand({action:'admins.list',version:s.version});if(!Array.isArray(r))throw new Error('관리자 목록을 확인하지 못했습니다.');setRows(r);return {...s,accounts:r as Account[]}}
 const [listLoading,setListLoading]=useState(true)
 useEffect(()=>{if(tab!=='list')return;let live=true;void(async()=>{try{const s=await adminCommand({action:'session',version:0}) as {version:number};const r=await adminCommand({action:'admins.list',version:s.version});if(!Array.isArray(r))throw Error();if(live){setRows(r);setSlot('admin'+Math.max(2,...r.map(a=>Number(a.slot.slice(5))+1)))}}catch{if(live)setMessage('최고관리자 추가 인증과 권한을 확인해 주세요.')}finally{if(live)setListLoading(false)}})();return()=>{live=false}},[tab])
 async function run(task:()=>Promise<void>){if(pending.current)return;pending.current=true;setBusy(true);setFailed(false);setMessage('');try{await task()}catch(e){setFailed(true);setMessage(e instanceof Error?e.message:'요청을 확인하지 못했습니다.')}finally{pending.current=false;setBusy(false)}}
 function reset(accounts=rows){promotionAttempt.current=null;setManualEdit(false);setApproveDrafts(false);setDirty(false);setEditing(null);setName('');setEmail('');setPassword('');setScopes([...CONTENT_TABLES]);attempt.current=crypto.randomUUID();setSlot('admin'+Math.max(2,...accounts.map(r=>Number(r.slot.slice(5))+1)))}
 async function save(){
  if(editing){const intent=JSON.stringify({slot:editing.slot,name,scopes,manualEdit,approveDrafts});if(promotionAttempt.current?.intent!==intent){const s=await reload();promotionAttempt.current={intent,command:{action:'account.save',requestId:crypto.randomUUID(),version:s.version,slot:editing.slot,userId:editing.user_id,status:editing.status,revision:editing.revision,permissionRevision:editing.promotion?.revision??0,displayName:name,scopes,manualEdit,approveDrafts}}}await promotionCommand(promotionAttempt.current.command)}
  else{
   const {data}=await supabase.auth.getSession();if(!data.session)throw new Error('다시 로그인해 주세요.')
   const r=await fetch('/api/admin/accounts',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${data.session.access_token}`},body:JSON.stringify({requestId:attempt.current,slot,email:email.trim(),password,displayName:name,scopes})})
   if(!r.ok)throw new Error(r.status===403?'최고관리자 추가 인증이 필요합니다.':r.status===409?'생성 상태를 확인해야 합니다. 같은 계정을 다시 만들지 말고 관리자에게 문의하세요.':'계정을 생성하지 못했습니다. 로컬 개발 환경과 입력을 확인해 주세요.')
  }
  const current=await reload();reset(current.accounts);setMessage('관리자 정보가 저장되었습니다.')
 }
 async function toggle(row:Account){const s=await reload();await adminCommand({action:'accounts.upsert',version:s.version,slot:row.slot,userId:row.user_id,status:row.status==='active'?'disabled':'active',revision:row.revision,displayName:row.display_name,scopes:row.scopes});await reload();setMessage('관리자 상태가 변경되었습니다. 기존 콘텐츠와 이력은 보존됩니다.')}
 return <section className="space-y-5"><div><h1 className="text-2xl font-bold"><T text="관리자 계정 관리"/></h1><p className="text-slate-600"><T text="각 계정은 독립적으로 인증하며, 비활성화하면 기존 세션의 쓰기도 차단됩니다."/></p></div>
 {message&&<p role={failed?'alert':'status'}><T text={message}/></p>}
 <div role="tablist" aria-label={uiText("관리자 계정 작업")} className="flex flex-wrap gap-2">{tabs.map(([key,label],index)=><button key={key} id={'account-tab-'+key} role="tab" aria-selected={tab===key} aria-controls={'account-panel-'+key} tabIndex={tab===key?0:-1} disabled={busy} className={tab===key?'bg-zinc-900 text-white':'bg-white text-zinc-900'} onClick={()=>selectTab(key)} onKeyDown={event=>{const next=event.key==='ArrowRight'?(index+1)%tabs.length:event.key==='ArrowLeft'?(index+tabs.length-1)%tabs.length:event.key==='Home'?0:event.key==='End'?tabs.length-1:-1;if(next<0)return;event.preventDefault();if(selectTab(tabs[next][0]))document.getElementById('account-tab-'+tabs[next][0])?.focus()}}><T text={label}/></button>)}</div>
 <div role="tabpanel" id={'account-panel-'+tab} aria-labelledby={'account-tab-'+tab} className="space-y-4">
 {rolePasswordClient&&<PasswordManagement tab={tab} onCreated={reload}/>}
 {tab==='list'&&<>{!rolePasswordClient&&<>{process.env.NEXT_PUBLIC_OAZ_DESKTOP_INTEGRATION==='owned-v1'&&<AdminInvitations/>}<AccountCredentials/></>}
 <div className="admin-form-grid"><label><T text="관리자 검색"/><input type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder={uiText("식별자 또는 표시 이름")}/></label><label><T text="계정 상태"/><select value={status} onChange={e=>setStatus(e.target.value)}><option value="all"><T text="전체"/></option><option value="active"><T text="활성"/></option><option value="disabled"><T text="비활성"/></option></select></label></div>
 <button disabled={busy} onClick={()=>void run(async()=>{await reload()})}><T text="목록 새로고침"/></button>
 {listLoading&&<AdminSessionLoading/>}
 <div className="grid gap-4 sm:grid-cols-2">{rows.filter(row=>(status==='all'||row.status===status)&&[row.slot,row.display_name].join(' ').toLowerCase().includes(search.toLowerCase())).map(row=><article className="admin-panel space-y-3" key={row.slot}><div className="flex flex-wrap items-center gap-2"><h2 className="font-bold break-all">{row.slot}</h2><span className="admin-badge"><T text={row.status==='active'?'활성':'비활성'}/></span></div><p className="break-all"><T text={row.display_name||'관리자'}/></p><p><T text={row.role==='SUPER_ADMIN'?'최고관리자':'일반관리자'}/><T text="· 편집 범위"/>{row.scopes.length}<T text="개"/></p><p className="text-sm text-zinc-600">{row.scopes.map(t=>labels[CONTENT_TABLES.findIndex(x=>x===t)]).filter(Boolean).map(uiText).join(' · ')||uiText('지정된 콘텐츠 없음')}</p><p className="text-sm"><T text="홍보 게시판 편집"/><T text={row.promotion?.manualEdit?'허용':'없음'}/><T text="· 홍보 자동 생성 글 승인"/><T text={row.promotion?.approveDrafts?'허용':'없음'}/></p>{row.slot!=='admin1'&&<div className="admin-actions"><button disabled={busy} onClick={()=>{if(!discard())return;setDirty(false);setEditing(row);setManualEdit(!!row.promotion?.manualEdit);setApproveDrafts(!!row.promotion?.approveDrafts);promotionAttempt.current=null;setSlot(row.slot);setName(row.display_name);setScopes(row.scopes);setPassword('');document.getElementById('account-form')?.scrollIntoView({behavior:'smooth'})}}><T text="정보·권한 수정"/></button><button disabled={busy} onClick={()=>{if(window.confirm(uiText(`${row.slot} 계정을 ${row.status==='active'?'비활성화':'재활성화'}할까요?`)))void run(()=>toggle(row))}}><T text={row.status==='active'?'비활성화':'재활성화'}/></button></div>}</article>)}</div>
 </>}
 {(!rolePasswordClient&&tab==='create'||tab==='list'&&editing)&&<form id="account-form" className="admin-panel space-y-5 scroll-mt-24" onChange={()=>setDirty(true)} onSubmit={e=>{e.preventDefault();void run(save)}}><h2 className="text-xl font-bold"><T text={editing?'관리자 정보·편집 권한 수정':'독립 관리자 계정 생성'}/></h2>{dirty&&<p className="text-sm text-zinc-500"><T text="저장하지 않은 변경사항이 있습니다."/></p>}
 <p className="text-sm text-slate-600"><T text="새 인증 계정 생성은 격리된 로컬 개발에서만 활성화됩니다. 운영 초대는 별도 승인 후 진행합니다."/></p>
 <label className="block"><T text="관리자 식별 이름"/><input className="block rounded border p-2" value={slot} disabled={busy||!!editing} pattern="admin[1-9][0-9]{0,6}" onChange={e=>setSlot(e.target.value)} required/></label>
 <label className="block"><T text="표시 이름"/><input className="block rounded border p-2" value={name} maxLength={80} disabled={busy} onChange={e=>setName(e.target.value)} required/></label>
 {!editing&&<><label className="block"><T text="독립 계정 이메일"/><input className="block rounded border p-2" type="email" autoComplete="off" value={email} disabled={busy} onChange={e=>setEmail(e.target.value)} required/></label><label className="block"><T text="초기 비밀번호"/><input className="block rounded border p-2" type="password" autoComplete="new-password" minLength={12} maxLength={128} value={password} disabled={busy} onChange={e=>setPassword(e.target.value)} required/></label></>}
 <fieldset disabled={busy}><legend className="mb-3 font-semibold"><T text="편집할 수 있는 콘텐츠 ·"/>{scopes.length}<T text="개 선택"/></legend><div className="admin-form-grid">{CONTENT_TABLES.map((t,i)=><label className="admin-scope" key={t}><input type="checkbox" checked={scopes.includes(t)} onChange={e=>setScopes(p=>e.target.checked?[...p,t]:p.filter(x=>x!==t))}/><T text={labels[i]}/></label>)}</div></fieldset>
 {editing?<fieldset disabled={busy}><legend className="mb-3 font-semibold"><T text="독립 홍보 권한"/></legend><div className="admin-form-grid"><label className="admin-scope"><input type="checkbox" checked={manualEdit} onChange={e=>setManualEdit(e.target.checked)}/><T text="홍보 게시판 편집"/></label><label className="admin-scope"><input type="checkbox" checked={approveDrafts} onChange={e=>setApproveDrafts(e.target.checked)}/><T text="홍보 자동 생성 글 승인"/></label></div><p className="mt-2 text-sm"><T text="두 권한은 독립적이며, 저장하면 기존 세션의 다음 요청부터 반영됩니다. 초안 검토·수정·승인은 별도 B 권한으로 제어합니다."/></p></fieldset>:<p className="text-sm"><T text="신규 계정은 승인 권한 없이 생성됩니다. 최초 홍보 편집 권한은 공지 권한을 따르며, 생성 후 정보·권한 수정에서 독립적으로 설정할 수 있습니다."/></p>}
 <div className="admin-actions"><button disabled={busy||!name.trim()||slot==='admin1'} type="submit"><T text={busy?'저장 중…':editing?'변경 저장':'관리자 생성'}/></button><button type="button" disabled={busy} onClick={()=>{if(discard())reset()}}><T text="취소·새 계정"/></button></div>
 </form>}
 {tab==='recovery'&&<AccountRecovery accounts={rows} onResume={(operationId,pendingSlot)=>{if(!discard())return;reset();attempt.current=operationId;setSlot(pendingSlot);router.replace(pathname+'?tab=create',{scroll:false});setMessage("보류 작업을 선택했습니다. 같은 가상 계정 이메일과 정보를 입력해 재시도하세요.");document.getElementById("account-form")?.scrollIntoView({behavior:"smooth"})}}/>}</div></section>
}
