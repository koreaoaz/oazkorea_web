// Only called by the isolated PostgREST harness with synthetic JWTs.
import assert from 'node:assert/strict';
import { loadSource } from '../tests/helpers/react-dom.mjs';
const origin=new URL(process.env.OAZ_FIXTURE_ORIGIN);
if(origin.protocol!=='http:'||origin.hostname!=='127.0.0.1'||!origin.port||origin.port==='5432'||origin.pathname!=='/')throw Error('Local fixture only');
let calls=0;
const supabase={from(){throw Error('No direct private SELECT fallback allowed');},async rpc(name,args){
  calls++;
  if(!['oaz_privacy_editor_list_v3','oaz_donor_write_v3'].includes(name))throw Error('Unexpected fixture RPC');
  const response=await fetch(new URL('/rpc/'+name,origin),{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+process.env.OAZ_FAKE_JWT},body:JSON.stringify(args),redirect:'error'});
  const body=await response.json();return response.ok?{data:body,error:null}:{data:null,error:body};
}};
const f=loadSource('src/app/editor/services/board.service.ts',{'@/lib/supabaseClient':{supabase}},{process:{env:{NEXT_PUBLIC_OAZ_PRIVACY_V2:'true'}}});
let passed=0;
if(process.env.OAZ_FIXTURE_ACTOR==='approved') {
  const rows=await f.fetchPosts('registered_member');assert.ok(rows.length);assert.ok(rows.every(row=>Object.keys(row).every(k=>['id','name','department','generation'].includes(k))));passed++;
} else {
  await assert.rejects(f.fetchPosts('registered_member'),e=>e.name==='PrivacyAccessError');passed++;
  await assert.rejects(f.insertPost('editor_5_donators',{name:'fake unauthorized'}),e=>e.name==='PrivacyAccessError');passed++;
}
assert.equal(calls,passed);
console.log(JSON.stringify({passed,failed:0,synthetic_only:true,production_connected:false}));
