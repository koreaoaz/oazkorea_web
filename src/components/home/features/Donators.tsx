"use client"


import {T} from '@/components/LocaleProvider';
import * as React from "react"
import { useAsyncQuery } from "@/hooks/useAsyncQuery"
import { parsePublicHonor, type PublicHonor } from "@/lib/honor"


type HonorResult={entries:PublicHonor[];fixtureCount:number}
const EMPTY_HONOR:HonorResult={entries:[],fixtureCount:0}
async function fetchDonators(signal: AbortSignal): Promise<HonorResult> {
  // StrictMode의 첫 효과가 정리된 뒤 요청한다. 응답을 캐시하지 않아 회수 반영은 유지한다.
  await Promise.resolve()
  if(signal.aborted)throw Object.assign(new Error('ABORTED'),{name:'AbortError'})
  const response = await fetch('/api/public/honor', { signal, cache: 'no-store', credentials: 'omit' })
  if (!response.ok) throw new Error('HONOR_UNAVAILABLE')
  const result: unknown = await response.json()
  if (!result || typeof result !== 'object' || !('entries' in result)) throw new Error('HONOR_UNAVAILABLE')
  const entries=parsePublicHonor(result.entries)
  const fixture='fixture' in result?result.fixture as {kind?:unknown;count?:unknown}:undefined
  if(fixture&&(fixture.kind!=='LOCAL_FIXTURE_NOT_ADMIN_APPROVAL'||!Number.isInteger(fixture.count)||Number(fixture.count)<1||Number(fixture.count)>8))throw new Error('HONOR_UNAVAILABLE')
  return {entries,fixtureCount:fixture?Number(fixture.count):0}
}

type Props = {
  /** 스크롤 영역 배경: "transparent" | "white" (기본: transparent) */
  listBg?: "transparent" | "white"
  showHeading?: boolean
  detailed?: boolean
}

export default function Donators({ listBg = "transparent", showHeading = true, detailed = false }: Props) {
  const { data: result, loading, error, reload } = useAsyncQuery<HonorResult>(
    'public-honor', fetchDonators, EMPTY_HONOR, '명예의 전당을 불러오지 못했습니다. 잠시 후 다시 확인해 주세요.', false,
  )
  React.useEffect(()=>{
    if(typeof BroadcastChannel==='undefined')return
    const channel=new BroadcastChannel('oaz-public-honor')
    channel.onmessage=event=>{if(event.data==='refresh')reload()}
    return()=>channel.close()
  },[reload])
  React.useEffect(()=>{const refresh=()=>{if(document.visibilityState==='visible')reload()};window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',refresh);const interval=window.setInterval(refresh,30000);return()=>{window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',refresh);window.clearInterval(interval)}},[reload])
  const list=result.entries // Canonical database ICU order shared by home and Alumni.

  const VISIBLE_COUNT = 3
  const ITEM_HEIGHT_PX = 40
  const VIEWPORT_HEIGHT = VISIBLE_COUNT * ITEM_HEIGHT_PX

  const durationSec = Math.max(list.length * 0.8, 10)
  const shouldAnimate = !loading && !error && list.length > VISIBLE_COUNT
  const displayed = React.useMemo(() => shouldAnimate ? [...list, ...list] : list, [list, shouldAnimate])

  // 스크롤 영역 배경 클래스
  const listBgClass =
    listBg === "white" ? "bg-white" : "bg-transparent"

  if(detailed)return <section className="space-y-4" aria-label="명예의 전당">
    {loading||error||!list.length?<p role="status" className="rounded-xl border p-8 text-center text-slate-600"><T text={loading?'명예의 전당을 불러오는 중입니다.':error||'공개가 승인된 명예의 전당 정보가 아직 없습니다.'}/></p>:<ul className="grid gap-4 sm:grid-cols-2">{list.map((entry,index)=><li key={index} className="min-w-0 space-y-3 rounded-2xl border bg-white p-6"><h2 className="break-words text-xl font-semibold">{entry.display_name}</h2>{entry.generation&&<p className="break-words text-sm text-slate-500">기수: {entry.generation}</p>}{entry.affiliation&&<p className="break-words font-medium">{entry.affiliation}</p>}{entry.introduction&&<p className="whitespace-pre-wrap break-words leading-7 text-slate-600">{entry.introduction}</p>}</li>)}</ul>}
  </section>

  return (
    <div className="w-full" data-honor-fill={shouldAnimate && list.length >= 6 ? true : undefined}>
      {/* 헤더(검정 상자)만 박스 처리 */}
      {showHeading && <div className="w-full bg-black text-white text-xl font-bold tracking-widest text-center py-1 rounded-xl"><T text="명예의전당"/></div>}
      {result.fixtureCount>0&&<p data-honor-fixture className="mb-2 text-center text-[11px] text-gray-500"><T text="로컬 가상 인물 · 관리자 승인 기록 아님"/></p>}

      {/* 스크롤 영역: 투명/흰색 + 검정 텍스트 */}
      <div
        data-honor-viewport
        className={`w-full ${listBgClass} text-black overflow-hidden`}
        style={{ height: loading ? VIEWPORT_HEIGHT : Math.min(VISIBLE_COUNT, Math.max(list.length, 1)) * ITEM_HEIGHT_PX }}
      >
        {loading || error || list.length === 0 ? (
          <div role="status" className="flex items-center justify-center h-full px-3 text-center text-sm text-gray-600">
            <T text={loading ? '명예의 전당을 불러오는 중입니다.' : error || '공개가 승인된 명예의 전당 정보가 아직 없습니다.'}/>
          </div>
        ) : (
          <div
            className={`relative ${shouldAnimate ? "group/scroll" : ""}`}
            style={{ height: VIEWPORT_HEIGHT }}
          >
            <div
              className={`${shouldAnimate ? "donator-animate" : ""}`}
              style={shouldAnimate ? { animationDuration: `${durationSec}s` } : undefined}
            >
              {displayed.map((d, idx) => (
                <div
                  key={idx}
                  className="h-10 flex items-center justify-center text-lg"
                >
                  <span className="truncate">{d.display_name}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <p data-honor-order-note className="mt-2 text-center text-xs text-gray-500">
        <T text="이름을 기준으로 가나다순으로 정렬하였습니다."/>
      </p>

      {/* 컴포넌트 전용 스타일 */}
      <style jsx>{`
        @keyframes donatorScroll {
          0% {
            transform: translateY(0);
          }
          100% {
            transform: translateY(-50%);
          }
        }
        .donator-animate {
          display: block;
          will-change: transform;
          animation-name: donatorScroll;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
        }
        .group\\/scroll:hover .donator-animate {
          animation-play-state: paused;
        }
      `}</style>
    </div>
  )
}
