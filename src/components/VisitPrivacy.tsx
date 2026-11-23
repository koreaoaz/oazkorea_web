'use client'
import {useRef, useState} from 'react'
import {Info} from 'lucide-react'
import {useLocale} from './LocaleProvider'
import {PublicDetailDialog} from './PublicDetailDialog'
import {useTraffic} from './TrafficProvider'

export function VisitPrivacy({settings = false}: {settings?: boolean}) {
  const en = useLocale() === 'en'
  const [open, setOpen] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  const {allowed, toggle} = useTraffic()
  const title = settings
    ? (en ? 'Visit statistics settings' : '방문 통계 설정')
    : (en ? 'Privacy and visit counting' : '개인정보 및 방문자 집계 안내')
  return <>
    <button type="button" ref={trigger} aria-haspopup="dialog" onClick={() => setOpen(true)}
      className="inline-flex min-h-8 items-center gap-1.5 text-xs text-gray-600 hover:underline focus-visible:outline-2">
      {title}{!settings && <Info aria-hidden="true" size={15}/>}
    </button>
    {open && <PublicDetailDialog title={title} onClose={() => setOpen(false)} returnFocusRef={trigger}>
      <div className="space-y-3 text-sm leading-relaxed text-gray-700">
      <p className="mt-2">{en ? 'One browser counts once per Korean calendar day. Total visits add up these daily counts. Changing devices or clearing storage affects the estimate.' : '한국 시간으로 같은 브라우저의 하루 방문을 한 번 집계합니다. 누적 방문 수는 일별 합계이며 기기 변경이나 저장소 삭제에 따라 달라질 수 있습니다.'}</p>
      <p>{en ? 'Your browser replaces its random ID each day you visit. The server keeps only keyed daily tags until the next cleanup and short-lived rate limits. Daily totals are retained. Accounts are never linked. Browser privacy signals disable counting.' : '방문한 날마다 브라우저의 임시 식별값을 교체합니다. 서버는 중복 확인용 일별 해시와 짧은 요청 제한 기록을 다음 정리 시 삭제하고 일별 합계를 보관합니다. 계정과 방문을 연결하지 않으며 브라우저의 추적 거부 설정을 따릅니다.'}</p>

      {settings && (<button type="button" aria-pressed={!allowed} className="mt-1 min-h-8 underline" onClick={toggle}>{allowed ? (en ? 'Exclude this browser' : '이 브라우저 집계 제외') : (en ? 'Counting off · allow if browser permits' : '집계 꺼짐 · 브라우저 설정이 허용하면 참여')}</button>)}
      {!settings && <p>{en ? 'You can change your preference in Visit statistics settings in the footer.' : '집계 참여 여부는 페이지 하단의 방문 통계 설정에서 변경할 수 있습니다.'}</p>}
      </div>
    </PublicDetailDialog>}
  </>
}
