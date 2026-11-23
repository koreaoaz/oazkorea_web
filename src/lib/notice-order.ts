export type NoticeOrderRow={id:number;created_at?:unknown;pinned_at?:unknown}
/** DB가 반환한 동일 UTC 형식의 시각을 마이크로초까지 유지해 비교한다. */
export function compareNotices(a:NoticeOrderRow,b:NoticeOrderRow){
 const ap=typeof a.pinned_at==='string'?a.pinned_at:'',bp=typeof b.pinned_at==='string'?b.pinned_at:''
 return Number(!!bp)-Number(!!ap)||bp.localeCompare(ap)||String(b.created_at??'').localeCompare(String(a.created_at??''))||b.id-a.id
}
