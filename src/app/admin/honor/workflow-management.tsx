'use client'
import {AdminSessionLoading} from '@/components/AdminSessionLoading'
import {useEffect,useRef,useState} from 'react'
import Link from 'next/link'
import {T,useUIText} from '@/components/LocaleProvider'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {honorWorkflow} from '@/lib/admin/honor-workflow-client'
import {normalizeHonorName,type HonorWorkflowCommand} from '@/lib/admin/honor-workflow'

type Row={id:number;name:string;display_name?:string;note?:string;revision:number;status:string;consent_reference?:string;approved_at?:string;approved_by?:string;trashId?:string;deletedAt?:string}
type Snapshot={version:number;superAdmin:boolean;canManage?:boolean;rows:Row[]}
type Fields={name:string;note:string}
const empty:Fields={name:'',note:''}
export function HonorManagement({trash=false}:{trash?:boolean}){
 const t=useUIText()
 const [snapshot,setSnapshot]=useState<Snapshot|null>(null),[stale,setStale]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState(false)
 const [fields,setFields]=useState<Fields>(empty)
 const pending=useRef(false),retry=useRef<{body:string;id:string}|null>(null)
 const load=()=>honorWorkflow({action:trash?'trash':'list'}) as Promise<Snapshot>
 useEffect(()=>{let active=true;void honorWorkflow({action:trash?'trash':'list'}).then(s=>{if(active){setSnapshot(s);setStale(false)}}).catch(()=>{if(active){setError(true);setStale(true);setMessage('목록을 불러오지 못했습니다. 최고관리자 권한과 추가 인증을 확인해 주세요.')}});return()=>{active=false}},[trash])
 async function refresh(){try{setSnapshot(await load());setStale(false);setMessage('');setError(false);setFields(empty)}catch{setStale(true);setError(true);setMessage('최신 상태를 확인하지 못했습니다. 다시 새로고침해 주세요.')}}
 async function mutate(command:HonorWorkflowCommand,onSaved?:()=>void){
  if(pending.current||stale)return;pending.current=true;setBusy(true);setMessage('');setError(false)
  const body=JSON.stringify(command);if(retry.current?.body!==body)retry.current={body,id:crypto.randomUUID()}
  try{await honorWorkflow({...command,requestId:retry.current.id});retry.current=null;onSaved?.();try{setSnapshot(await load());setStale(false);setMessage(command.action==='create'?'저장했습니다. 공개 홈페이지에 반영했습니다.':command.action==='delete'?'삭제했습니다. 공개 홈페이지에서 제거했습니다.':command.action==='restore'?'비공개로 복구했습니다.':'수정했습니다. 기존 공개 상태를 유지합니다.')}catch{setStale(true);setError(true);setMessage('저장은 완료됐지만 최신 목록을 확인하지 못했습니다. 새로고침해 주세요.')}}
  catch(e){setError(true);setMessage(e instanceof Error?e.message:'요청을 완료하지 못했습니다. 입력은 유지됩니다.')}
  finally{pending.current=false;setBusy(false)}
 }
 const disabled=busy||stale||!snapshot||!(snapshot.canManage??snapshot.superAdmin)
 const rows=snapshot?.rows??[] // DB ICU name order; never sort by legacy position.
 const reset=()=>{setFields(empty)}
 return <section className="space-y-5" data-honor-workflow>
  <header className="space-y-3"><h1><T text="명예의 전당 관리"/></h1><p><T text="새 항목은 저장하면 공개됩니다. 공개 동의가 확인된 정보만 입력하세요. 기존 비공개 항목은 수정해도 공개되지 않습니다."/></p>{snapshot?.superAdmin&&<nav className="flex flex-wrap gap-4"><Link href="/admin/content/honor"><T text="명단·등록"/></Link><Link href="/admin/content/honor/trash"><T text="삭제 명단·복구"/></Link></nav>}</header>
  {message&&<p role={error?'alert':'status'} className={error?'text-red-700':'text-slate-700'}><T text={message}/></p>}
  {!snapshot&&!error&&<AdminSessionLoading/>}
  <Button variant="outline" disabled={busy} onClick={()=>void refresh()}><T text="목록 새로고침"/></Button>
  {(snapshot?.canManage??snapshot?.superAdmin)&&!trash&&<>
   <form className="admin-panel space-y-4" data-honor-add onSubmit={e=>{e.preventDefault();if(!normalizeHonorName(fields.name))return;void mutate({action:'create',version:snapshot.version,name:fields.name,note:fields.note},reset)}}>
    <h2><T text="명예의 전당에 추가하기"/></h2>
    <label className="block space-y-2"><T text="이름 (필수)"/><Input aria-label="이름" autoComplete="off" maxLength={100} required disabled={disabled} value={fields.name} onChange={e=>setFields({...fields,name:e.target.value})}/></label>
    <label className="block space-y-2"><T text="참고 내용 (선택 · 관리자만 확인)"/><textarea aria-label="참고 내용" className="min-h-24 w-full rounded-md border p-3" maxLength={2000} disabled={disabled} value={fields.note} onChange={e=>setFields({...fields,note:e.target.value})}/></label>
    <Button type="submit" disabled={disabled||!normalizeHonorName(fields.name)}><T text={busy?'저장 중…':'명예의 전당에 추가'}/></Button>
   </form>
   <section className="admin-panel space-y-4" data-honor-roster><p><T text="가나다순으로 배치합니다."/></p><h2><T text="현재 명예의 전당 인원 목록"/></h2>
    {!rows.length&&<p><T text="등록된 인원이 없습니다."/></p>}
    <ul className="space-y-4">{rows.map(r=><li key={r.id} data-honor-id={r.id} className="min-w-0 space-y-3 rounded-xl border p-4">
     <div className="flex flex-wrap items-center justify-between gap-2"><strong data-honor-name className="break-words">{r.display_name??r.name}</strong></div>
     {r.note&&<p className="whitespace-pre-wrap break-words text-sm">{r.note}</p>}
     <div className="flex flex-wrap gap-2">
      <Button variant="destructive" disabled={disabled} onClick={()=>{if(window.confirm(t(`“${r.display_name??r.name}”을 삭제할까요? 삭제 기록은 보존됩니다.`)))void mutate({action:'delete',version:snapshot.version,id:r.id,revision:r.revision,confirmed:true},()=>{reset()})}}><T text="삭제"/></Button>
     </div>
    </li>)}</ul>
   </section>
  </>}
  {snapshot?.superAdmin&&trash&&<section data-honor-trash className="admin-panel space-y-4"><h2><T text="삭제 명단·복구"/></h2><p>삭제된 기록은 최소 90일 보존합니다. 복구해도 자동 공개되지 않습니다.</p>{!rows.length&&<p>삭제된 인원이 없습니다.</p>}{rows.map(r=><article key={r.trashId} data-honor-trash-id={r.trashId} className="flex flex-wrap items-center gap-3 rounded-xl border p-3"><strong className="min-w-0 flex-1 break-words">{r.name}</strong><Button disabled={disabled} variant="outline" onClick={()=>{if(window.confirm(t(`“${r.name}”을 비공개로 복구할까요?`)))void mutate({action:'restore',version:snapshot.version,trashId:r.trashId,revision:r.revision,confirmed:true})}}>복구</Button></article>)}</section>}
  {snapshot&&!(snapshot.canManage??snapshot.superAdmin)&&<p role="alert">명예의 전당 관리 권한이 없습니다.</p>}
  <Link className="inline-flex min-h-11 items-center underline" href="/alumni/hall-of-fame" target="_blank" rel="noreferrer"><T text="공개 홈페이지 확인"/></Link>
 </section>
}
