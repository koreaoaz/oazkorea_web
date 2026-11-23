'use client'

import {AdminSessionLoading} from '@/components/AdminSessionLoading'
import {T,useUIText} from '@/components/LocaleProvider';
import {useEffect,useState} from 'react'
import {insights} from '@/lib/admin/insights'
import {actionLabel,tableLabel,CATEGORY_LABELS} from '@/lib/admin/boards'
type Part={name:string;count:number}
type Stats={total:number;thisMonth:number;created:number;updated:number;deleted:number;lastChanged:string|null;selected:number;previous:number;actions:Part[];tables:Part[];categories:Part[];recent:{action:string;target_table:string;record_id:number;committed_at:string}[];scope:string}
const colors=['#18181b','#52525b','#a1a1aa','#d4d4d8','#71717a','#e4e4e7']
function Donut({parts,label,format}:{parts:Part[];label:string;format:(key:string)=>string}){
 const sum=parts.reduce((a,b)=>a+b.count,0)
 return <section className="admin-panel admin-donut"><h2><T text={label}/></h2>{!sum?<p className="text-sm text-zinc-500"><T text="아직 집계할 기록이 없습니다."/></p>:<div className="admin-donut-body"><svg viewBox="0 0 180 180" role="img" aria-label={label}>{parts.map((p,i)=>{const dash=p.count/sum*376.991,start=parts.slice(0,i).reduce((v,item)=>v+item.count/sum*376.991,0);return <circle key={p.name} cx="90" cy="90" r="60" fill="none" stroke={colors[i%colors.length]} strokeWidth="26" strokeDasharray={`${dash} ${376.991-dash}`} strokeDashoffset={-start} transform="rotate(-90 90 90)"/>})}<text x="90" y="96" textAnchor="middle" fontSize="22" fontWeight="700">{sum}</text></svg><ul>{parts.map((p,i)=><li key={p.name}><span><span aria-hidden="true" style={{background:colors[i%colors.length]}} className="mr-1 inline-block h-2 w-2 rounded-sm"/><T text={format(p.name)}/></span><span>{p.count}<T text="건 ·"/>{(p.count/sum*100).toFixed(1)}%</span></li>)}</ul></div>}</section>
}
export function AdminDashboard(){
 const uiText=useUIText();

 const current=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric'}).format(new Date()),[from,setFrom]=useState(`${current}-01-01`),[to,setTo]=useState(`${current}-12-31`),[stats,setStats]=useState<Stats|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState('')
 useEffect(()=>{const c=new AbortController();const timer=setTimeout(()=>{setLoading(true);setError('');void insights({action:'stats',from,to},c.signal).then(s=>{if(!c.signal.aborted)setStats(s)}).catch(()=>{if(!c.signal.aborted)setError('통계를 불러오지 못했습니다. 기간 또는 로컬 마이그레이션을 확인해 주세요.')}).finally(()=>{if(!c.signal.aborted)setLoading(false)})},100);return()=>{clearTimeout(timer);c.abort()}},[from,to])
 if(!stats&&loading&&!error)return <AdminSessionLoading/>
 const labels=[['전체 콘텐츠 변경',stats?.total],['이번 달 변경',stats?.thisMonth],['이번 달 신규 작성',stats?.created],['이번 달 수정',stats?.updated],['이번 달 삭제',stats?.deleted]] as const
 return <div className="admin-dashboard"><h1><T text="대시보드"/></h1><p className="text-xs text-zinc-500"><T text="실제 관리자 콘텐츠 변경 이력 · 한국 시간 기준 ·"/><T text={stats?.scope==='assigned'?'현재 허용된 콘텐츠 범위':'전체 콘텐츠 범위'}/><T text=". Git 커밋은 합산하지 않습니다."/></p>{error&&<p role="alert"><T text={error}/></p>}{loading&&<p role="status"><T text="통계를 집계하는 중…"/></p>}
 <div className="admin-stat-grid">{labels.map(([name,value])=><div className="admin-panel" key={name}><p><T text={name}/></p><strong data-stat={name}>{value??'—'}</strong></div>)}<div className="admin-panel"><p><T text="최근 마지막 변경"/></p><strong className="admin-stat-date"><T text={stats?.lastChanged?new Date(stats.lastChanged).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'}):stats?'집계 기록 없음':'—'}/></strong></div></div>
 <section aria-label={uiText("비율 집계 기간")} className="admin-ratio-filter"><label><span><T text="시작일"/></span><input aria-label={uiText("통계 시작일")} type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label><label><span><T text="종료일"/></span><input aria-label={uiText("통계 종료일")} type="date" value={to} onChange={e=>setTo(e.target.value)}/></label>{stats&&<p><T text="선택 기간"/>{' '}{stats.selected}<T text="건 · 직전 같은 기간"/>{stats.previous}<T text="건"/></p>}</section>
 {stats&&<><div className="admin-grid admin-donuts"><Donut label="작업 유형별 비율" parts={stats.actions} format={actionLabel}/><Donut label="콘텐츠 유형별 비율" parts={stats.tables} format={tableLabel}/><Donut label="변경 분류별 비율" parts={stats.categories} format={v=>CATEGORY_LABELS[v as keyof typeof CATEGORY_LABELS]??'미분류'}/></div><section className="admin-panel admin-recent"><h2><T text="최근 활동 요약"/></h2>{!stats.recent.length?<p className="text-sm"><T text="아직 집계할 기록이 없습니다."/></p>:<ul>{stats.recent.slice(0,5).map((e,i)=><li key={i}><span><T text={tableLabel(e.target_table)}/> · <T text={actionLabel(e.action)}/>{e.record_id?` #${e.record_id}`:''}</span><time>{new Date(e.committed_at).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})}</time></li>)}</ul>}</section></>}
 </div>
}
