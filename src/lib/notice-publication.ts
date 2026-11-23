export const PUBLIC_NOTICE_FEED='oaz_notice_feed'
/** A publication date has no inferred hour or timezone. Registration time stays in created_at. */
export function noticeDate(day:unknown,compact=false){
 if(typeof day!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(day))return ''
 const [year,month,date]=day.split('-')
 return compact?`${Number(month)}. ${Number(date)}.`:`${year}. ${month}. ${date}.`
}
