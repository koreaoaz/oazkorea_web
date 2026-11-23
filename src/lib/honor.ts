/** 승인된 공개 소개만 허용한다. 원본 ID·승인 근거·담당자는 공개하지 않는다. */
export type PublicHonor = { display_name: string; generation?:string; affiliation?:string; introduction?:string; display_order?:number }

export function parsePublicHonor(value: unknown): PublicHonor[] {
  if (!Array.isArray(value) || value.length > 500) throw new Error('INVALID_PUBLIC_HONOR')
  return value.map(row => {
    if (!row || typeof row !== 'object' || Array.isArray(row) ||
      Object.keys(row).some(k=>!['display_name','generation','affiliation','introduction','display_order'].includes(k)) || typeof row.display_name !== 'string' ||
      row.display_name.trim().length < 1 || row.display_name.length > 100) {
      throw new Error('INVALID_PUBLIC_HONOR')
    }
    const result:PublicHonor={display_name:row.display_name}
    for(const [key,max] of [['generation',20],['affiliation',160],['introduction',2000]] as const){
      if(key in row){if(typeof row[key]!=='string'||row[key].length>max)throw new Error('INVALID_PUBLIC_HONOR');result[key]=row[key]}
    }
    if('display_order' in row){if(!Number.isSafeInteger(row.display_order)||row.display_order<0||row.display_order>999999)throw new Error('INVALID_PUBLIC_HONOR');result.display_order=row.display_order}
    return result
  })
}
