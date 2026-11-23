import {test} from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {loadSource} from './helpers/react-dom.mjs';
const {handleUsernameLogin,createLoginLimiter}=loadSource('src/lib/admin/username-login.ts',{}, {Request,Response,TextDecoder,crypto:webcrypto});
const origin='http://127.0.0.1:3304';
const identity={slot:'admin1',userId:'synthetic-id',email:'synthetic@example.invalid'};
const request=(body={username:'review.owner',password:' Synthetic=Only Phrase! '},headers={})=>new Request(origin+'/api/admin/login',{method:'POST',headers:{origin,'content-type':'application/json',...headers},body:JSON.stringify(body)});
function port(changes={}){return {resolve:async()=>identity,authenticate:async()=>({access_token:'synthetic-access',refresh_token:'synthetic-refresh'}),current:async()=>({...identity,role:'SUPER_ADMIN'}),discard:async()=>{},...changes}}
test('username separates slot and preserves exact password; only official token pair returned',async()=>{
 let received;const r=await handleUsernameLogin(request(),origin,port({authenticate:async(e,p)=>{received=[e,p];return {access_token:'synthetic-access',refresh_token:'synthetic-refresh'}}}),()=>true);
 assert.equal(r.status,200);assert.deepEqual(received,[identity.email,' Synthetic=Only Phrase! ']);
 const body=await r.text();assert.doesNotMatch(body,/email|slot|password|SUPER_ADMIN|synthetic-id/);assert.equal(r.headers.get('cache-control'),'no-store');
});
test('origin, method, JSON and bounded request rejected before provider',async()=>{
 let called=0;const p=port({authenticate:async()=>{called++;throw Error()}});
 for(const [r,status] of [[request({}, {origin:'https://evil.invalid'}),403],[new Request(origin),405],[request({}, {'content-type':'text/plain'}),415],[request({username:'review.owner',password:'x'.repeat(3000)}),413]])assert.equal((await handleUsernameLogin(r,origin,p,()=>true)).status,status);
 assert.equal(called,0);
});
test('disabled configuration never calls provider',async()=>{
 assert.equal((await handleUsernameLogin(request(),null,port({resolve:async()=>{throw Error('must not run')}}),()=>true)).status,503);
});
test('missing, invalid input and injected privilege fields are rejected',async()=>{
 for(const body of [{},{username:'ABC',password:'test'},{username:'review.owner',password:''},{username:'review.owner',password:'test',role:'SUPER_ADMIN'},{username:'review.owner',password:'test',userId:'other'},[]])assert.equal((await handleUsernameLogin(request(body),origin,port(),()=>true)).status,401);
});
test('unknown and wrong-password accounts have identical public errors',async()=>{
 const a=await handleUsernameLogin(request(),origin,port({resolve:async()=>null,authenticate:async()=>null}),()=>true);
 const b=await handleUsernameLogin(request(),origin,port({authenticate:async()=>null}),()=>true);
 assert.equal(a.status,b.status);assert.equal(await a.text(),await b.text());
});
test('live disabled, revoked, wrong identity, slot and role cannot receive a session',async()=>{
 for(const current of [null,{...identity,role:'ADMIN'},{...identity,role:'SUPER_ADMIN',userId:'other'},{...identity,role:'SUPER_ADMIN',slot:'admin2'}]){
  let discarded=0;const r=await handleUsernameLogin(request(),origin,port({current:async()=>current,discard:async()=>{discarded++}}),()=>true);
  assert.equal(r.status,401);assert.equal(discarded,1);assert.doesNotMatch(await r.text(),/synthetic-access|synthetic-refresh/);
 }
});
test('all five named aliases authorize only their verified slot and role',async()=>{
 for(let i=1;i<=5;i++){const a={...identity,slot:'admin'+i};assert.equal((await handleUsernameLogin(request(),origin,port({resolve:async()=>a,current:async()=>({...a,role:i===1?'SUPER_ADMIN':'ADMIN'})}),()=>true)).status,200)}
});

test('issued admin6 and later accounts log in only with matching identity and ordinary role',async()=>{
 for(const slot of ['admin6','admin99','admin9999999']){
  const a={...identity,slot};
  assert.equal((await handleUsernameLogin(request(),origin,port({resolve:async()=>a,current:async()=>({...a,role:'ADMIN'})}),()=>true)).status,200);
  assert.equal((await handleUsernameLogin(request(),origin,port({resolve:async()=>a,current:async()=>({...a,role:'SUPER_ADMIN'})}),()=>true)).status,401);
 }
 for(const slot of ['admin0','admin01','admin10000000','admin-1']){
  const a={...identity,slot};assert.equal((await handleUsernameLogin(request(),origin,port({resolve:async()=>a,current:async()=>({...a,role:'ADMIN'})}),()=>true)).status,401);
 }
});
test('provider errors never dump credentials',async()=>{
 const r=await handleUsernameLogin(request(),origin,port({authenticate:async()=>{throw Error('DO_NOT_PRINT_SECRET')}}),()=>true);
 assert.equal(r.status,401);assert.doesNotMatch(await r.text(),/DO_NOT_PRINT_SECRET/);
});
test('rate guard rejects before auth and expires without storing passwords',async()=>{
 let now=0;const consume=createLoginLimiter(()=>now);
 for(let i=0;i<8;i++)assert.equal(consume('one'),true);assert.equal(consume('one'),false);
 now=900001;assert.equal(consume('one'),true);
 for(let i=0;i<59;i++)assert.equal(consume('unique'+i),true);
 assert.equal(consume('different-name'),false);
 const r=await handleUsernameLogin(request(),origin,port({authenticate:async()=>{throw Error('not called')}}),()=>false);assert.equal(r.status,429);
});
