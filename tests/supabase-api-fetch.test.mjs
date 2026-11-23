import test from 'node:test';import assert from 'node:assert/strict';
import {loadSource} from './helpers/react-dom.mjs';
import {createClient} from '@supabase/supabase-js';
const origin='https://synthetic.invalid';
const {supabaseApiFetch}=loadSource('src/lib/supabase-api-fetch.ts',{}, {Request,Headers,URL});
test('opaque keys use apikey only, legacy and real session JWT stay unchanged',async()=>{
 const seen=[],fetcher=supabaseApiFetch(origin,async(u,o)=>{seen.push(new Headers(o.headers));return Response.json({})});
 for(const key of ['sb_secret_fixture','sb_publishable_fixture','legacy.jwt.signature'])await fetcher(origin+'/auth/v1/settings',{headers:{apikey:key,Authorization:'Bearer '+key}});
 assert.equal(seen[0].get('authorization'),null);assert.equal(seen[1].get('authorization'),null);assert.equal(seen[2].get('authorization'),'Bearer legacy.jwt.signature');
 await fetcher(origin+'/auth/v1/user',{headers:{apikey:'sb_publishable_fixture',Authorization:'Bearer user.jwt.signature'}});assert.equal(seen[3].get('authorization'),'Bearer user.jwt.signature');
});
test('opaque key rewrite cannot target another origin or follow redirects',async()=>{
 let count=0;const f=supabaseApiFetch(origin,async(u,o)=>{count++;assert.equal(o.redirect,'error');return Response.json({})});
 const init={method:'POST',headers:{apikey:'sb_secret_fixture',Authorization:'Bearer sb_secret_fixture'},body:'{}'};
 await assert.rejects(f('https://other.invalid/auth/v1/admin/users',init));assert.equal(count,0);await f(origin+'/auth/v1/admin/users',init);assert.equal(count,1);
});
test('installed Supabase SDK admin GET uses corrected headers without a real user or network',async()=>{
 let calls=0;const client=createClient(origin,'sb_secret_fixture',{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:supabaseApiFetch(origin,async(u,o)=>{calls++;const r=new Request(u,o);assert.equal(r.method,'GET');assert.equal(r.headers.get('apikey'),'sb_secret_fixture');assert.equal(r.headers.get('authorization'),null);return Response.json({code:404,error_code:'user_not_found',msg:'User not found'},{status:404});})}});
 const {error}=await client.auth.admin.getUserById('00000000-0000-0000-0000-000000000000');assert.equal(error.status,404);assert.equal(calls,1);
});
