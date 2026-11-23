import {serverClient} from '@/lib/admin/server-client'
import {adminPort} from '@/lib/admin/server'
import {handlePromotionRequest} from '@/lib/admin/promotion-http'
import {loadDraftEnglish,publishReviewedEnglish} from '@/lib/promotion-english-review'
import type {Draft} from '@/lib/admin/promotion-contract'
export const dynamic='force-dynamic'
export async function POST(request:Request){return handlePromotionRequest(request,process.env,token=>{
 const client=serverClient(token)
 return {verify:adminPort(token).verify,execute:async command=>{
  const reviewed:{draft:Draft;english:{title:string;body:string}}[]=[]
  if(command.action==='approve')for(const item of command.items??[]){
   const read=await client.rpc('oaz_promotion_command_v1',{command:{action:'get',id:item.id,requestId:crypto.randomUUID()}})
   if(read.error)return {data:null,code:read.error.code||'TRANSPORT_ERROR'}
   const draft=read.data as Draft
   if(draft.source_type==='gmail'&&draft.source_label==='공개 홍보 메일 · 수동 검수')return {data:null,code:'PTM01'}
   if(draft.source_type==='gmail'){
    const english=await loadDraftEnglish(draft,item.revision,process.env)
    if(!english)return {data:null,code:'PTE01'}
    reviewed.push({draft,english})
   }
  }
  const {data,error}=await client.rpc('oaz_promotion_command_v1',{command})
  if(!error&&reviewed.length){let englishPending=false;for(const entry of reviewed){const item=data?.items?.find((x:{id:string;postId?:number})=>x.id===entry.draft.id);if(item?.postId!==undefined&&!await publishReviewedEnglish(client,entry.draft,item.postId,entry.english))englishPending=true}return {data:{...data,englishPending}}}
  return {data,code:error?(error.code||'TRANSPORT_ERROR'):undefined}
 }}
})}
