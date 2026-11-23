import sharp from 'sharp'
/** 실제 디코딩과 픽셀 제한을 적용하고 원본 메타데이터를 제거한다. */
export async function normalizeImage(bytes:Uint8Array):Promise<Uint8Array>{
 const input=sharp(bytes,{limitInputPixels:16_000_000,animated:false,failOn:'warning'})
 const meta=await input.metadata()
 if(!['jpeg','png','webp'].includes(meta.format??'')||(meta.pages??1)>1||!meta.width||!meta.height)throw Error('INVALID_IMAGE')
 return input.rotate().webp({quality:85}).toBuffer()
}

/** Bounded display derivative; original Storage bytes and lineage stay untouched. */
export async function normalizeDeliveryImage(bytes:Uint8Array):Promise<Uint8Array>{
 const normalized=await normalizeImage(bytes)
 if(normalized.length<=4*1024*1024)return normalized
 const result=await sharp(normalized,{limitInputPixels:16_000_000,failOn:'warning'}).resize({width:2048,height:2048,fit:'inside',withoutEnlargement:true}).webp({quality:80}).toBuffer()
 if(result.length>4*1024*1024)throw Error('IMAGE_OUTPUT_LIMIT')
 return result
}

/** News list only. Fit the entire image at up to 3x its mobile display height. */
export async function newsCardImage(bytes:Uint8Array):Promise<Uint8Array>{
 const image=sharp(bytes,{limitInputPixels:16_000_000,animated:false,failOn:'warning'})
 const meta=await image.metadata()
 if(!['jpeg','png','webp'].includes(meta.format??'') || (meta.pages??1)!==1)return bytes
 const thumbnail=await image.rotate().resize({width:960,height:960,fit:'inside',withoutEnlargement:true}).webp({quality:90,effort:3}).toBuffer()
 return thumbnail.length<bytes.length?thumbnail:bytes
}
