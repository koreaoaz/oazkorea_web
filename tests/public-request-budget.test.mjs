import {test} from 'node:test';import assert from 'node:assert/strict';
import {loadSource} from './helpers/react-dom.mjs';
const turn=()=>new Promise(resolve=>setImmediate(resolve));
test('public metadata shares in-flight reads, bounds concurrency and never caches completed or failed responses',async()=>{
 const releases=[],calls=[];
 const {publicContentRpc}=loadSource('src/lib/public-content-rpc.ts',{'@/lib/supabaseClient':{supabase:{}}},{window:{},URLSearchParams,process:{env:{NEXT_PUBLIC_OAZ_SECURITY_BRIDGE:'true'}},fetch:async(url,options)=>{calls.push({url,options});return await new Promise(resolve=>releases.push(resolve))}});
 const read=id=>publicContentRpc('oaz_public_content_meta_v1',{tbl:'editor_2_studies',rid:id});
 const a=read(0),same=read(0),rest=Array.from({length:6},(_,i)=>read(i+1));await turn();assert.equal(calls.length,4);
 for(let i=0;i<7;i++){releases[i](Response.json({id:i}));await turn();assert.ok(calls.length-i-1<=4)}
 assert.equal((await a).data,(await same).data);await Promise.all(rest);assert.equal(calls.length,7);
 const fresh=read(0);await turn();assert.equal(calls.length,8);releases[7](new Response('',{status:503}));assert.equal((await fresh).data,null);
 const retry=read(0);await turn();assert.equal(calls.length,9);releases[8](Response.json({changed:true}));assert.equal((await retry).data.changed,true);
 for(const {options} of calls){assert.equal(options.cache,'no-store');assert.equal(options.credentials,'omit');assert.equal(options.headers,undefined)}
});
