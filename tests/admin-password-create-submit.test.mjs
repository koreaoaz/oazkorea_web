import {test} from 'node:test';
import assert from 'node:assert/strict';
import {domTest,loadSource} from './helpers/react-dom.mjs';

test('empty required fields prevent native submit; valid fields dispatch create once',async()=>domTest(async({React,act,container,render,window})=>{
 const calls=[];
 const command=async c=>{calls.push(c);return ['list','audit'].includes(c.action)?{result:[]}:{result:{status:'completed'},temporaryPassword:'synthetic-only'};};
 const {PasswordManagement}=loadSource('src/app/admin/accounts/password-management.tsx',{
  'next/link':({children,...p})=>React.createElement('a',p,children),
  '@/lib/admin/password-client':{passwordCommand:command},
  '@/lib/supabaseClient':{supabase:{}},
 },{crypto:{randomUUID:()=> '11111111-1111-4111-8111-111111111111'}});
 await render(PasswordManagement,{tab:'list'},false);
 assert.deepEqual(calls.map(c=>c.action),['list','audit']);
 assert.equal(container.querySelector('form'),null);
 await render(PasswordManagement,{tab:'create'},false);
 const form=container.querySelector('form');
 assert.equal(form.checkValidity(),false);
 await act(async()=>form.requestSubmit());
 assert.equal(calls.filter(c=>c.action==='create').length,0);
 const inputs=form.querySelectorAll('input:not([type=checkbox])');
 const setter=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;
 await act(async()=>{setter.call(inputs[0],'INVALID!');inputs[0].dispatchEvent(new window.Event('input',{bubbles:true}));});
 assert.equal(inputs[0].validity.patternMismatch,true);
 for(const [i,value] of ['admin2','합성 테스트 관리자'].entries())await act(async()=>{setter.call(inputs[i],value);inputs[i].dispatchEvent(new window.Event('input',{bubbles:true}));});
 assert.equal(form.checkValidity(),true);
 let prevented=false;
 await act(async()=>{window.confirm=()=>false;const link=container.querySelector('a');prevented=!link.dispatchEvent(new window.MouseEvent('click',{bubbles:true,cancelable:true}));});
 assert.ok(prevented,'dirty account fields warn before following a parent link');
 await act(async()=>form.requestSubmit());
 assert.equal(calls.filter(c=>c.action==='create').length,1);
 assert.equal(calls.find(c=>c.action==='create').username,'admin2');
 await render(PasswordManagement,{tab:'list'},false);
 assert.equal(container.querySelector('form'),null);
 assert.equal(calls.filter(c=>c.action==='list').length,2);
 assert.equal(container.querySelector('input[readonly]').value,'synthetic-only');
}));
