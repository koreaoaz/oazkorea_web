import {mailReviewReasons} from './gmail-review'
export type MailCopy={title:string;body:string;summary:string;applicationURL:string;opensOn:string|null;closesOn:string|null;englishTitle:string;englishBody:string;englishConfirmed:boolean}
export function safeMailCopy(value:unknown):value is MailCopy{
 if(!value||typeof value!=='object'||Array.isArray(value))return false
 const c=value as Record<string,unknown>,limits:Record<string,number>={title:300,body:25000,summary:2000,applicationURL:2048,englishTitle:300,englishBody:30000}
 if(Object.keys(c).some(k=>![...Object.keys(limits),'opensOn','closesOn','englishConfirmed'].includes(k)))return false
 for(const [key,limit] of Object.entries(limits))if(typeof c[key]!=='string'||(c[key] as string).length>limit)return false
 if(!(c.title as string).trim()||(c.body as string).trim().length<20||typeof c.englishConfirmed!=='boolean')return false
 if(c.englishConfirmed&&(!(c.englishTitle as string).trim()||!(c.englishBody as string).trim()))return false
 const date=(v:unknown)=>v===null||typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v
 if(!date(c.opensOn)||!date(c.closesOn)||typeof c.opensOn==='string'&&typeof c.closesOn==='string'&&c.opensOn>c.closesOn)return false
 if(c.applicationURL&&!/^https:\/\/[A-Za-z0-9.-]+(?::443)?(?:\/[^?#@\s]*)?$/.test(c.applicationURL as string))return false
 const text=Object.keys(limits).map(k=>c[k]).join('\n')
 return !mailReviewReasons(text).some(x=>['PRIVATE_RECORD','CREDENTIAL','CONFIDENTIAL_NOTICE'].includes(x))&&!/계좌|개인정보|주민등록|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}|0?1[016789][- .]?\d{3,4}[- .]?\d{4}|0\d{1,2}[- .]\d{3,4}[- .]\d{4}|\b\d{6}[- ]?[1-8]\d{6}\b|<[^>]+>/i.test(text)
}
