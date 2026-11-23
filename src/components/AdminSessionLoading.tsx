'use client'
import {useLocale} from './LocaleProvider'

export function AdminSessionLoading() {
  const english = useLocale() === 'en'
  return <div lang={english?'en':'ko'} role="status" aria-live="polite" className="grid min-h-[55dvh] place-content-center justify-items-center gap-4 bg-white text-center text-sm text-zinc-700">
    <span aria-hidden="true" className="size-9 rounded-full border-[3px] border-zinc-200 border-t-zinc-900 motion-safe:animate-spin"/>
    {english ? 'Loading content…' : '컨텐츠를 불러오는 중입니다'}
  </div>
}

