import {test} from 'node:test';
import assert from 'node:assert/strict';
import {loadSource,domTest} from './helpers/react-dom.mjs';
const uid=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const {atomicVisitor}=loadSource('src/lib/visitorAtomic.ts');
test('atomic visitor accepts validated result and forwards idempotency key once',async()=>{
  let calls=0;
  const result=await atomicVisitor(async id=>{assert.equal(id,uid(1));calls++;return {data:{count:2,date:'2026-11-03'},error:null}},uid(1));
  assert.equal(result.count,2);assert.equal(calls,1);
});
test('visitor RPC errors, invalid counts and invalid dates fail without retry',async()=>{
  for(const data of [{count:-1,date:'2026-11-03'},{count:'2',date:'2026-11-03'},{count:NaN,date:'2026-11-03'},{count:1,date:'2026-02-30'},{count:1,date:'wrong'},null]){
    let calls=0;await assert.rejects(atomicVisitor(async()=>{calls++;return {data,error:null}},null));assert.equal(calls,1);
  }
  await assert.rejects(atomicVisitor(async()=>({data:{count:1,date:'2026-11-03'},error:{message:'fixture'}}),null));
});
test('invalid visitor request IDs never call RPC',async()=>{
  await assert.rejects(atomicVisitor(async()=>{throw Error('must not call')},'invalid'));
});
test('privacy v2 donor adapter uses RPC for all CRUD and never falls back to table access',async()=>{
  const calls=[];
  const {fetchPosts,insertPost,updatePost,deletePost}=loadSource('src/app/editor/services/board.service.ts',{
    '@/lib/supabaseClient':{supabase:{rpc:async(name,args)=>{calls.push([name,args]);return {data:name==='oaz_privacy_editor_list_v3'?{schemaVersion:3,fields:['name'],rows:[{id:1,name:'fixture'}]}:{id:1,name:'fixture'},error:null}},from:()=>{throw Error('direct access forbidden')}}}},
    {process:{env:{NEXT_PUBLIC_OAZ_PRIVACY_V2:'true'}}});
  await fetchPosts('editor_5_donators');await insertPost('editor_5_donators',{name:'fixture'});
  await updatePost('editor_5_donators',1,{name:'edited'});await deletePost('editor_5_donators',1);
  assert.equal(calls.length,4);assert.equal(calls[0][0],'oaz_privacy_editor_list_v3');
  assert.equal(calls[3][1].operation,'delete');
});
test('privacy RPC errors and zero rows never report save/delete success',async()=>{
  for(const result of [{data:[],error:null},{data:null,error:{code:'42501'}}]){
    const service=loadSource('src/app/editor/services/board.service.ts',{'@/lib/supabaseClient':{supabase:{rpc:async()=>result}}},{process:{env:{NEXT_PUBLIC_OAZ_PRIVACY_V2:'true'}}});
    await assert.rejects(service.deletePost('editor_5_donators',1));await assert.rejects(service.insertPost('editor_5_donators',{}));
  }
});
test('media lifecycle separates existing references and never automatically deletes',()=>{
  const {settleMedia,mayDeleteMedia}=loadSource('src/lib/admin/media.ts');
  const receipts=[{bucket:'project_img',path:'fixture.png',origin:'new',state:'uploaded'},{bucket:'project_img',path:'existing.png',origin:'existing',state:'referenced'}];
  assert.equal(settleMedia(receipts,'committed')[0].state,'referenced');
  const failed=settleMedia(receipts,'failed');assert.equal(failed[0].state,'review_required');assert.equal(failed[1].state,'referenced');
  const proof={activeAdmin:true,authoritativeReferences:0,retentionExpired:true,explicitApproval:true,inventoryVersion:2,currentVersion:2};
  assert.equal(mayDeleteMedia(failed[0],proof),true);
  for(const change of [{authoritativeReferences:null},{authoritativeReferences:1},{activeAdmin:false},{explicitApproval:false},{currentVersion:3}])assert.equal(mayDeleteMedia(failed[0],{...proof,...change}),false);
  assert.equal(mayDeleteMedia(failed[1],proof),false);
});
test('invitation remains disabled without approved server port or fresh super admin',async()=>{
  const {requestAdminInvitation}=loadSource('src/lib/admin/provisioning.ts');
  const rows=[{slot:'admin1',userId:uid(1),role:'super_admin',status:'active',revision:0}];
  const context={identity:{userId:uid(1),aal:'aal2'},requestId:uid(10),authoritativeVersion:0,nowMs:10,snapshot:{rows,version:0,fetchedAtMs:10,requestId:uid(10)}};
  let calls=0;const port={enqueue:async()=>{calls++;return {state:'pending'}}};
  await assert.rejects(requestAdminInvitation(context,'admin2',false,port));assert.equal(calls,0);
  assert.equal((await requestAdminInvitation(context,'admin2',true,port)).state,'pending');
  await assert.rejects(requestAdminInvitation(context,'admin1',true,port));
  await assert.rejects(requestAdminInvitation({...context,identity:{userId:uid(2),aal:'aal2'}},'admin2',true,port));
  assert.equal(calls,1);
});

test('ambiguous visitor retry reuses its daily request ID across remounts',async()=>{
  await domTest(async({act})=>{
    const ids=[];
    const {createVisitorResource}=loadSource('src/lib/visitorResource.ts',{}, {crypto:globalThis.crypto,
      fetch:async(_url,options)=>{
        if(options?.method==='POST'){ids.push(options.headers['Idempotency-Key']);throw Error('ambiguous fixture failure')}
        return {ok:true,json:async()=>({count:1})};
      }});
    for(let i=0;i<2;i++)await act(async()=>{const resource=createVisitorResource();resource.subscribe(()=>{});await new Promise(r=>setTimeout(r,10))});
    assert.equal(ids.length,2);assert.match(ids[0],/^[0-9a-f-]{36}$/);assert.equal(ids[1],ids[0]);
  });
});
