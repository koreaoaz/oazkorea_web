/** Older locked SDKs send API keys as Bearer tokens. Opaque keys belong only in
 * apikey; retain every real user/legacy JWT unchanged. Never apply to private RPC.
 */
export function supabaseApiFetch(origin:string,transport:typeof fetch=fetch):typeof fetch{
 return async(input,init)=>{
  const req=new Request(input,init),headers=new Headers(req.headers),key=headers.get('apikey')
  if(key&&/^sb_(?:publishable|secret)_/.test(key)&&headers.get('authorization')==='Bearer '+key){
   if(new URL(req.url).origin!==new URL(origin).origin)throw Error('SUPABASE_KEY_DESTINATION_DENIED')
   headers.delete('authorization')
   return transport(input,{...init,headers,redirect:'error'})
  }
  return transport(input,init)
 }
}
