import {test} from 'node:test';
import assert from 'node:assert/strict';
import {loadSource,domTest,deferred} from './helpers/react-dom.mjs';
const input=(window,e,value)=>{Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set.call(e,value);e.dispatchEvent(new window.Event('input',{bubbles:true}));};
test('username login retains password characters, prevents duplicate submission, and adopts only provider tokens',()=>domTest(async({render,act,container,window})=>{
 const gate=deferred(),requests=[],adopted=[],routes=[];
 const auth={getSession:async()=>({data:{session:null}}),setSession:async s=>{adopted.push(s);return {error:null}}};
 const {AdminLogin}=loadSource('src/app/admin/login/sign-in.tsx',{'next/navigation':{useRouter:()=>({push:p=>routes.push(p),replace(){},refresh(){}})},'@/lib/supabaseClient':{supabase:{auth}},'@/lib/admin/client':{adminCommand:async()=>({})},'@/lib/admin/session':{syncAdminCookie:async()=>{}}},{fetch:async(url,init)=>{requests.push({url,body:JSON.parse(init.body)});await gate.promise;return {ok:true,json:async()=>({session:{access_token:'synthetic',refresh_token:'synthetic-refresh'}})}}});
 await render(AdminLogin,{origin:'https://fixture.invalid',usernameReady:true});
 await act(async()=>{input(window,container.querySelector('input[autocomplete=username]'),'review.owner');input(window,container.querySelector('#admin-login-password'),' Exact=Secret Phrase ')});
 await act(async()=>{container.querySelector('form').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));container.querySelector('form').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}))});
 assert.equal(requests.length,1);assert.equal(requests[0].body.password,' Exact=Secret Phrase ');assert.equal(requests[0].body.username,'review.owner');assert.equal(container.querySelector('button[type=submit]').disabled,true);
 await act(async()=>gate.resolve());assert.equal(adopted.length,1);assert.deepEqual(routes,['/admin']);assert.equal(container.querySelector('#admin-login-password').value,'');
}));
test('password visibility and legacy switch never store credentials',()=>domTest(async({render,act,container,window})=>{
 const {AdminLogin}=loadSource('src/app/admin/login/sign-in.tsx',{'next/navigation':{useRouter:()=>({})},'@/lib/supabaseClient':{supabase:{auth:{getSession:async()=>({data:{session:null}})}}},'@/lib/admin/client':{adminCommand:async()=>({})},'@/lib/admin/session':{syncAdminCookie:async()=>{}}});
 await render(AdminLogin,{origin:'https://fixture.invalid',usernameReady:true});
 await act(async()=>{input(window,container.querySelector('#admin-login-password'),'SYNTHETIC_ONLY');container.querySelector('button[aria-controls=admin-login-password]').click()});
 assert.equal(container.querySelector('#admin-login-password').type,'text');assert.equal(container.querySelector('button[aria-controls=admin-login-password]').getAttribute('aria-pressed'),'true');
 await act(async()=>[...container.querySelectorAll('button')].find(b=>b.textContent==='기존 로컬 이메일 로그인').click());
 assert.equal(container.querySelector('#admin-login-password').type,'password');assert.equal(container.querySelector('#admin-login-password').value,'');assert.ok(container.querySelector('input[type=email]'));assert.equal(window.localStorage.length,0);
}));
