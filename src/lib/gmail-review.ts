import {createHash} from 'node:crypto'
import {publicMailText,type PublicMail,type SafeDraft} from './promotion-intake'
export function mailReviewReasons(text:string){
 const reasons:string[]=[]
 if(/confidential|비공개|대외비/i.test(text))reasons.push('CONFIDENTIAL_NOTICE')
 if(/급여|연봉|salary|compensation/i.test(text))reasons.push('COMPENSATION_REVIEW')
 if(/payroll|급여명세|인사평가|회원명부|출석부|통장|계좌|개인정보|주민등록|회계|bank account/i.test(text))reasons.push('PRIVATE_RECORD')
 if(/비밀번호|인증번호|인증 코드|password|verification code|\beyJ[A-Za-z0-9_-]+\./i.test(text))reasons.push('CREDENTIAL')
 return reasons.length?reasons:['HUMAN_REVIEW_REQUIRED']
}
/** Explicit human review, exact source offsets, conservative redaction. No raw-mail publication. */
export function reviewedExcerpt(mail:PublicMail,start:number,end:number,confirmed:boolean):SafeDraft{
 if(confirmed!==true||!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||end<=start||end>mail.text.length||end-start>30000)throw Error('INVALID_SELECTION')
 const selected=mail.text.slice(start,end),reasons=mailReviewReasons(selected)
 if(reasons.some(r=>['CONFIDENTIAL_NOTICE','PRIVATE_RECORD','CREDENTIAL'].includes(r)))throw Error('PRIVATE_SELECTION')
 const title=publicMailText(mail.subject).slice(0,300),body=publicMailText(selected)
 if(!title||body.length<20||mailReviewReasons(title).some(r=>['CONFIDENTIAL_NOTICE','PRIVATE_RECORD','CREDENTIAL'].includes(r)))throw Error('INVALID_SELECTION')
 // A salary figure in a public job ad is eligible only after a human confirms this exact excerpt.
 return {title,body,category:/모집|채용|recruit/i.test(title)?'recruitment':/공모|contest/i.test(title)?'contest':/세미나|seminar/i.test(title)?'seminar':'other',opensOn:null,closesOn:null,receivedAt:mail.receivedAt,fingerprint:createHash('sha256').update(title.replace(/\s+/g,' ').toLowerCase()+'\n'+body.replace(/\s+/g,' ').toLowerCase()).digest('hex')}
}
