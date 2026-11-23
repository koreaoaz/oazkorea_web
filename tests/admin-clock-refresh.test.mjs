import {test} from 'node:test'
import assert from 'node:assert/strict'
import {loadSource} from './helpers/react-dom.mjs'
const origin='https://site.example'
const token=id=>'header.'+Buffer.from(JSON.stringify({session_id:id})).toString('base64url')+'.signature'
function fixture({refreshError=null,identityError=false,logoutError=false}={}){
 const updates=[],ends=[]
 const session={access_token:token('second'),refresh_token:'rotated-synthetic'}
 const route=loadSource('src/app/api/admin/auth-session/route.ts',{
  'server-only':{},'next/server':{NextResponse:Response},
  'next/headers':{cookies:async()=>({get:()=>({value:'synthetic'})})},
  '@/lib/admin/role-password-policy':{rolePasswordEnabled:()=>true},
  '@/lib/admin/credentials-server':{credentialsConfiguration:()=>({origin}),credentialsAuth:()=>({auth:{
   refreshSession:async()=>({error:refreshError,data:{session:refreshError?null:session}}),
   admin:{signOut:async(jwt,scope)=>{ends.push(scope);return {error:logoutError?{}:null}}}
  }})},
  '@/lib/admin/password-session-server':{REFRESH_COOKIE:'refresh',boundedJSON:r=>r.json(),
   passwordIdentity:async()=>{if(identityError)throw Error();return {userId:'admin'}},
   sessionResponse:()=>Response.json({ok:true}),setRefreshCookie:(_,v)=>updates.push(v),clearPasswordCookies:()=>Response.json({ok:true})}
 },{Response,Buffer})
 const post=(data={},bearer)=>route.POST(new Request(origin,{method:'POST',headers:{origin,...(bearer?{Authorization:'Bearer '+bearer}:{})},body:JSON.stringify(data)}))
 const logout=()=>route.DELETE(new Request(origin,{method:'DELETE',headers:{origin}}))
 return {post,logout,updates,ends}
}
test('transient Auth failure is retryable and revocation requires a new login',async()=>{
 assert.equal((await fixture({refreshError:{status:503}}).post()).status,503)
 assert.equal((await fixture({refreshError:{code:'session_not_found'}}).post()).status,401)
 const f=fixture({identityError:true});assert.equal((await f.post()).status,503);assert.deepEqual(f.updates,['rotated-synthetic'])
})
test('MFA refresh stays paired with the verified login session',async()=>{
 assert.equal((await fixture().post({refreshToken:'test'},token('first'))).status,401)
 assert.equal((await fixture().post({refreshToken:'test'},token('second'))).status,200)
})
test('current-session logout reports provider failure and retains the rotated cookie for retry',async()=>{
 const f=fixture({logoutError:true});assert.equal((await f.logout()).status,503);assert.deepEqual(f.ends,['local']);assert.deepEqual(f.updates,['rotated-synthetic'])
 const ok=fixture();assert.equal((await ok.logout()).status,200);assert.deepEqual(ok.ends,['local'])
})
