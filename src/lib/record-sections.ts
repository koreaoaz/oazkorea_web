import type {ProjectSection} from '@/types/project'

export type RecordKind = 'project' | 'study'
export const sectionKeys = ['overview', 'activities', 'implementation', 'results'] as const
export const sectionLabels = {
  project: [['프로젝트 개요','Project overview'],['주요 활동','Main activities'],['학습 및 구현 내용','Learning and implementation'],['결과 및 정리','Results and reflections']],
  study: [['스터디 개요','Study overview'],['주요 활동','Main activities'],['학습 및 실습 내용','Learning and practice'],['학습 정리','Learning summary']],
} as const

// Numbered Markdown headings survive both the text-only database and the translation worker.
const marker = (index:number) => '## 0' + index
export function packSections(texts:string[], original:string) {
  return texts.map((text,i) => marker(i+1)+'\n'+text.replace(/^(?=\\|## 0[0-4]$)/gm,'\\')).join('\n\n') +
    (original ? '\n\n'+marker(0)+'\n'+original : '')
}
export function unpackSections(value:string) {
  const boundary=/\r?\n\r?\n## 00\r?\n/.exec(value)
  const cards=boundary?value.slice(0,boundary.index):value
  const blocks=cards.replace(/\r\n/g,'\n').split(/^## 0([1-4])\n/gm)
  if(blocks[0]!=='' || blocks.length!==9 || !sectionKeys.every((_,i)=>blocks[1+2*i]===String(i+1))) return
  const texts=sectionKeys.map((_,i)=>blocks[2+2*i].replace(/\n\n$/,'').replace(/^\\(?=\\|## 0[0-4]$)/gm,''))
  const original=boundary?value.slice(boundary.index+boundary[0].length):''
  return {texts,original}
}
export function savedSections(source:string, english=''):ProjectSection[]|undefined {
  const saved=unpackSections(source)
  if(!saved || saved.texts.some(s=>!s.trim())) return
  const en=unpackSections(english)
  return sectionKeys.map((kind,i)=>({kind,ko:saved.texts[i],en:en?.texts[i]??''}))
}
