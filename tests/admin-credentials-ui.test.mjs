import {test} from 'node:test';import assert from 'node:assert/strict';import {loadSource,domTest,deferred} from './helpers/react-dom.mjs';
test('five credentials cards distinguish names and slots, never offer owner disable, and prevent duplicate rename',()=>domTest(async({render,act,container,window})=>{
 const rows=Array.from({length:5},(_,i)=>({slot:'admin'+(i+1),username:'fixture.'+(i+1),userId:'synthetic-'+i,revision:0,role:i===0?'SUPER_ADMIN':'ADMIN',status:'active',mfaEnrolled:i===0}));const gate=deferred(),calls=[];
 window.confirm=()=>true;
 const {AccountCredentials}=loadSource('src/app/admin/accounts/credentials.tsx',{'next/navigation':{useRouter:()=>({replace(){},refresh(){}})},'@/lib/supabaseClient':{supabase:{auth:{}}},'@/lib/admin/credentials-client':{credentialsCommand:async c=>{if(c.action==='list')return rows;calls.push(c);await gate.promise;return {status:'completed'}}}},{crypto:globalThis.crypto,TextEncoder});
 await render(AccountCredentials);assert.equal(container.querySelectorAll('article').length,5);assert.doesNotMatch(container.querySelector('article').textContent,/비활성화|비밀번호 초기화/);assert.match(container.querySelector('article').textContent,/fixture\.1|admin1/);
 await act(async()=>[...container.querySelector('article').querySelectorAll('button')].find(x=>x.textContent==='아이디 변경').click());
 const input=container.querySelector('input');await act(async()=>{Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set.call(input,'fixture.new');input.dispatchEvent(new window.Event('input',{bubbles:true}))});
 await act(async()=>{for(let i=0;i<2;i++)container.querySelector('form').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}))});
 assert.equal(calls.length,1);assert.equal(calls[0].slot,'admin1');assert.equal(calls[0].revision,0);assert.equal(calls[0].username,'fixture.new');assert.equal(container.querySelector('button[type=submit]').disabled,true);
 await act(async()=>gate.resolve());assert.equal(container.querySelector('form'),null);assert.equal(window.localStorage.length,0);
}));
