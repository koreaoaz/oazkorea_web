import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Image,loadSource,domTest,deferred} from './helpers/react-dom.mjs';

test('active groups include legacy Recruit, News details and SNS without prefix collisions',()=>{
 const {isPublicNavActive:group,isPublicLinkActive:link,PUBLIC_NAV_ITEMS}=loadSource('src/lib/public-navigation.ts');
 assert.deepEqual(Array.from(PUBLIC_NAV_ITEMS.find(x=>x.name==='Recruit').subItems,x=>x.href),['/recruit/timeline','/recruit/faq']);
 for(const p of ['/recruit','/recruit/recruitment','/recruit/timeline','/recruit/faq'])assert.equal(group('Recruit',p),true);
 for(const p of ['/news','/news/6','/sns','/blog/members-tech-blog'])assert.equal(group('Community',p),true);
 for(const p of ['/newsletter','/newsroom','/snscopy','/admin','/'])assert.equal(group('Community',p),false);
 assert.equal(link('/recruit/timeline','/recruit/recruitment'),true);assert.equal(link('/recruit/timeline','/recruit/faq'),false);assert.equal(link('/news','/news/7'),true);
});

test('pending news survives repeated tab changes without remount, refetch or reset',()=>domTest(async({window,render,container,act})=>{
 window.matchMedia=()=>({matches:true,addEventListener(){},removeEventListener(){}});
 const pending=[deferred(),deferred()];let calls=0;
 const supabase={from:()=>{const q={select(){return q},eq(){return q},order(){return q},limit(){return q},abortSignal(){return pending[calls++].promise}};return q}};
 const {default:Notification}=loadSource('src/components/home/features/Notification.tsx',{'@/lib/supabaseClient':{supabase},'@/components/ContentTitle':{ContentTitle:({title})=>title}});
 await render(Notification);await act(async()=>new Promise(r=>setTimeout(r,20)));
 const original=Array.from(container.querySelectorAll('.mobile-news-skeleton [data-news-row]'));assert.equal(original.length,10);assert.equal(calls,2);
 const tabs=container.querySelectorAll('[role=tab]');
 for(let n=0;n<6;n++)await act(async()=>tabs[n%2].click());
 assert.deepEqual(Array.from(container.querySelectorAll('.mobile-news-skeleton [data-news-row]')),original);assert.equal(calls,2);
 await act(async()=>pending[0].resolve({data:[],error:null}));assert.equal(container.querySelectorAll('.mobile-news-skeleton').length,2);
 await act(async()=>pending[1].resolve({data:[{id:22,text:'Synthetic complete record',created_at:'2026-11-09T00:00:00Z',pinned_at:null}],error:null}));
 assert.equal(container.querySelector('.mobile-news-skeleton'),null);assert.equal(tabs[1].getAttribute('aria-selected'),'true');assert.equal(calls,2);assert.equal(container.querySelector('[data-notice-id]').dataset.noticeId,'22');
}));

test('FAQ preserves four original questions in order and exposes native collapsible answers',()=>domTest(async({render,container,act})=>{
 const {default:FAQ}=loadSource('src/app/recruit/faq/page.tsx',{'next/image':{__esModule:true,default:Image}});await render(FAQ);
 const details=[...container.querySelectorAll('details')];assert.equal(details.length,4);assert.ok(details.every(d=>d.open&&d.querySelector('p').textContent.length>20));
 assert.deepEqual(details.map(d=>d.querySelector('summary').textContent.trim()),['Q. 프로젝트 관련 경험이 없어도 되나요?','Q. (면접이 있을 경우) 기술 면접인가요?','Q. 모집 과정 이후에 추가 지원이 가능한가요?','Q. 합격자만 연락을 받나요?']);
 await act(async()=>details[0].querySelector('summary').click());assert.equal(details[0].open,false);assert.ok(details.slice(1).every(d=>d.open));
}));

test('legacy FAQ fragment compatibility keeps the language query and uses a fixed local destination',()=>domTest(async({window,render,act})=>{
 const destinations=[],router={replace:url=>destinations.push(url)};
 window.history.replaceState({},'', '/recruit/recruitment?lang=en#FAQ');
 const {LegacyRecruitAnchor}=loadSource('src/components/home/LegacyRecruitAnchor.tsx',{'next/navigation':{useRouter:()=>router}});
 await render(LegacyRecruitAnchor);assert.ok(destinations.length>0);assert.ok(destinations.every(x=>x==='/recruit/faq?lang=en#faq'));
 destinations.length=0;await act(async()=>{window.history.replaceState({},'', '#https://outside.invalid');window.dispatchEvent(new window.HashChangeEvent('hashchange'))});assert.equal(destinations.length,0);
}));
