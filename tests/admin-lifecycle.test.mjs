import {test} from 'node:test';
import assert from 'node:assert/strict';
import {loadSource,domTest} from './helpers/react-dom.mjs';
const globals={URL,Request,Response,TextDecoder,Error,crypto:globalThis.crypto};
const {handleAccountCreation}=loadSource('src/lib/admin/accounts.ts',{},globals);
const {parseAdminCommand}=loadSource('src/lib/admin/protocol.ts',{},globals);
const {parseTimetableRows}=loadSource('src/lib/timetable.ts');
const uid=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const env={OAZ_ADMIN_ENABLED:'true',OAZ_ADMIN_SCHEMA_VERSION:'2',OAZ_ADMIN_ORIGIN:'http://127.0.0.1:3301',OAZ_ADMIN_LOCAL_PROVISIONING:'true'};
const input={requestId:uid(10),slot:'admin6',email:'fake@example.invalid',password:'synthetic-password-never-live',displayName:'가짜 관리자',scopes:['editor_0_noti']};
const request=(body=input)=>new Request(env.OAZ_ADMIN_ORIGIN+'/api/admin/accounts',{method:'POST',headers:{origin:env.OAZ_ADMIN_ORIGIN,authorization:'Bearer synthetic_mock_token_only','content-type':'application/json'},body:JSON.stringify(body)});

test('unbounded numbered slots retain protected admin1 and private scope boundaries',()=>{
 const base={action:'accounts.upsert',requestId:uid(1),version:2,slot:'admin25',userId:uid(25),status:'active',revision:0,displayName:'가짜',scopes:['editor_0_noti']};
 assert.ok(parseAdminCommand(base));
 for(const change of [{slot:'admin1'},{slot:'admin0'},{slot:'admin02'},{scopes:['registered_member']},{scopes:['editor_0_noti','editor_0_noti']},{role:'SUPER_ADMIN'}])assert.equal(parseAdminCommand({...base,...change}),null);
});
test('account creation never reaches privileged Auth before current DB authorization',async()=>{
 let creates=0;
 const factory=()=>({verify:async()=>true,execute:async c=>c.action==='session'?{data:{version:1}}:{code:'42501'},createIdentity:async()=>{creates++;return uid(2)}});
 assert.equal((await handleAccountCreation(request(),env,factory)).status,403);assert.equal(creates,0);
});
test('account creation is disabled outside explicit local development',async()=>{
 for(const change of [{OAZ_ADMIN_LOCAL_PROVISIONING:'false'},{OAZ_ADMIN_ORIGIN:'https://fixture.invalid'}])assert.equal((await handleAccountCreation(request(),{...env,...change},()=>{throw Error('forbidden')})).status,503);
});
test('identity create is followed by fresh atomic assignment and never returns a password',async()=>{
 const calls=[];
 const factory=()=>({verify:async()=>true,execute:async c=>{calls.push(c.action);return {data:c.action==='session'?{version:1}:{}}},createIdentity:async()=>{calls.push('auth.create');return uid(6)}});
 const response=await handleAccountCreation(request(),env,factory);assert.equal(response.status,201);
 assert.deepEqual(calls,['session','accounts.prepare','auth.create','accounts.complete']);assert.doesNotMatch(await response.text(),/password|synthetic-password/);
});
test('partial provisioning preserves Auth identity for review instead of deleting it',async()=>{
 let creates=0;
 const response=await handleAccountCreation(request(),env,()=>({verify:async()=>true,execute:async c=>c.action==='session'?{data:{version:1}}:c.action==='accounts.complete'?{code:'40001'}:{data:{}},createIdentity:async()=>{creates++;return uid(6)}}));
 assert.equal(response.status,409);assert.equal(creates,1);assert.match(await response.text(),/PROVISIONING_REVIEW_REQUIRED/);
});
test('password and supplied actor/role cannot become an arbitrary DB command',async()=>{
 for(const change of [{actorId:uid(1)},{role:'SUPER_ADMIN'},{password:'short'},{slot:'admin1'}])assert.equal((await handleAccountCreation(request({...input,...change}),env,()=>{throw Error('must not run')})).status,400);
});
test('timetable rejects malformed/range-crossing rows and retains stable IDs',()=>{
 const row={id:7,study_name:'가짜 스터디',leader:'가짜',color:'#112233',start_time:'월요일 11:30',end_time:'월요일 13:00',created_at:null};
 const result=parseTimetableRows([row,{...row,id:8,end_time:'화요일 13:00'},{...row,id:9,start_time:'월요일 25:00'},row]);
 assert.equal(result.length,1);assert.equal(result[0].id,'7');assert.equal(result[0].endSlot-result[0].startSlot,3);
 assert.equal(parseTimetableRows([{...row,start_time:'월요일 13:00'}]).length,0);
});
test('account UI lists identities and never offers admin1 suspension',async()=>{
 await domTest(async({render,container})=>{
  const {AdminAccounts}=loadSource('src/app/admin/accounts/management.tsx',{
   '@/lib/admin/credentials-client':{credentialsCommand:async()=>[]},
   'next/navigation':{useRouter:()=>({replace(){}}),usePathname:()=>'/admin/accounts',useSearchParams:()=>new URLSearchParams()},
   '@/lib/admin/client':{adminCommand:async c=>c.action==='session'?{version:1}:[{slot:'admin1',display_name:'가짜 최고관리자',role:'SUPER_ADMIN',status:'active',scopes:[]}]},
   '@/lib/supabaseClient':{supabase:{auth:{}}}},globals);
  await render(AdminAccounts);assert.match(container.textContent,/가짜 최고관리자/);assert.equal(container.querySelectorAll('article button').length,0);assert.equal(container.querySelector('input[type=password]'),null);assert.equal(container.querySelectorAll('[role=tab]').length,1);assert.equal(container.querySelector('#account-tab-create'),null);
 });
});
test('new editor mode hides member/approval/account tables',async()=>{
 await domTest(async({render,container})=>{
  const {BoardTabs}=loadSource('src/app/editor/components/BoardTabs.tsx',{'@/lib/admin/protocol':{adminEditorEnabled:()=>true}});
  await render(BoardTabs,{board:'공지',onChange(){}});
  assert.match(container.textContent,/공지/);assert.doesNotMatch(container.textContent,/등록회원|승인email|관리자id|명예의 전당/);
 });
});
test('valid stored login session restores verified server cookie without another password',async()=>{
 await domTest(async({render,container,act,window})=>{
  let redirects=0,cookies=0;
  const router={push(){},replace(path){assert.equal(path,'/admin');redirects++;},refresh(){}};
  const {AdminLogin}=loadSource('src/app/admin/login/sign-in.tsx',{
   'next/navigation':{useRouter:()=>router},'@/lib/admin/client':{adminCommand:async()=>({role:'ADMIN'})},
   '@/lib/supabaseClient':{supabase:{auth:{getSession:async()=>({data:{session:{access_token:'mock_session_only'}}})}}}
  },{...globals,fetch:async path=>{assert.equal(path,'/api/admin/session');cookies++;return {ok:true}}});
  await render(AdminLogin,{origin:window.location.origin});await act(async()=>new Promise(r=>setTimeout(r,30)));
  assert.equal(redirects,1);assert.equal(cookies,1);assert.equal(container.querySelector('input[type=password]').value,'');
 });
});
test('MFA setup cannot create duplicate factors and successful verification refreshes server state',async()=>{
 await domTest(async({render,container,act,window})=>{
  let enrollments=0,confirmed=0;
  const {AdminSecurity}=loadSource('src/app/admin/security.tsx',{
   'next/navigation':{useRouter:()=>({refresh(){}})},'@/lib/admin/session':{syncAdminCookie:async()=>{confirmed++;}},
   '@/lib/supabaseClient':{supabase:{auth:{mfa:{listFactors:async()=>({data:{totp:[]}}),enroll:async()=>{enrollments++;return {data:{id:'fake-factor',totp:{qr_code:'data:image/svg+xml;utf-8,<svg></svg>'}}}},challengeAndVerify:async()=>({error:null})}}}}
  },globals);
  await render(AdminSecurity);await act(async()=>container.querySelector('button').click());
  assert.equal(enrollments,1);assert.equal(container.querySelector('button').disabled,true);assert.match(container.querySelector('img').src,/^data:image\/svg\+xml/);
  const input=container.querySelector('input');await act(async()=>{Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set.call(input,'123456');input.dispatchEvent(new window.Event('input',{bubbles:true}));});
  await act(async()=>container.querySelector('form').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true})));
  assert.equal(confirmed,1);assert.equal(container.querySelector('img'),null);assert.match(container.textContent,/추가 인증이 완료/);
 });
});
