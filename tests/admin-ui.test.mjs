import {test} from 'node:test';
import assert from 'node:assert/strict';
import {loadSource,domTest} from './helpers/react-dom.mjs';
const globals={crypto:globalThis.crypto};
const auth={onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})};
const input=(w,e,v)=>{Object.getOwnPropertyDescriptor(w.HTMLInputElement.prototype,'value').set.call(e,v);e.dispatchEvent(new w.Event('input',{bubbles:true}));};
test('dashboard cards and tabs expose only current scope and no super management',async()=>domTest(async({render,container})=>{
 const {AdminWorkspace}=loadSource('src/app/admin/workspace.tsx',{'./media-editor':{MediaEditor:()=>null},'@/lib/supabaseClient':{supabase:{auth}},'@/lib/admin/client':{adminCommand:async()=>({slot:'admin2',role:'ADMIN',version:1,lifecycleVersion:3,contentReady:true,scopes:['editor_0_noti']})}},globals);
 await render(AdminWorkspace);
 assert.equal(container.querySelectorAll('.admin-card').length,1);
 assert.equal(container.querySelectorAll('.admin-tabs button').length,1);
 assert.equal(container.querySelector('option[value="editor_1_projects"]'),null);
 assert.equal(container.querySelector('a[href="/admin/accounts"]'),null);
 assert.match(container.querySelector('#account').textContent,/현재 편집 범위: 공지/);
}));
test('project advanced fields preserve duration, members and selected technology groups',async()=>domTest(async({render,container,act,window})=>{
 let saved;
 const {AdminWorkspace}=loadSource('src/app/admin/workspace.tsx',{'./media-editor':{MediaEditor:()=>null},'@/lib/supabaseClient':{supabase:{auth}},'@/lib/admin/client':{adminCommand:async c=>{
  if(c.action==='session')return {slot:'admin1',role:'SUPER_ADMIN',version:1,lifecycleVersion:3,contentReady:true};
  if(c.action==='content.create'){saved=c.payload;return {id:1};}
  if(c.action==='content.list')return [];if(c.action==='order.list')return {revision:0,ids:[]};throw Error();
 }}},globals);
 await render(AdminWorkspace);
 await act(async()=>{const e=container.querySelector('select[aria-label="콘텐츠 종류"]');e.value='editor_1_projects';e.dispatchEvent(new window.Event('change',{bubbles:true}));});
 const field=text=>[...container.querySelectorAll('label')].find(e=>e.textContent.startsWith(text)).querySelector('input');
 await act(async()=>{input(window,field('제목 또는 이름'),'SYNTHETIC');input(window,field('기간'),'2026');input(window,field('팀원'),'SYNTHETIC_TEAM');});
 await act(async()=>field('Web').click());
 assert.equal(field('Web').checked,true);
 await act(async()=>container.querySelector('form').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true})));
 assert.equal(saved.duration,'2026');assert.equal(saved.members,'SYNTHETIC_TEAM');assert.deepEqual([...saved.tech_stack.groups],['Web']);
 assert.equal(Object.hasOwn(saved,'_stackText'),false);
}));
test('activity filters and paginates committed records without exposing actor UUID or raw field names',async()=>domTest(async({render,container,act,window})=>{
 const rows=Array.from({length:12},(_,i)=>({request_id:String(i),actor_slot:'admin2',actor_id:'PRIVATE_ACTOR_ID',committed_at:'2026-11-05T00:00:00Z',action:i===11?'honor.approve':'content.create',target_table:'editor_0_noti',record_id:i+1,changed_fields:['text']}));
 const {AdminActivity}=loadSource('src/app/admin/activity/activity.tsx',{'@/lib/admin/client':{adminCommand:async c=>c.action==='session'?{version:1}:rows}});
 await render(AdminActivity);assert.equal(container.querySelectorAll('article').length,10);assert.doesNotMatch(container.textContent,/PRIVATE_ACTOR_ID|editor_0_noti/);
 await act(async()=>[...container.querySelectorAll('button')].find(e=>e.textContent==='다음').click());assert.equal(container.querySelectorAll('article').length,2);
 await act(async()=>{const e=container.querySelector('select');e.value='honor';e.dispatchEvent(new window.Event('change',{bubbles:true}));});
 assert.equal(container.querySelectorAll('article').length,1);assert.match(container.textContent,/명예의 전당 공개 승인/);assert.match(container.textContent,/1 \/ 1 페이지/);
}));
test('public signup stays closed for all visitors and logout restores only administrator login',async()=>domTest(async({React,render,container,act})=>{
 let listener,resolveRefresh;const pendingRefresh=new Promise(resolve=>{resolveRefresh=resolve});let checks=0;
 const motion=tag=>function Stub({children}){return React.createElement(tag,null,children);};
 const {default:Navigation}=loadSource('src/components/home/Navigation.tsx',{
  'next/navigation':{usePathname:()=>'/outside'},
  './MobileNavigationDrawer':{MobileNavigationDrawer:()=>null}, // Desktop auth contract; drawer tested in real browsers.
  '@/components/ui/button':{Button:p=>React.createElement('button',p)},'lucide-react':{Github:()=>null,Menu:()=>null,X:()=>null},
  'framer-motion':{motion:{header:motion('header'),div:motion('div')},AnimatePresence:motion('div')},
  'next/link':{__esModule:true,default:({href,children})=>React.createElement('a',{href},children)},
  '@/lib/admin/client':{adminCommand:async()=>++checks<=2?{role:'ADMIN'}:pendingRefresh},
  '@/lib/supabaseClient':{supabase:{auth:{getUser:async()=>({data:{user:{id:'SYNTHETIC'}}}),onAuthStateChange:cb=>{listener=cb;return {data:{subscription:{unsubscribe(){}}}}}},from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:null})})})})}},
 });
 await render(Navigation);await act(async()=>new Promise(r=>setTimeout(r,20)));
 assert.equal(container.querySelector('a[href="/signin"]'),null);assert.ok(container.querySelector('a[href="/admin"]'));
 const user={id:'SYNTHETIC'};
 await act(async()=>{listener('SIGNED_IN',{user});await new Promise(r=>setTimeout(r,12))});
 await act(async()=>{listener('TOKEN_REFRESHED',{user});await new Promise(r=>setTimeout(r,12))});
 assert.ok(container.querySelector('a[href="/admin"]'),'same-user refresh retains the verified link while pending');
 await act(async()=>listener('SIGNED_OUT',null));
 await act(async()=>resolveRefresh({role:'ADMIN'}));
 assert.equal(container.querySelector('a[href="/signin"]'),null);assert.ok(container.querySelector('a[href="/admin/login"]'));assert.equal(container.querySelector('a[href="/admin"]'),null);
}));
