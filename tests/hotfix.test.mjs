import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import vm from 'node:vm';
import ts from 'typescript';
import { loadSource, domTest, deferred } from './helpers/react-dom.mjs';

function service(flag, response) {
  const calls=[];
  const supabase={rpc:async(name,args)=>{calls.push([name,args]);return response;},from(table){calls.push(['from',table]);throw Error('unexpected table fallback');}};
  return {...loadSource('src/app/editor/services/board.service.ts',{'@/lib/supabaseClient':{supabase}},{process:{env:{NEXT_PUBLIC_OAZ_PRIVACY_V2:flag}}}),calls};
}
test('A baseline legacy code + old DB exposes broad private rows; protection is not claimed',async()=>{
  const source=execFileSync('git',['show','d95bc68:src/app/editor/services/board.service.ts'],{encoding:'utf8'});
  const exports={};const selects=[];
  const supabase={from(){return{select(columns){selects.push(columns);return{order:async()=>({data:[{email:'fake@example.invalid'}],error:null})};}};}};
  vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports,require:()=>({supabase}),console:{error(){}}});
  const rows=await exports.fetchPosts('registered_member');assert.equal(rows[0].email,'fake@example.invalid');assert.deepEqual(selects,['*']);
});
for (const flag of [undefined,'false','invalid']) test(`B/C flag ${flag}: sensitive operations stop before network`,async()=>{
  const f=service(flag,null);
  for(const table of ['registered_member','allowed_user','supervisor_id','who_is_boss','editor_5_donators']) {
    await assert.rejects(f.fetchPosts(table));await assert.rejects(f.insertPost(table,{name:'fake'}));
    await assert.rejects(f.updatePost(table,1,{name:'fake'}));await assert.rejects(f.deletePost(table,1));
  }
  assert.equal(f.calls.length,0);
});
for(const code of ['PGRST202','42883','42501','40001'])test(`D/old DB mismatch ${code}: no fallback or private diagnostic`,async()=>{
  const f=service('true',{data:null,error:{code,message:'sensitive fixture diagnostic'}});
  await assert.rejects(f.fetchPosts('registered_member'),e=>e.name==='PrivacyAccessError'&&!e.message.includes('sensitive fixture'));
  assert.equal(f.calls.length,1);assert.equal(f.calls[0][0],'oaz_privacy_editor_list_v3');
});
test('D: approved member projection accepted and extra personal columns rejected',async()=>{
  let f=service('true',{data:{schemaVersion:3,fields:['name','department','generation'],rows:[{id:1,name:'fake',department:null,generation:'0'}]},error:null});
  assert.equal((await f.fetchPosts('registered_member')).length,1);
  f=service('true',{data:{schemaVersion:3,fields:['name'],rows:[{id:1,name:'fake',email:'fake@example.invalid'}]},error:null});
  await assert.rejects(f.fetchPosts('registered_member'));
});
test('donor mutations send only allowed name fields and do not retry on failure',async()=>{
  const f=service('true',{data:{id:1,name:'fake'},error:null});
  await f.insertPost('editor_5_donators',{name:'fake'});
  await assert.rejects(f.updatePost('editor_5_donators',1,{name:'fake',date:'2026-01-01'}));
  assert.equal(f.calls.length,1);assert.equal(f.calls[0][0],'oaz_donor_write_v3');
});
test('scope: no new admin, visitor or general sorting implementation is introduced',()=>{
  for(const file of ['src/app/editor/page.tsx','src/lib/privacy/client.ts','src/lib/privacy/policy.ts']) {
    const text=readFileSync(new URL('../'+file,import.meta.url),'utf8');
    assert.doesNotMatch(text,/@\/lib\/admin|adminCommand|visitor_v2/);
  }
  const signup=readFileSync(new URL('../src/app/signin/page.tsx',import.meta.url),'utf8');
  assert.doesNotMatch(signup,/from\(['"](?:allowed_user|registered_member)/);
  assert.match(signup,/privacyOAuthRedirect\('oauth_callback'/);
});

test('OAuth defaults to production and allows only the explicitly configured exact test origin',()=>{
  const redirect=(approved)=>loadSource('src/lib/privacy/oauth.ts',{}, {URL,process:{env:{NEXT_PUBLIC_OAZ_OAUTH_TEST_ORIGIN:approved}}}).privacyOAuthRedirect;
  assert.equal(redirect(undefined)('login_callback','https://arbitrary.invalid'),'https://www.oazkorea.co.kr/login_callback');
  assert.equal(redirect('https://preview.invalid')('oauth_callback','https://preview.invalid'),'https://preview.invalid/oauth_callback');
  for(const value of ['http://remote.invalid','https://user:pass@preview.invalid','https://preview.invalid/path'])
    assert.equal(redirect(value)('login_callback',value),'https://www.oazkorea.co.kr/login_callback');
  assert.equal(redirect('http://localhost:3000')('login_callback','http://localhost:3000'),'http://localhost:3000/login_callback');
});

for(const protectedDB of [false,true])test(`B/C donor public name survives flag off (protected=${protectedDB})`,()=>domTest(async({render,container})=>{
  let rpcCalls=0;
  const supabase={from(table){assert.equal(table,'editor_5_donators');return{select(columns){assert.equal(columns,'id,name');return{order:async()=>({data:[{id:1,name:'fake public'}],error:null})};}};},rpc(){rpcCalls++;throw Error('flag off');}};
  const {PrivacyBoard}=loadSource('src/app/editor/components/PrivacyBoard.tsx',{'@/lib/supabaseClient':{supabase}},{process:{env:{NEXT_PUBLIC_OAZ_PRIVACY_V2:'false'}}});
  await render(PrivacyBoard,{table:'editor_5_donators'});
  assert.match(container.textContent,/fake public/);assert.equal(rpcCalls,0);assert.equal(container.querySelector('form'),null);
}));

test('D donor duplicate submit, failure, cancel and successful list refresh',()=>domTest(async({render,container,act,window})=>{
  let saves=0,lists=0;const pending=deferred();
  const supabase={from(){return{select(){return{order:async()=>{lists++;return{data:[{id:1,name:'fake donor'}],error:null};}};}};},
    async rpc(name){if(name==='oaz_privacy_session_v3')return{data:{schemaVersion:3,capabilities:[],donorWrite:true,approvalWrite:false},error:null};saves++;return pending.promise;}};
  const {PrivacyBoard}=loadSource('src/app/editor/components/PrivacyBoard.tsx',{'@/lib/supabaseClient':{supabase}},{process:{env:{NEXT_PUBLIC_OAZ_PRIVACY_V2:'true'}}});
  await render(PrivacyBoard,{table:'editor_5_donators'});
  const click=async(label)=>act(async()=>{[...container.querySelectorAll('button')].find(b=>b.textContent===label).click();});
  await click('수정');await click('취소');assert.equal(saves,0);
  await click('수정');
  await act(async()=>{const form=container.querySelector('form');form.dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));form.dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));});
  assert.equal(saves,1);
  await act(async()=>pending.resolve({data:null,error:{code:'42501',message:'private fixture'}}));
  assert.doesNotMatch(container.textContent,/private fixture/);assert.ok(container.querySelector('[role="alert"]'));
  supabase.rpc=async(name)=>name==='oaz_privacy_session_v3'?{data:{schemaVersion:3,capabilities:[],donorWrite:true,approvalWrite:false},error:null}:{data:{id:1,name:'fake donor'},error:null};
  await act(async()=>container.querySelector('form').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true})));
  assert.ok(lists>=2);assert.equal(container.querySelector('input').value,'');
}));

test('signup starts one OAuth request, preserves production callback, and stores no asserted identity',()=>domTest(async({render,container,act,window,React})=>{
  let calls=0;const pending=deferred();
  const supabase={auth:{signInWithOAuth:async args=>{calls++;assert.equal(args.options.redirectTo,'https://www.oazkorea.co.kr/oauth_callback');return pending.promise;}}};
  const Component=loadSource('src/app/signin/page.tsx',{'@/lib/supabaseClient':{supabase},'lucide-react':{Github:()=>React.createElement('span')}}).default;
  await render(Component);
  await act(async()=>{for(const input of container.querySelectorAll('input')){
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set.call(input,'fake');
    input.dispatchEvent(new window.Event('input',{bubbles:true}));
  }});
  await act(async()=>{const form=container.querySelector('form');form.dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));form.dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));});
  assert.equal(calls,1);
  const profile=JSON.parse(window.localStorage.getItem('registration_data'));
  assert.deepEqual(Object.keys(profile).sort(),['department','generation','name','phone_number','studentId']);
  await act(async()=>pending.resolve({error:{message:'private fixture error'}}));
  assert.doesNotMatch(container.textContent,/private fixture error/);assert.ok(container.querySelector('[role="alert"]'));
}));

test('approval writer can add an email without directory-read authority',()=>domTest(async({render,container,act,window})=>{
  const calls=[];
  const supabase={from(){throw Error('No broad table access');},async rpc(name){
    calls.push(name);
    if(name==='oaz_privacy_session_v3')return{data:{schemaVersion:3,capabilities:['approvals.write'],donorWrite:false,approvalWrite:true},error:null};
    if(name==='oaz_approval_add_v3')return{data:{saved:true},error:null};
    return{data:null,error:{code:'42501'}};
  }};
  const {PrivacyBoard}=loadSource('src/app/editor/components/PrivacyBoard.tsx',{'@/lib/supabaseClient':{supabase}},{process:{env:{NEXT_PUBLIC_OAZ_PRIVACY_V2:'true'}}});
  await render(PrivacyBoard,{table:'allowed_user'});assert.ok(container.querySelector('form'));
  await act(async()=>{for(const input of container.querySelectorAll('input')){
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set.call(input,input.type==='email'?'fake@example.invalid':'fake');
    input.dispatchEvent(new window.Event('input',{bubbles:true}));
  }});
  await act(async()=>container.querySelector('form').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true})));
  assert.equal(calls.filter(name=>name==='oaz_approval_add_v3').length,1);assert.equal(container.querySelector('input').value,'');
}));
