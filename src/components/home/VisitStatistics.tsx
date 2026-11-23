'use client'
import { useLocale } from '@/components/LocaleProvider'
import { VisitPrivacy } from '@/components/VisitPrivacy'
import { useTraffic } from '@/components/TrafficProvider'

export default function VisitStatistics() {
  const en = useLocale() === 'en'
  const { stats, failed } = useTraffic()
  const fmt = new Intl.NumberFormat(en ? 'en' : 'ko')
  return <section data-home-block="visits" className="min-w-0 rounded-xl border border-gray-200 bg-white p-4">
    <div className="flex flex-wrap items-baseline justify-between gap-1">
      <h2 className="text-lg font-bold tracking-tight">{en ? 'Visits' : '방문 통계'}</h2>
      <span className="text-xs text-gray-600">{stats?.day} KST</span>
    </div>
    <dl className="my-3 grid grid-cols-2 divide-x divide-gray-200">
      {[[en ? 'Total visits' : '누적 방문 수', stats?.total], [en ? 'Visitors today' : '오늘 방문자', stats?.today]].map(([label, value], i) =>
        <div key={label} className={i ? 'pl-4' : ''}><dt className="text-sm text-gray-600">{label}</dt>
          <dd className="min-h-8 text-2xl font-semibold tabular-nums">{typeof value === 'number' ? fmt.format(value) : failed ? '—' : '…'}</dd></div>)}
    </dl>
    {failed && <p role="status" className="text-sm">{en ? 'Statistics unavailable' : '통계를 조회할 수 없습니다.'}</p>}
    <VisitPrivacy/>
  </section>
}
