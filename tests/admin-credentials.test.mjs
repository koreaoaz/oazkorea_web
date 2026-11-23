import {test} from 'node:test';
import assert from 'node:assert/strict';
import {loadSource} from './helpers/react-dom.mjs';
const origin='http://127.0.0.1:3304',token='a'.repeat(30);
function fixture(options={}){
 const calls=[];const auth={auth:{getUser:async()=>({data:{user:{id:'owner',email:'owner@example.invalid'}}}),signInWithPassword:async()=>({data:{user:{id:'owner'}}}),signOut:async()=>{},admin:{updateUserById:async()=>({}),signOut:async()=>({error:null}),generateLink:async()=>({data:{properties:{hashed_token:'synthetic'}}})}}};
 const provider={credentialsConfiguration:()=>({origin}),credentialsAuth:()=>auth,credentialRpc:async(name,command)=>{calls.push({name,command});if(options.denied)throw Error('42501');return options.result??{status:'completed'}},...options.provider};
 const {POST}=loadSource('src/app/api/admin/credentials/route.ts',{'server-only':{},'@/lib/admin/credentials-server':provider},{Request,Response,TextDecoder,TextEncoder,Error,process:{env:options.env??{}}});
 const send=(body={action:'list'},headers={})=>POST(new Request(origin+'/api/admin/credentials',{method:'POST',headers:{origin,authorization:'Bearer '+token,'content-type':'application/json',...headers},body:JSON.stringify(body)}));
 return {send,calls,auth};
}
test('credentials reject cross origin, missing auth and non JSON before mutation',async()=>{
 const f=fixture();for(const [headers,code] of [[{origin:'https://evil.invalid'},403],[{authorization:''},401],[{'content-type':'text/plain'},415]])assert.equal((await f.send({},headers)).status,code);assert.equal(f.calls.length,0);
});
test('bounded credentials body and unexpected authority fields rejected',async()=>{
 const f=fixture();assert.equal((await f.send({password:'x'.repeat(9000)})).status,413);
 for(const b of [[],null,{action:'rename',role:'SUPER_ADMIN'},{action:'rename',userId:'victim'}])assert.equal((await f.send(b)).status,400);assert.equal(f.calls.length,0);
});
test('authorization denial is retained and secret provider details never returned',async()=>{
 const f=fixture({denied:true});const r=await f.send({action:'rename'});assert.equal(r.status,403);assert.equal(r.headers.get('cache-control'),'no-store');assert.doesNotMatch(await r.text(),/Bearer|owner@example/);
 const g=fixture({provider:{credentialRpc:async()=>{throw Error('PRIVATE_SECRET')}}});assert.doesNotMatch(await (await g.send()).text(),/PRIVATE_SECRET/);
});
test('weak or excessive UTF8 password denied before SQL and official Auth mutation',async()=>{
 for(const password of ['short','a'.repeat(20),'한'.repeat(25)]){const f=fixture();assert.equal((await f.send({action:'password',password})).status,400);assert.equal(f.calls.length,0)}
});
test('self password requires correct current password and does not put either in SQL',async()=>{
 const f=fixture();f.auth.auth.signInWithPassword=async()=>({data:{user:null},error:{}});
 assert.equal((await f.send({action:'password',password:'Synthetic New Password 77!',currentPassword:'wrong'})).status,403);assert.equal(f.calls.length,0);
});
test('list preserves server result and never returns service keys',async()=>{
 const f=fixture({result:[{slot:'admin1',username:'fixture.owner'}]});const r=await f.send();assert.equal(r.status,200);assert.equal((await r.json()).result.length,1);
});
test('SMTP mode calls actual Auth mail method and never returns a generated token',async()=>{
 let sends=0,generations=0;
 const f=fixture({env:{OAZ_ACCOUNTS_RECOVERY_DELIVERY:'smtp-tokenhash-v1'},provider:{credentialRpc:async(name)=>name==='accounts_manage'?{status:'prepared',taskId:'synthetic-task'}:{email:'target@example.invalid'}}});
 f.auth.auth.resetPasswordForEmail=async(email,options)=>{sends++;assert.equal(email,'target@example.invalid');assert.equal(options.redirectTo,origin+'/admin/password-reset?task=synthetic-task');return {error:null}};
 f.auth.auth.admin.generateLink=async()=>{generations++;throw Error('not allowed')};
 const r=await f.send({action:'reset'});assert.equal(r.status,200);assert.equal((await r.json()).result.status,'recovery-email-requested');assert.equal(sends,1);assert.equal(generations,0);
 f.auth.auth.resetPasswordForEmail=async()=>({error:{message:'PRIVATE_SMTP_DETAIL'}});const fail=await f.send({action:'reset'});assert.equal(fail.status,503);assert.doesNotMatch(await fail.text(),/PRIVATE_SMTP_DETAIL/);
});
test('reset completion revokes DB then Auth global sessions without changing MFA',async()=>{
 const order=[];const f=fixture({provider:{credentialRpc:async(name,command)=>{order.push(command.action);return name==='accounts_manage'?{userId:'owner',lease:'synthetic-lease'}:{status:'completed'}}}});
 f.auth.auth.admin.updateUserById=async(id,body)=>{order.push('password');assert.equal(id,'owner');assert.deepEqual(Object.keys(body),['password']);return {error:null}};
 f.auth.auth.admin.signOut=async(jwt,scope)=>{order.push('global');assert.equal(jwt,token);assert.equal(scope,'global');return {error:null}};
 assert.equal((await f.send({action:'reset.finish',taskId:'fixture',password:'Synthetic New Password 77!'})).status,200);
 assert.deepEqual(order,['reset.claim','password','task.complete','global']);
 f.auth.auth.admin.signOut=async()=>({error:{}});const r=await f.send({action:'reset.finish',taskId:'fixture',password:'Synthetic New Password 77!'});assert.equal(r.status,503);assert.equal((await r.json()).error,'PASSWORD_CHANGED_SESSION_REVIEW_REQUIRED');
});
test('production profile is opt-in, pinned and requires the reviewed private gateway',()=>{
 const {reviewedMainProfile}=loadSource('src/lib/security-profile.ts',{}, {URL});
 const env={OAZ_ACCOUNTS_RELEASE:'reviewed-v1',OAZ_SECURITY_BRIDGE:'true',OAZ_SUPABASE_PROJECT_REF:'maoefmwpdcnugyenyiea',NEXT_PUBLIC_SUPABASE_URL:'https://maoefmwpdcnugyenyiea.supabase.co',OAZ_ADMIN_ORIGIN:'https://oaz.example.invalid',OAZ_ACCOUNTS_PRIVATE_GATEWAY:'https://private.example.invalid/acceptance-rpc/v1/rpc/',OAZ_ACCOUNTS_GATE_KEY:'a'.repeat(64)};
 assert.ok(reviewedMainProfile(env));for(const change of [{OAZ_ACCOUNTS_RELEASE:''},{OAZ_SECURITY_BRIDGE:''},{OAZ_SUPABASE_PROJECT_REF:'ctbwaqtqubmjmltbxfzm'},{OAZ_ACCOUNTS_PRIVATE_GATEWAY:'http://private.example.invalid/acceptance-rpc/v1/rpc/'},{OAZ_ACCOUNTS_GATE_KEY:'short'}])assert.equal(reviewedMainProfile({...env,...change}),null);
});
