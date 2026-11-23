const names = new Intl.Collator('ko-KR', {usage:'sort', sensitivity:'variant', numeric:true})
/** 원문 표기는 보존한다. 공개 응답은 이름만 받으며 동일 이름의 기존 순서는 안정적으로 유지한다. */
export function sortHonorNames<T extends {id?:number; name?:string|null; display_name?:string|null}>(rows:readonly T[]):T[]{
 return [...rows].sort((a,b)=>names.compare(a.display_name??a.name??'',b.display_name??b.name??'') || (a.id!==undefined&&b.id!==undefined?a.id-b.id:0))
}
