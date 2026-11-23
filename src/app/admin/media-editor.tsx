'use client'


import {T,useUIText} from '@/components/LocaleProvider';
import {mainPresentation} from '@/lib/main-presentation'
import {directImageUpload,type DirectUploadState} from '@/lib/admin/direct-media-client'
import {MediaPreview} from './media-preview'
import {useEffect,useImperativeHandle,useRef,useState,type Ref} from 'react'
import type {ChangeCategory} from '@/lib/admin/boards'
import Image from 'next/image'
import {supabase} from '@/lib/supabaseClient'
import {adminCommand} from '@/lib/admin/client'
import {MEDIA_BUCKETS} from '@/lib/admin/media-upload'
import {getEventImages} from '@/app/editor/utils/parsing_first'
import {Button} from '@/components/ui/button'
import {useImageUpload} from '@/app/editor/hooks/useImageUpload'
type Row=Record<string,unknown>&{id:number;_revision:number}
export type MediaEditorHandle={prepare:()=>Promise<Record<string,unknown>>}
export function mediaPayload(table:string,paths:string[],row:Record<string,unknown>={}){
 const projectImage=paths[0]&&paths[0]===row.image_url?{filename:row.filename??null,image_url:row.image_url}:{filename:paths[0]??null,image_url:null}
 return table==='editor_6_events'?{filenames:paths.map((filename,order)=>({filename,order}))}:table==='editor_1_projects'?projectImage:{filename:paths[0]??null}
}
export function MediaEditor({table,row:existingRow,onSaved,locked=false,onDirty,classification,draft=false,ref}:{table:string;row?:Row;onSaved?:()=>Promise<void>;locked?:boolean;onDirty?:(value:boolean)=>void;classification?:{changeCategory:ChangeCategory;changeReason:string};draft?:boolean;ref?:Ref<MediaEditorHandle>}){
 const uiText=useUIText();

 const row:Row=existingRow??{id:0,_revision:0}
 const bucket=MEDIA_BUCKETS[table]
 const initial=table==='editor_6_events'?getEventImages(row.filenames).map(i=>i.filename):table==='editor_1_projects'&&typeof row.image_url==='string'&&row.image_url?[row.image_url]:typeof row.filename==='string'?[row.filename]:[]
 const [rights,setRights]=useState(false)
 const [paths,setPaths]=useState<string[]>(initial),[message,setMessage]=useState(''),[busy,setBusy]=useState(false)
 const image=useImageUpload(),file=image.file
 const pending=useRef(false),fileInput=useRef<HTMLInputElement>(null),retry=useRef<{body:string;id:string}|null>(null),uploadController=useRef<AbortController|null>(null)
 const directState=useRef<DirectUploadState|null>(null)
 const presentationMediaLimit=()=>5*1024*1024
 const original=useRef(JSON.stringify(initial))
 useEffect(()=>{onDirty?.(!!file||JSON.stringify(paths)!==original.current);return()=>onDirty?.(false)},[file,paths,onDirty])
 useEffect(()=>()=>uploadController.current?.abort(),[])
 useImperativeHandle(ref,()=>({prepare:async()=>{
  if(pending.current)throw Error('이미지 처리 중입니다. 잠시 후 다시 시도해 주세요.')
  pending.current=true;setBusy(true)
  try{return mediaPayload(table,await upload(),row)}finally{pending.current=false;setBusy(false)}
 }}))
 if(!bucket)return null
 async function run(task:()=>Promise<unknown>){if(pending.current||locked)return;pending.current=true;setBusy(true);setMessage('');try{await task()}catch(e){setMessage(e instanceof Error&&e.name==='AbortError'?'전송을 취소했습니다. 선택한 파일은 유지됩니다. 다시 업로드할 수 있습니다.':e instanceof Error?e.message:'처리하지 못했습니다. 선택 내용은 유지됩니다.')}finally{pending.current=false;setBusy(false)}}
 async function upload(){
  if(!file)return paths
  if(!rights)throw Error('이미지의 개인정보·저작권·공개 승인을 먼저 확인해 주세요.')
  if(file.size>presentationMediaLimit())throw Error(`이미지는 ${presentationMediaLimit()/1024/1024}MiB 이하여야 합니다.`)
  if(!['image/png','image/jpeg','image/webp'].includes(file.type))throw Error('PNG, JPEG, WebP 파일만 사용할 수 있습니다.')
  const {data}=await supabase.auth.getSession();if(!data.session)throw Error('로그인이 필요합니다.')
  setMessage('이미지를 업로드하고 확인하는 중입니다…')
  uploadController.current=new AbortController()
  const result=await directImageUpload(file,table,data.session.access_token,uploadController.current.signal,directState)
  const next=table==='editor_6_events'?[...paths,result.path]:[result.path]
  setPaths(next);image.reset();if(fileInput.current)fileInput.current.value=''
  setMessage(draft?'업로드했습니다. 작성 완료를 누르면 게시물에 연결됩니다.':'업로드했습니다. 미리보기를 확인하고 이미지 연결을 저장해 주세요.')
  return next
 }
 async function save(){
  const session=await adminCommand({action:'session',version:0}) as {version:number}
  const payload=mediaPayload(table,paths,row)
  const command={action:'content.update' as const,version:session.version,table,id:row.id,revision:row._revision,payload,...classification}
  const body=JSON.stringify(command);if(retry.current?.body!==body)retry.current={body,id:crypto.randomUUID()}
  await adminCommand({...command,requestId:retry.current.id});retry.current=null
  await onSaved?.();setMessage('이미지 연결을 저장했습니다. 원본 파일은 삭제하지 않았습니다.')
 }
 return <section aria-label={uiText("콘텐츠 이미지 관리")} className="admin-panel space-y-5"><div><h3 className="text-lg font-semibold"><T text="콘텐츠 이미지"/></h3><p className="mt-1 text-sm text-slate-600"><T text={draft?'파일을 선택하고 작성 완료를 누르면 업로드 후 게시물에 함께 연결합니다. 미리 업로드해 확인할 수도 있습니다.':'1. 파일 선택 → 2. 업로드·미리보기 확인 → 3. 이미지 연결 저장'}/></p></div><p className="text-sm text-slate-600"><T text={(mainPresentation()||process.env.NEXT_PUBLIC_OAZ_FINAL_ACCEPTANCE==='true')?'공개 콘텐츠용 이미지입니다. 승인된 이미지가 게시물에 연결되면 공개 페이지에 표시됩니다.':'공개 콘텐츠용 이미지입니다. 업로드한 파일은 공개 주소로 제공됩니다.'}/><T text={`개인정보·비공개 자료는 올리지 마세요. PNG/JPEG/WebP · 최대 ${presentationMediaLimit()/1024/1024}MiB.`}/></p>
  <label className="flex items-start gap-2"><input type="checkbox" checked={rights} disabled={busy||locked} onChange={e=>setRights(e.target.checked)}/><T text="공개 가능한 학회 이미지이며 개인정보와 제3자 저작권을 확인했고 공개 업로드에 동의합니다."/></label>
  <div className="flex flex-wrap items-center gap-3"><input ref={fileInput} aria-label={uiText("이미지 파일")} type="file" accept="image/png,image/jpeg,image/webp" disabled={busy||locked} onChange={e=>{image.handleChange(e);setRights(false);setMessage('')}}/><Button type="button" disabled={busy||locked||!file||!rights} onClick={()=>void run(upload)}><T text={busy?'처리 중…':table==='editor_6_events'?'이미지 추가 업로드':'이미지 업로드·교체'}/></Button></div>
  {busy&&<Button type="button" variant="outline" onClick={()=>uploadController.current?.abort()}><T text="전송 취소"/></Button>}
  {image.preview&&<Image src={image.preview} alt={uiText("선택한 이미지 미리보기")} width={160} height={90} unoptimized className="aspect-video rounded-lg border object-contain"/>}
  <div className="flex flex-wrap gap-4">{paths.map((path,index)=><div key={`${path}-${index}`} className="max-w-full space-y-2 rounded-xl border bg-white p-3"><MediaPreview bucket={bucket} path={path} index={index}/><Button type="button" variant="outline" disabled={busy||locked} onClick={()=>{if(window.confirm(uiText('이 이미지의 연결을 제거할까요? 원본 파일은 보존됩니다.')))setPaths(current=>current.filter((_,i)=>i!==index))}}><T text="연결 제거"/></Button></div>)}</div>
  {!paths.length&&<p className="text-sm text-slate-600"><T text="연결할 이미지가 없습니다."/></p>}
  {!draft&&<Button type="button" disabled={busy||locked} onClick={()=>void run(save)}><T text="이미지 연결 저장"/></Button>}
  {message&&<p role="status" className="rounded-lg bg-white p-3"><T text={message}/></p>}
  <p className="text-xs text-slate-500"><T text="교체·연결 제거 시 공유 파일을 자동 삭제하지 않습니다. 저장 실패 시 새 파일은 검토 대상으로 보존됩니다."/>{(mainPresentation()||process.env.NEXT_PUBLIC_OAZ_FINAL_ACCEPTANCE==='true')&&' 마지막 게시글 연결을 제거하고 저장하면 공개 URL도 차단됩니다. 다른 글이 공유 중인 이미지는 계속 표시됩니다.'}</p>
 </section>
}
