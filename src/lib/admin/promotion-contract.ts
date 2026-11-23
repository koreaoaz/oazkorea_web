import {UUID_PATTERN} from './protocol'
import {CONTENT_TABLES} from './policy'
export type PromotionRights={manualEdit:boolean;approveDrafts:boolean;revision:number}
export type PromotionCommand={action:'list'|'get'|'approve'|'account.save'|'batch.get'|'edit';requestId?:string;id?:string;items?:{id:string;revision:number}[];status?:string;search?:string;category?:string;page?:number;pageSize?:number;slot?:string;userId?:string;revision?:number;displayName?:string;scopes?:string[];manualEdit?:boolean;approveDrafts?:boolean;permissionRevision?:number;version?:number;title?:string;body?:string;opensOn?:string|null;closesOn?:string|null}
export const PROMOTION_CATEGORIES={recruitment:'채용',internship:'인턴',seminar:'세미나·행사',contest:'공모전',other:'기타'} as const
export type Draft={id:string;title:string;body?:string;category:string;organization?:string|null;audience?:string|null;opens_on?:string|null;closes_on:string|null;application_url?:string|null;image_path?:string|null;image_public_approved?:boolean;attachments?:{label?:string}[];source_type:string;source_label?:string;source_fingerprint?:string;status:'pending'|'approved';revision:number;created_at:string;updated_at?:string;approved_at?:string|null;approved_by_slot?:string|null;published_post_id:number|null}
export type DraftList={rows:Draft[];total:number;pendingCount:number;page:number;pageSize:number}
export type ApprovalResult={englishPending?:boolean;items:{id:string;status:'approved'|'already_approved'|'failed';postId?:number;error?:string}[];requestId:string}
export function safeApplicationURL(value:unknown){try{if(typeof value!=='string')return null;const u=new URL(value);return ['https:','http:'].includes(u.protocol)&&!u.username&&!u.password?u.href:null}catch{return null}}
const integer=(v:unknown)=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0
export function parsePromotionCommand(value:unknown):PromotionCommand|null{
 if(!value||typeof value!=='object'||Array.isArray(value))return null
 const v=value as Record<string,unknown>,action=String(v.action)
 const fields:Record<string,string[]>={edit:['id','revision','title','body','opensOn','closesOn'],list:['status','search','category','page','pageSize'],get:['id'],'batch.get':['id'],approve:['items'],'account.save':['slot','userId','status','revision','displayName','scopes','manualEdit','approveDrafts','permissionRevision','version']}
 if(!fields[action]||typeof v.requestId!=='string'||!UUID_PATTERN.test(v.requestId)||Object.keys(v).some(k=>!['action','requestId',...fields[action]].includes(k)))return null
 if(['get','batch.get'].includes(action)&&(typeof v.id!=='string'||!UUID_PATTERN.test(v.id)))return null
 if(action==='list'&&(('status'in v&&!['pending','approved','all'].includes(String(v.status)))||('category'in v&&!['all',...Object.keys(PROMOTION_CATEGORIES)].includes(String(v.category)))||('search'in v&&(typeof v.search!=='string'||v.search.length>100))||('page'in v&&(!integer(v.page)||Number(v.page)>100000))||('pageSize'in v&&(!integer(v.pageSize)||Number(v.pageSize)<1||Number(v.pageSize)>50))))return null
 if(action==='edit'){
  const date=(v:unknown)=>v===null||(typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&!Number.isNaN(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v);
  if(typeof v.id!=='string'||!UUID_PATTERN.test(v.id)||!integer(v.revision)||typeof v.title!=='string'||!v.title.trim()||v.title.length>300||typeof v.body!=='string'||v.body.length>40000||!date(v.opensOn)||!date(v.closesOn)||(typeof v.opensOn==='string'&&typeof v.closesOn==='string'&&v.opensOn>v.closesOn))return null;
 }
 if(action==='approve'){
  if(!Array.isArray(v.items)||v.items.length<1||v.items.length>25)return null
  const seen=new Set<string>();for(const item of v.items){if(!item||typeof item!=='object'||Array.isArray(item)||Object.keys(item).some(k=>!['id','revision'].includes(k))||typeof item.id!=='string'||!UUID_PATTERN.test(item.id)||!integer(item.revision)||seen.has(item.id.toLowerCase()))return null;seen.add(item.id.toLowerCase())}
 }
 if(action==='account.save'&&(typeof v.slot!=='string'||!/^admin[1-9][0-9]{0,6}$/.test(v.slot)||v.slot==='admin1'||typeof v.userId!=='string'||!UUID_PATTERN.test(v.userId)||!['active','disabled'].includes(String(v.status))||!integer(v.revision)||!integer(v.permissionRevision)||!integer(v.version)||typeof v.displayName!=='string'||v.displayName.length>80||typeof v.manualEdit!=='boolean'||typeof v.approveDrafts!=='boolean'||!Array.isArray(v.scopes)||v.scopes.length>CONTENT_TABLES.length||new Set(v.scopes).size!==v.scopes.length||v.scopes.some(t=>!CONTENT_TABLES.some(x=>x===t))))return null
 return v as PromotionCommand
}
