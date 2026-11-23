'use client'
import {createContext,useContext} from 'react'
import {type Locale,localeURL} from '@/lib/locale'
import english from '@/lib/ui-en.json'
const dictionary=english as Record<string,string>
const patterns=Object.entries(dictionary).filter(([key])=>/\{\d+\}/.test(key)).map(([key,value])=>({pattern:new RegExp('^'+key.split(/\{\d+\}/).map(s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('([\\s\\S]*?)')+'$'),value}))
const LocaleContext=createContext<Locale>('ko')
export function LocaleProvider({locale,children}:{locale:Locale;children:React.ReactNode}){return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>}
export const useLocale=()=>useContext(LocaleContext)
export function translateUI(text:string,locale:Locale){
 if(locale!=='en')return text
 if(dictionary[text])return dictionary[text]
 for(const {pattern,value} of patterns){const match=pattern.exec(text);if(match)return value.replace(/\{(\d+)\}/g,(_,i:string)=>dictionary[match[Number(i)+1]]??match[Number(i)+1])}
 return text
}
export function useUIText(){const locale=useLocale();return (text:string)=>translateUI(text,locale)}
export function LocalizedText({ko,en}:{ko:string;en:string}){return <>{useLocale()==='en'?en:ko}</>}
export function T({text}:{text:string|number|null|undefined}){const locale=useLocale();return <>{typeof text==='string'?translateUI(text,locale):text}</>}
export function LanguageSwitch({compact=false}:{compact?:boolean}={}){const locale=useLocale();return <div className={`flex shrink-0 items-center ${compact?'gap-0.5':'gap-1'} rounded-lg border border-slate-300 bg-white p-1`} role="group" aria-label="Language / 언어">{(['ko','en'] as const).map(value=><button key={value} type="button" lang={value} aria-label={value==='ko'?'한국어':'English'} aria-pressed={locale===value} className={`min-h-11 ${compact?'min-w-11 px-2 sm:min-w-12':'min-w-12 px-3 sm:min-w-14'} rounded-md text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 ${locale===value?'bg-slate-900 text-white':'bg-white text-slate-700 hover:bg-slate-100'}`} onClick={()=>{if(value!==locale)window.location.assign(localeURL(window.location.pathname+window.location.search+window.location.hash,value))}}>{value.toUpperCase()}</button>)}</div>}
