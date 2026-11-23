import type {Draft} from './admin/promotion-contract'
export type MailListItem={key:string;title:string;receivedAt:string;status:string}
export type ApprovalItem={id:string;title:string;date:string;status:'pending'|'reviewing'|'approved';source:'mail'|'fixture'|'import';category:string}
export function manualMailKey(draft:Draft){return draft.source_type==='gmail'&&draft.source_label==='공개 홍보 메일 · 수동 검수'&&/^[a-f0-9]{64}$/.test(draft.source_fingerprint??'')?draft.source_fingerprint!:null}
export function approvalItems(drafts:readonly Draft[],mails:readonly MailListItem[]):ApprovalItem[]{
 const rows=new Map<string,ApprovalItem>()
 for(const d of drafts){const id=manualMailKey(d)??d.id;rows.set(id,{id,title:d.title,date:d.created_at,status:d.status==='approved'?'approved':manualMailKey(d)?'reviewing':'pending',category:d.category,source:d.source_type==='gmail'?'mail':d.source_type==='local_fixture'?'fixture':'import'})}
 for(const m of mails){const current=rows.get(m.key);rows.set(m.key,{id:m.key,title:current?.title??m.title,date:m.receivedAt,status:m.status==='published'?'approved':m.status==='reviewing'?'reviewing':'pending',category:current?.category??'other',source:'mail'})}
 return [...rows.values()].sort((a,b)=>b.date.localeCompare(a.date)||a.id.localeCompare(b.id))
}
