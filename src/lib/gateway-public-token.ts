/** The Supabase API gateway translates publishable keys; private PostgREST cannot.
 * Only anonymous server requests use this separately provisioned anon JWT.
 * User JWTs remain byte-for-byte unchanged and the Node gateway verifies signatures.
 */
export function gatewayToken(token:string|undefined,env:Readonly<Record<string,string|undefined>>,production:boolean){
 if(token&&token!==env.NEXT_PUBLIC_SUPABASE_KEY)return token
 if(!production)return token??env.NEXT_PUBLIC_SUPABASE_KEY
 if(env.OAZ_GATEWAY_TRANSPORT==='data-api-v1'){
  const key=env.NEXT_PUBLIC_SUPABASE_KEY
  if(!key?.startsWith('sb_publishable_'))throw Error('PUBLIC_GATEWAY_KEY_REQUIRED')
  return key
 }
 const value=env.OAZ_PUBLIC_READER_JWT
 try{
  if(!value||!/^[-\w]+\.[-\w]+\.[-\w]+$/.test(value))throw Error()
  const [header,claims]=value.split('.').slice(0,2).map(s=>JSON.parse(Buffer.from(s,'base64url').toString('utf8')))
  if(header.alg!=='HS256'||claims.role!=='anon'||claims.iss!=='supabase'||claims.ref!=='maoefmwpdcnugyenyiea'||claims.aud!==undefined||claims.sub!==undefined||claims.session_id!==undefined||!Number.isSafeInteger(claims.exp)||claims.exp<=Date.now()/1000)throw Error()
  return value
 }catch{throw Error('PUBLIC_GATEWAY_JWT_REQUIRED')}
}
