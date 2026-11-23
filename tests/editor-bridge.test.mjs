import {test} from 'node:test';
import assert from 'node:assert/strict';
import {loadSource,domTest,deferred} from './helpers/react-dom.mjs';
const uid=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const table='editor_0_noti';
function fixture(transform=()=>{}) {
  const state={userId:uid(2),version:3,contentReady:true,rows:[{id:1,_revision:0,text:'fixture',description:'fixture body'}],calls:[]};
  const api=async c=>{
    state.calls.push(c);const override=await transform(c,state);if(override!==undefined)return override;
    if(c.action==='session')return {userId:state.userId,version:state.version,contentReady:state.contentReady};
    if(c.action==='content.list')return structuredClone(state.rows);
    throw Error('Unexpected mutation');
  };
  return {state,...loadSource('src/lib/admin/editorBridge.ts',{'./client':{adminCommand:api}},{crypto:globalThis.crypto})};
}
test('Editor bridge retains revision and immutable ID with atomic API update',async()=>{
  const f=fixture((c,s)=>{if(c.action==='content.update'){assert.equal(c.revision,0);assert.equal(c.id,1);s.rows[0]={...s.rows[0],...c.payload,_revision:1};return {id:1,revision:1}}});
  await f.bridgeList(table);const row=await f.bridgeWrite('content.update',table,1,{text:'edited'});
  assert.equal(row.id,1);assert.equal(row._revision,1);assert.equal(row.description,'fixture body');
});
test('Editor bridge rejects unknown tables, missing snapshots and account switches',async()=>{
  const f=fixture();await assert.rejects(f.bridgeList('registered_member'));assert.equal(f.state.calls.length,0);
  await assert.rejects(f.bridgeWrite('content.update',table,1,{text:'bad'}));
  await f.bridgeList(table);f.state.userId=uid(3);
  await assert.rejects(f.bridgeWrite('content.update',table,1,{text:'bad'}));
  assert.equal(f.state.calls.filter(c=>c.action==='content.update').length,0);
});
test('Editor bridge deduplicates simultaneous create submissions despite generated timestamps',async()=>{
  const pending=deferred();let creates=0;
  const f=fixture(async(c,s)=>{if(c.action==='content.create'){creates++;assert.equal(c.payload.created_at,undefined);await pending.promise;s.rows.push({id:2,_revision:0,text:'new'});return {id:2,revision:0}}});
  const a=f.bridgeWrite('content.create',table,null,{text:'new',created_at:'2026-01-01'});
  const b=f.bridgeWrite('content.create',table,null,{text:'new',created_at:'2026-01-02'});
  await new Promise(r=>setTimeout(r,10));assert.equal(creates,1);pending.resolve();
  assert.equal((await a).id,2);assert.equal((await b).id,2);
});
test('ambiguous save retries reuse frozen command and request ID after permission version advances',async()=>{
  let first;
  const f=fixture((c,s)=>{if(c.action==='content.update'){
    if(!first){first=c;s.rows[0]={...s.rows[0],text:'edited',_revision:1};s.version=4;throw Error('lost response fixture')}
    assert.equal(c.requestId,first.requestId);assert.equal(c.version,3);assert.equal(c.revision,0);return {id:1,revision:1};
  }});
  await f.bridgeList(table);await assert.rejects(f.bridgeWrite('content.update',table,1,{text:'edited'}));
  assert.equal((await f.bridgeWrite('content.update',table,1,{text:'edited'}))._revision,1);
});
test('Editor cutover disabled state denies mutations without falling back',async()=>{
  const f=fixture();await f.bridgeList(table);f.state.contentReady=false;
  await assert.rejects(f.bridgeWrite('content.delete',table,1,{}));
  assert.equal(f.state.calls.filter(c=>c.action==='content.delete').length,0);
});
test('background refresh cannot replace the editing snapshot expected revision',async()=>{
  const f=fixture(c=>{if(c.action==='content.update'){assert.equal(c.revision,0);throw Error('stale revision fixture')}});
  await f.bridgeList(table);f.state.rows[0]._revision=1;await f.bridgeList(table);
  await assert.rejects(f.bridgeWrite('content.update',table,1,{text:'old draft'},0));
});
test('new Editor tabs expose only approved content while legacy defaults stay intact',async()=>{
  await domTest(async({render,container})=>{
    const {BoardTabs}=loadSource('src/app/editor/components/BoardTabs.tsx');
    await render(BoardTabs,{board:'공지',onChange(){},allowed:['공지','프로젝트']});
    assert.equal(container.querySelectorAll('button').length,2);assert.doesNotMatch(container.textContent,/등록회원|승인email|관리자id/);
    await render(BoardTabs,{board:'공지',onChange(){}});assert.match(container.textContent,/등록회원/);
  });
});
test('Editor feature flag verifies new server authority and never falls back to supervisor lookup',async()=>{
  for(const [user,allow,ready,expected] of [[null,false,false,'/signin'],[{id:uid(2)},false,false,'/admin/login'],[{id:uid(2)},true,false,'/admin'],[{id:uid(2)},true,true,null]]){
    await domTest(async({render,container,React,window})=>{
      const destinations=[];let checks=0;
      window.alert=()=>{};
      const router={replace:route=>destinations.push(route)};
      const mocks={
        'next/navigation':{useRouter:()=>router},
        '@/lib/supabaseClient':{supabase:{auth:{getUser:async()=>({data:{user},error:null}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},from:()=>{throw Error('legacy fallback forbidden')}}},
        '@/lib/admin/client':{adminCommand:async()=>{checks++;if(!allow)throw Error('denied');return {role:'ADMIN',version:0,contentReady:ready}}},
        './components/BoardTabs':{BoardTabs:()=>null},'./components/PostList':{PostList:()=>null},
        './EditorLayout':{EditorLayout:({children})=>React.createElement('div',null,children)},
        './components/common/EditorForm':{EditorMutationContext:React.createContext(null)},
        './hooks/useBoardPosts':{useBoardPosts:()=>({posts:[],reload:async()=>{},setPosts(){},loading:false})},
      };
      for(const [path,name] of [['0_notice/NoticeForm','NoticeForm'],['1_project/ProjectForm','ProjectForm'],['2_study/StudyForm','StudyForm'],['3_timetable/TimetableForm','TimetableForm'],['4_honor/HonorForm','HonorForm'],['5_schedule/ScheduleForm','ScheduleForm'],['6_event/EventForm','EventForm'],['8_registered_member/Registered_mem','Registered_mem_Form'],['7_allowed_user/Allowed_user','Allowed_user']])mocks[`./boards/${path}`]={[name]:()=>null};
      const {default:EditorPage}=loadSource('src/app/editor/page.tsx',mocks,{process:{env:{NEXT_PUBLIC_OAZ_ADMIN_EDITOR_V2:'true'}}});
      await render(EditorPage,{},false);
      assert.equal(checks,user?1:0);
      assert.deepEqual(destinations,expected?[expected]:[]);
      if(allow&&ready)assert.doesNotMatch(container.textContent,/접근 권한을 확인 중/);
    });
  }
});
