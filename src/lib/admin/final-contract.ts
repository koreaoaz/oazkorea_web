import {CONTENT_TABLES} from './policy'
import {UUID_PATTERN} from './protocol'
export type FinalCommand={action:'trash.list'|'trash.restore'|'history.list'|'translation.list'|'translation.get'|'translation.save'|'metadata.save'|'sessions.revoke';requestId:string;version?:number;table?:string;id?:number;revision?:number;trashId?:string;sourceHash?:string;title?:string;body?:string;userId?:string;opensOn?:string|null;closesOn?:string|null;activityOn?:string|null}
const integer=(x:unknown)=>Number.isSafeInteger(x)&&Number(x)>=0
export function parseFinalCommand(value:unknown):FinalCommand|null{
 if(!value||typeof value!=='object'||Array.isArray(value))return null
 const v=value as Record<string,unknown>,action=String(v.action)
 const fields:Record<string,string[]>={'trash.list':['table'],'trash.restore':['table','trashId','revision','version'],'history.list':['table','id'],'translation.list':['table','id'],'translation.get':['table','id'],'translation.save':['table','id','revision','version','sourceHash','title','body'],'metadata.save':['table','id','revision','version','opensOn','closesOn','activityOn'],'sessions.revoke':['userId','version']}
 if(!fields[action]||typeof v.requestId!=='string'||!UUID_PATTERN.test(v.requestId)||Object.keys(v).some(k=>!['action','requestId',...fields[action]].includes(k)))return null
 if(action!=='sessions.revoke'&&!CONTENT_TABLES.some(t=>t===v.table))return null
 if(action==='translation.list'&&(v.table!=='editor_0_noti'||(v.id!==undefined&&!integer(v.id))))return null
 if(['history.list','translation.get','translation.save','metadata.save'].includes(action)&&!integer(v.id))return null
 if(['trash.restore','translation.save','metadata.save','sessions.revoke'].includes(action)&&!integer(v.version))return null
 if(['trash.restore','translation.save','metadata.save'].includes(action)&&!integer(v.revision))return null
 if(action==='trash.restore'&&(typeof v.trashId!=='string'||!UUID_PATTERN.test(v.trashId)))return null
 if(action==='sessions.revoke'&&(typeof v.userId!=='string'||!UUID_PATTERN.test(v.userId)))return null
 if(action==='translation.save'&&(typeof v.sourceHash!=='string'||!/^[a-f0-9]{64}$/.test(v.sourceHash)||typeof v.title!=='string'||!v.title.trim()||v.title.length>500||typeof v.body!=='string'||v.body.length>40000))return null
 if(action==='metadata.save'&&['opensOn','closesOn','activityOn'].some(k=>v[k]!=null&&(typeof v[k]!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(String(v[k]))||!Number.isFinite(Date.parse(String(v[k])))||new Date(String(v[k])).toISOString().slice(0,10)!==v[k])))return null
 return v as FinalCommand
}
