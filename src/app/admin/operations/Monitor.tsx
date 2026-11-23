'use client'
import {useEffect,useState} from 'react'
import {supabase} from '@/lib/supabaseClient'
import {useLocale} from '@/components/LocaleProvider'
type RecordState={latest:{at:string;result:string;ms:number}|null;lastCron:string|null;lastOk:string|null;late:boolean;secretConfigured:boolean}
export function Monitor(){
 const en=useLocale()==='en'
 const [value,setValue]=useState<RecordState|null>(null),[failed,setFailed]=useState(false),[version,setVersion]=useState(0)
 useEffect(()=>{
  const ctrl=new AbortController()
  supabase.auth.getSession().then(({data})=>{if(!data.session)throw Error();return fetch('/api/admin/operations-status',{signal:ctrl.signal,cache:'no-store',headers:{Authorization:'Bearer '+data.session.access_token}})}).then(async r=>{if(!r.ok)throw Error();return r.json()}).then(v=>{if(!ctrl.signal.aborted){setValue(v);setFailed(false)}}).catch(()=>{if(!ctrl.signal.aborted)setFailed(true)})
  return ()=>ctrl.abort()
 },[version])
 const time=(v?:string|null)=>v?new Intl.DateTimeFormat(en?'en-GB':'ko-KR',{timeZone:'Asia/Seoul',dateStyle:'short',timeStyle:'medium'}).format(new Date(v)):'—'
 return <section className="admin-panel space-y-2"><h2>{en?'Supabase health':'Supabase 운영 상태'}</h2>
 <p>{en?'Daily check around 09:00 KST':'매일 오전 9시대 연결 점검 (한국 시간)'}</p>
 {failed?<p role="alert">{en?'Status unavailable. Check the Vercel Runtime Logs.':'상태를 조회하지 못했습니다. Vercel Runtime Logs에서 oaz_daily_db_check를 확인하세요.'}</p>:value?<dl className="grid gap-2 sm:grid-cols-2">
 <div><dt>{en?'Latest database probe':'최근 DB 점검'}</dt><dd>{value.latest?value.latest.result+' · '+value.latest.ms+' ms':'—'} · {time(value.latest?.at)}</dd></div>
 <div><dt>{en?'Last successful probe':'마지막 정상 점검'}</dt><dd>{time(value.lastOk)}</dd></div>
 <div><dt>{en?'Scheduled check':'정기 점검'}</dt><dd>{!value.secretConfigured?(en?'Credential missing':'인증 설정 필요'):value.late?(en?'Scheduled result overdue':'예정된 점검 기록 누락'):value.lastCron?time(value.lastCron):(en?'Awaiting first run':'첫 실행 대기')}</dd></div></dl>:<p role="status">{en?'Loading…':'조회 중…'}</p>}
 <button type="button" onClick={()=>setVersion(v=>v+1)}>{en?'Refresh status':'상태 새로고침'}</button></section>
}
