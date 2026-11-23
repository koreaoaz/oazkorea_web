'use client'
import {useEffect,useRef,useState} from 'react'
import {T} from '@/components/LocaleProvider'
import {siteCommand} from '@/lib/admin/site-client'
export function VisibilityControl({table,id,mode='panel'}:{table:string;id:number;mode?:'panel'|'compact'|'badge'}){
 const [value,setValue]=useState<{public:boolean;revision:number}|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),pending=useRef(false),retry=useRef<{revision:number;requestId:string}|null>(null)
 useEffect(()=>{let live=true;void siteCommand<{public:boolean;revision:number}>({action:'visibility.get',table,id}).then(v=>{if(live)setValue(v)}).catch(e=>{if(live)setError(e.message)});return()=>{live=false}},[table,id])
 async function change(){
  if(!value||pending.current)return;pending.current=true;setBusy(true);setError('');setMessage('')
  if(retry.current?.revision!==value.revision)retry.current={revision:value.revision,requestId:crypto.randomUUID()}
  try{const next=await siteCommand<typeof value>({action:'visibility.set',table,id,revision:value.revision,public:!value.public,requestId:retry.current.requestId});setValue(next);retry.current=null;setMessage(next.public?'공개 홈페이지에 게시되었습니다.':'비공개로 전환되었습니다. 공개 요청이 차단됩니다.')}catch(e){setError(e instanceof Error?e.message:'공개 상태를 변경하지 못했습니다.')}finally{pending.current=false;setBusy(false)}
 }
 const badge=value?<span data-testid="visibility-status" className="admin-badge mr-2"><T text={value.public?'공개':'비공개'}/></span>:null
 if(mode==='badge')return badge??<span className="mr-2 text-xs text-zinc-500"><T text={error?'상태 조회 실패':'상태 확인 중…'}/></span>
 if(mode==='compact')return <div className="flex flex-wrap items-center gap-2">
   {value&&<button type="button" disabled={busy} onClick={()=>void change()}><T text={busy?'변경 중…':value.public?'비공개로 전환':'공개로 전환'}/></button>}
   {badge}{!value&&!error&&<span role="status"><T text="상태 확인 중…"/></span>}
   {message&&<span role="status"><T text={message}/></span>}{error&&<span role="alert">{error}</span>}
 </div>
 return <section className="admin-panel space-y-3" aria-label="공개 상태 관리"><h2>공개 상태</h2>{value?<><p data-testid="visibility-status">{value.public?'공개':'비공개'}</p><button type="button" disabled={busy} onClick={()=>void change()}>{busy?'변경 중…':value.public?'비공개로 전환':'공개로 전환'}</button></>:!error&&<p role="status">상태 확인 중…</p>}{message&&<p role="status">{message}</p>}{error&&<p role="alert">{error}</p>}<p className="text-sm">비공개 본문과 첨부는 외부에 제공되지 않습니다. 다른 공개 게시물에서 함께 사용하는 이미지는 계속 표시됩니다.</p></section>
}
