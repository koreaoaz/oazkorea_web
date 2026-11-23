'use client'
import { adminCommand } from './client'
import { CONTENT_TABLES } from './policy'
import type { AdminCommand } from './protocol'
type Session={userId:string;version:number;contentReady:boolean}
type Row=Record<string,unknown>&{id:number;_revision:number}
const seen=new Map<string,{userId:string;row:Row}>()
const attempts=new Map<string,{command:AdminCommand;pending?:Promise<unknown>}>()
const scoped=(table:string)=>{if(!CONTENT_TABLES.some(t=>t===table))throw new Error('새 관리자 권한 범위에 포함되지 않은 게시판입니다.')}
async function session() {
  const value=await adminCommand({action:'session',version:0}) as Session
  if(!value || typeof value.userId!=='string' || !Number.isSafeInteger(value.version))throw new Error('관리자 상태를 확인하지 못했습니다.')
  return value
}
export async function bridgeList(table:string) {
  scoped(table)
  const current=await session()
  const rows=await adminCommand({action:'content.list',version:current.version,table}) as Row[]
  if(!Array.isArray(rows)||rows.some(r=>!Number.isSafeInteger(r.id)||r.id<0||!Number.isSafeInteger(r._revision)||r._revision<0))throw new Error('게시물 버전을 확인하지 못했습니다.')
  for(const [key] of seen)if(key.startsWith(`${table}/`))seen.delete(key)
  for(const row of rows)seen.set(`${table}/${row.id}`,{userId:current.userId,row})
  return rows
}
export async function bridgeWrite(action:'content.create'|'content.update'|'content.delete',table:string,id:number|null,payload:unknown,expectedRevision?:number) {
  scoped(table)
  if(!payload||typeof payload!=='object'||Array.isArray(payload))throw new Error('입력 형식을 확인해 주세요.')
  const clean=Object.fromEntries(Object.entries(payload).filter(([key])=>action!=='content.create'||key!=='created_at'))
  const current=await session()
  if(!current.contentReady)throw new Error('새 Editor 전환이 아직 완료되지 않았습니다.')
  if(expectedRevision!==undefined&&(!Number.isSafeInteger(expectedRevision)||expectedRevision<0))throw new Error('게시물 버전이 올바르지 않습니다.')
  const key=JSON.stringify([current.userId,action,table,id,expectedRevision,Object.fromEntries(Object.entries(clean).sort(([a],[b])=>a.localeCompare(b)))])
  let attempt=attempts.get(key)
  if(!attempt) {
    if(attempts.size>=64)throw new Error('미확인 요청이 많습니다. 새로고침하기 전에 저장 결과를 확인해 주세요.')
    const prior=id===null?null:seen.get(`${table}/${id}`)
    if(id!==null&&(!prior||prior.userId!==current.userId))throw new Error('목록을 새로고침한 후 다시 수정해 주세요.')
    attempt={command:{action,requestId:crypto.randomUUID(),version:current.version,table,
      ...(id===null?{}:{id,revision:expectedRevision??prior!.row._revision}),...(action==='content.delete'?{}:{payload:clean})}}
    attempts.set(key,attempt)
  }
  if(attempt.pending)return attempt.pending
  const entry=attempt
  const task=(async()=>{
    const result=await adminCommand(entry.command) as {id:number;revision:number}
    if(!result||!Number.isSafeInteger(result.id)||!Number.isSafeInteger(result.revision))throw new Error('저장 결과를 확인하지 못했습니다.')
    if(action==='content.delete') {
      seen.delete(`${table}/${id}`);attempts.delete(key);return {error:null,count:1}
    }
    const rows=await bridgeList(table)
    const row=rows.find(r=>r.id===result.id)
    if(!row)throw new Error('저장 응답은 받았지만 목록을 확인하지 못했습니다. 같은 입력으로 다시 확인해 주세요.')
    attempts.delete(key);return row
  })()
  entry.pending=task
  try{return await task}finally{entry.pending=undefined}
}
