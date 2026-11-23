import {test} from 'node:test';
import assert from 'node:assert/strict';
import {loadSource,domTest} from './helpers/react-dom.mjs';
import * as dayPicker from 'react-day-picker';

test('일정은 기간 겹침으로 조회하며 같은 날짜에서도 안정적으로 정렬하고 원본을 보존한다',()=>{
 const {schedulesInRange,schedulePreview,dateKey}=loadSource('src/lib/public-schedules.ts');
 const rows=[{id:3,start_date:'2026-11-05',end_date:'2026-11-05',description:'제목\n긴 본문'}, {id:2,start_date:'2026-11-04',end_date:'2026-11-06',description:'여러 날'}, {id:1,start_date:'2026-11-05',end_date:'2026-11-05',description:'같은 날짜'}, {id:4,start_date:'2026-12-01',end_date:'2026-11-01',description:'잘못된 순서'}];
 assert.deepEqual(Array.from(schedulesInRange(rows,'2026-11-05','2026-11-05'),r=>r.id),[2,1,3]);
 assert.equal(schedulesInRange(rows,'2027-02-01','2027-02-28').length,0);
 assert.deepEqual(rows.map(r=>r.id),[3,2,1,4]);assert.equal(schedulePreview(rows[0].description).preview,'긴 본문');
 assert.equal(dateKey(new Date(2026,10,5)),'2026-11-05');
});
test('스터디는 유일한 이름만 연결하고 중복 이름이나 미등록 시간은 추정하지 않는다',()=>{
 const {studyTimes}=loadSource('src/lib/study-schedule.ts');const study={id:1,study_name:'예시'};
 const slots=[{id:3,name:'예시',day:'수요일',startSlot:2},{id:1,name:'예시',day:'월요일',startSlot:4},{id:2,name:'다른 이름',day:'월요일',startSlot:1}];
 assert.deepEqual(Array.from(studyTimes(study,[study],slots),r=>r.id),[1,3]);assert.equal(studyTimes(study,[study,{...study,id:2}],slots).length,0);assert.equal(studyTimes({...study,study_name:null},[study],slots).length,0);
});
test('SNS 순서와 기존 외부 주소, Alumni 두 메뉴 및 Hall of Fame을 유지한다',()=>{
 const {PUBLIC_NAV_ITEMS,SOCIAL_CHANNELS}=loadSource('src/lib/public-navigation.ts');
 assert.deepEqual(Array.from(PUBLIC_NAV_ITEMS,r=>r.name),['About','Records','Schedule','Recruit','Community','Alumni']);
 assert.deepEqual(Array.from(SOCIAL_CHANNELS,r=>r.href),['http://pf.kakao.com/_nLRJX','https://www.instagram.com/ku_oaz','https://www.band.us/band/98494837']);
 assert.deepEqual(Array.from(PUBLIC_NAV_ITEMS.find(r=>r.name==='Alumni').subItems,r=>r.name),['Homecoming','Network','Hall of Fame']);assert.ok(PUBLIC_NAV_ITEMS.every(r=>r.subItems.every(s=>s.href.startsWith('/'))));
});
test('Room Schedule delegates the entire active timetable to the same loader as home',async()=>domTest(async({React,render,container})=>{
 let supplied;
 const {default:Page}=loadSource('src/components/StudySchedule.tsx',{'@/components/home/features/Timetable':{TimetableDemo:p=>{supplied=p;return React.createElement('div',{'data-shared-timetable':true})}}});
 await render(Page);
 assert.equal(supplied.wide,true);assert.equal(supplied.showHint,false);assert.equal(Object.hasOwn(supplied,'studies'),false);
 assert.ok(container.querySelector('[data-room-weekly-frame] [data-shared-timetable]'));
 assert.match(container.textContent,/2026년 2학기/);assert.doesNotMatch(container.textContent,/시간표에만 등록된 일정/);
}));
test('일정 클릭은 전체 설명을 대화창으로 열고 닫은 뒤 기존 목록으로 돌아간다',async()=>domTest(async({React,render,act,container,window})=>{
 // 열린 modal 밖으로의 focus를 막아 실제 브라우저의 inert 동작과 StrictMode 재실행을 재현한다.
 const focus=window.HTMLElement.prototype.focus;window.HTMLElement.prototype.focus=function(){const modal=container.querySelector('dialog[open]');if(!modal||modal.contains(this))focus.call(this)};
 window.HTMLDialogElement.prototype.showModal=function(){this.open=true;this.querySelector('button').focus()};window.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new window.Event('close'))};
 const today=new Date(),day=`${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-05`,body='제목\n'+('긴 본문 '.repeat(70));let queries=0;
 const q={select:()=>q,order:()=>q,abortSignal:()=>{queries++;return Promise.resolve({data:[{id:1,description:body,start_date:day,end_date:day}]})}};
 const {default:Card}=loadSource('src/components/home/features/Calender01.tsx',{'@/lib/supabaseClient':{supabase:{from:()=>q}},'@/components/ui/calendar':{Calendar:()=>React.createElement('div',{'data-calendar':true})}});
 await render(Card);await act(async()=>new Promise(r=>setTimeout(r,25)));assert.equal(queries,1);assert.equal(container.querySelector('[data-schedule-list]').tabIndex,0);
 const trigger=container.querySelector('[data-schedule-id]');trigger.focus();await act(async()=>trigger.click());assert.ok(container.querySelector('dialog').open);assert.ok(container.querySelector('dialog').textContent.includes(body));await act(async()=>container.querySelector('dialog button').click());assert.equal(container.querySelector('dialog'),null);assert.equal(window.document.activeElement,trigger);assert.equal(queries,1);
}));
test('실제 달력 날짜는 클릭과 키보드로 선택할 수 있는 버튼이며 KST 날짜를 유지한다',async()=>domTest(async({React,render,act,container})=>{
 let selected;const Icon=()=>React.createElement('svg');
 const {Calendar}=loadSource('src/components/ui/calendar.tsx',{'react-day-picker':dayPicker,'lucide-react':{ChevronDownIcon:Icon,ChevronLeftIcon:Icon,ChevronRightIcon:Icon},'@/lib/utils':{cn:(...args)=>args.filter(x=>typeof x==='string').join(' ')},'@/components/ui/button':{buttonVariants:()=>''}});
 await render(Calendar,{mode:'single',month:new Date(2026,10,1),onSelect:date=>{selected=date}});
 const date=container.querySelector('button[data-day="2026-11-05"]');assert.equal(date.tagName,'BUTTON');assert.equal(date.disabled,false);await act(async()=>date.click());assert.equal(selected.getDate(),5);assert.equal(selected.getMonth(),10);
}));
