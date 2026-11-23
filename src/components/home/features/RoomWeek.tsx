'use client'
import {useEffect,useRef} from 'react'
import {T,useLocale} from '@/components/LocaleProvider'
import type {StudySlot} from '@/lib/timetable'

type Entry={slot:StudySlot;lane:number}
function columns(slots:StudySlot[]){
  const ends:number[]=[], entries:Entry[]=[]
  for(const slot of [...slots].sort((a,b)=>a.startSlot-b.startSlot||a.endSlot-b.endSlot||a.id.localeCompare(b.id))){
    let lane=ends.findIndex(end=>end<=slot.startSlot)
    if(lane<0)lane=ends.length
    ends[lane]=slot.endSlot
    entries.push({slot,lane})
  }
  return {entries,count:Math.max(1,ends.length)}
}

export function RoomWeek({studies,days,onSelect}:{studies:StudySlot[];days:string[];onSelect:(slot:StudySlot)=>void}){
  const en=useLocale()==='en', frame=useRef<HTMLDivElement>(null)
  const name=(s:StudySlot)=>(en&&s.englishName)||s.name
  const groups=days.map(day=>columns(studies.filter(s=>s.day===day)))
  const tracks=groups.map(g=>`repeat(${g.count},minmax(0,${1/g.count}fr))`).join(' ')
  useEffect(()=>{
    const el=frame.current
    if(!el)return
    let width=0,retained=0
    const resize=()=>{
      if(!el.clientWidth)return
      if(el.clientWidth!==width){width=el.clientWidth;retained=0}
      const top=el.getBoundingClientRect().top+window.scrollY
      retained=Math.max(retained,Math.min(920,window.innerHeight-top-12),420)
      el.style.minHeight=retained+'px'
    }
    resize()
    const observer=new ResizeObserver(resize);observer.observe(el)
    window.addEventListener('resize',resize)
    return ()=>{observer.disconnect();window.removeEventListener('resize',resize)}
  },[])
  return <>
    <div data-timetable-agenda className="divide-y rounded-lg border sm:hidden">{groups.map(({entries},i)=><section key={days[i]} className="grid grid-cols-[3rem_1fr] gap-1 px-2 py-1">
      <h3 className="pt-2 text-xs font-semibold"><T text={days[i]}/></h3><div>{entries.map(({slot})=><button key={slot.id} data-timetable-study={slot.id} onClick={()=>onSelect(slot)} type="button" className="my-0.5 grid min-h-11 w-full grid-cols-[5.2rem_minmax(0,1fr)] items-center gap-2 rounded border-l-4 bg-zinc-50 px-2 text-left focus-visible:outline-2" style={{borderLeftColor:slot.color}}>
        <time className="text-xs tabular-nums">{slot.startTime}–{slot.endTime}</time><span className="text-sm font-medium [overflow-wrap:anywhere]">{name(slot)}</span>
      </button>)}{!entries.length&&<p className="py-2 text-xs text-zinc-500"><T text="등록된 일정이 없습니다."/></p>}</div></section>)}</div>
    <div ref={frame} data-timetable-frame className="hidden min-w-0 grid-rows-[auto_1fr] rounded-lg border bg-white sm:grid">
      <div className="grid grid-cols-[2.75rem_repeat(6,minmax(0,1fr))] border-b text-center text-xs font-semibold"><span/>{days.map(day=><span className="border-l py-1" key={day}><T text={day}/></span>)}</div>
      <div data-timetable-grid className="grid min-w-0" style={{gridTemplateColumns:'2.75rem '+tracks,gridTemplateRows:'repeat(28,minmax(min-content,1fr))'}}>
        {Array.from({length:14},(_,i)=><span key={i} className="border-b pr-1 text-right text-xs tabular-nums text-zinc-600" style={{gridColumn:1,gridRow:`${2*i+1}/span 2`}}>{String(i+9).padStart(2,'0')}:00</span>)}
        {groups.map(({entries,count},day)=>{
          const start=2+groups.slice(0,day).reduce((sum,g)=>sum+g.count,0)
          return <div key={days[day]} className="contents">
            {Array.from({length:14},(_,i)=><span key={i} aria-hidden="true" className="border-b border-l" style={{gridColumn:`${start}/span ${count}`,gridRow:`${2*i+1}/span 2`}}/>)}
            {entries.map(({slot,lane})=><button key={slot.id} data-timetable-study={slot.id} type="button" onClick={()=>onSelect(slot)} className="relative min-h-11 min-w-0 self-stretch rounded border-l-4 bg-zinc-50 px-1 py-0.5 text-left text-zinc-900 focus-visible:z-10 focus-visible:outline-2" style={{gridColumn:start+lane,gridRow:`${slot.startSlot+1}/span ${slot.endSlot-slot.startSlot}`,borderLeftColor:slot.color}}>
              <span className="block text-xs font-semibold leading-tight [overflow-wrap:anywhere]">{name(slot)}</span>
              <time className="block text-[11px] leading-tight tabular-nums">{slot.startTime}–{slot.endTime}</time>
            </button>)}
          </div>
        })}
      </div>
    </div>
  </>
}
