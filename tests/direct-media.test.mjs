import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as crypto from 'node:crypto';
import sharp from 'sharp';
import {loadSource} from './helpers/react-dom.mjs';
const origin='https://www.oazkorea.co.kr',api='https://synthetic.example.invalid';
const raw=Buffer.from('synthetic raw image');
function setup(ttl=7200,production=false){
 const env={...(production?{OAZ_GATEWAY_TRANSPORT:'data-api-v1'}:{}),OAZ_ACCOUNTS_GATE_KEY:'a'.repeat(64),NEXT_PUBLIC_SUPABASE_URL:api};
 const actor={id:'00000000-0000-4000-8000-000000000001',role:'SUPER_ADMIN',scopes:[]};let clock=Date.now(),uploaded=raw,stored=false,normalizations=0;
 const jwt=aal=>'header.'+Buffer.from(JSON.stringify({sub:actor.id,aal})).toString('base64url')+'.signature';
 const port={identity:async()=>actor,reserve:async()=>true,upload:async()=>true,finish:async()=>{stored=true;return true}};
 const {directMedia}=loadSource('src/lib/admin/direct-media.ts',{'server-only':{},'node:crypto':crypto,'../security-profile':{reviewedMainRuntime:()=>production},'./protocol':{adminConfiguration:()=>({origin})},'./media-credentials':{managedMediaEnabled:()=>true,mediaUploaderKey:async()=>'server-only'},'./media-upload':{MEDIA_BUCKETS:{editor_6_events:'card_news'}},'./media-server':{mediaPort:()=>port},'./server-client':{serverClient:()=>({storage:{from:()=>({createSignedUploadUrl:async(path,opts)=>{assert.equal(opts.upsert,false);return {data:{signedUrl:api+'/storage/v1/object/upload/sign/oaz-final-image-staging/'+path+'?token=header.'+Buffer.from(JSON.stringify({exp:Math.floor(clock/1000)+ttl})).toString('base64url')+'.synthetic'}}},download:async()=>({data:new Blob([uploaded])})})}})},'./image-normalize':{normalizeDeliveryImage:async x=>{normalizations++;return x}},'../acceptance-rpc':{acceptanceRpc:async()=>stored?{ok:true}:null}},{process:{env},Date:class extends Date{static now(){return clock}},Buffer,URL,Response,Uint8Array,crypto:crypto.webcrypto});
 const prepare={action:'prepare',table:'editor_6_events',size:raw.length,sha:crypto.createHash('sha256').update(raw).digest('hex'),mime:'image/webp',rights:true};
 const run=(body=prepare,headers={})=>directMedia(new Request(origin+'/api/admin/media/direct',{method:'POST',headers:{origin,authorization:'Bearer '+jwt('aal2'),'content-type':'application/json',...headers},body:JSON.stringify(body)}));
 return {run,prepare,actor,port,jwt,setBytes:x=>uploaded=x,expire:()=>clock+=601000,get normalized(){return normalizations}};
}
test('direct issuance requires origin, bearer, MFA, scope and consent',async()=>{
 const x=setup();assert.equal((await x.run(undefined,{origin:'https://evil.invalid'})).status,403);assert.equal((await x.run(undefined,{authorization:''})).status,401);
 assert.equal((await x.run(undefined,{authorization:'Bearer '+x.jwt('aal1')})).status,403);
 assert.equal((await x.run({...x.prepare,rights:false})).status,400);
 x.actor.role='ADMIN';assert.equal((await x.run()).status,403);x.actor.scopes=['editor_6_events'];assert.equal((await x.run()).status,200);assert.equal((await x.run(undefined,{authorization:'Bearer '+x.jwt('aal1')})).status,200);
});
test('direct input bounds and immutable server-selected paths',async()=>{
 const x=setup();for(const size of [0,-1,5*1024*1024+1,1.1])assert.equal((await x.run({...x.prepare,size})).status,400);
 assert.equal((await x.run({...x.prepare,mime:'image/svg+xml'})).status,400);assert.equal((await x.run({...x.prepare,extra:'x'.repeat(5000)})).status,413);
 const data=await (await x.run({...x.prepare,path:'../../overwrite'})).json();assert.match(data.signedUrl,/\/managed\/[0-9a-f-]+\.webp\?/);assert.equal(data.expiresIn,600);assert.equal(data.finalizeExpiresIn,600);assert.equal(data.signedUploadExpiresIn,7200);assert.ok(!JSON.stringify(data).includes('server-only'));
 const visible=JSON.parse(Buffer.from(data.ticket.split('.')[0],'base64url').toString());assert.equal(visible.path,undefined);assert.ok(visible.raw);
});
test('finalization verifies ticket, body hash, current MFA and permits idempotent response retry',async()=>{
 const x=setup(),t=await (await x.run()).json();
 assert.equal((await x.run({action:'finish',ticket:t.ticket+'x'})).status,400);
 x.setBytes(Buffer.from('changed'));assert.equal((await x.run({action:'finish',ticket:t.ticket})).status,400);assert.equal(x.normalized,0);
 x.setBytes(raw);const first=await x.run({action:'finish',ticket:t.ticket});assert.equal(first.status,201);
 const second=await x.run({action:'finish',ticket:t.ticket});assert.deepEqual(await second.json(),await first.json());assert.equal(x.normalized,1);
 x.expire();assert.equal((await x.run({action:'finish',ticket:t.ticket})).status,400);
});
test('large source delivery checks original SHA before derivative and rechecks withdrawal',async()=>{
 const base=await sharp({create:{width:64,height:48,channels:3,background:'#234567'}}).webp().toBuffer();
 const padding=Buffer.alloc(4194304+128-base.length-8),head=Buffer.alloc(8);head.write('JUNK');head.writeUInt32LE(padding.length,4);
 const input=Buffer.concat([base,head,padding]);input.writeUInt32LE(input.length-8,4);
 const norm=loadSource('src/lib/admin/image-normalize.ts',{sharp},{Uint8Array});
 const derivative=await norm.normalizeDeliveryImage(input);assert.ok(derivative.length<4194304);assert.equal((await sharp(derivative).metadata()).format,'webp');
 let count=0,withdraw=false,badHash=false;
 const env={OAZ_IMAGE_READER_JWT:'header.'+Buffer.from(JSON.stringify({role:'oaz_image_reader',exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')+'.signature'};
 const {GET}=loadSource('src/app/api/images/[bucket]/[...path]/route.ts',{'node:fs/promises':{},'node:path':{},'node:crypto':crypto,'@/lib/security-profile':{reviewedMainRuntime:()=>true,isDesktopLocalProfile:()=>false,localProfile:()=>({})},'@/lib/acceptance-rpc':{acceptanceRpc:async()=>++count>1&&withdraw?null:{byteCount:input.length,sha256:badHash?'0'.repeat(64):crypto.createHash('sha256').update(input).digest('hex')}},'@/lib/admin/server-client':{serverClient:()=>({storage:{from:()=>({download:async()=>({data:new Blob([input],{type:'image/webp'})})})}})},'@/lib/admin/image-normalize':norm},{process:{env},URL,Response,Uint8Array,Buffer});
 const run=()=>GET(new Request(origin+'/api/images/card_news/large.webp'),{params:Promise.resolve({bucket:'card_news',path:['large.webp']})});
 let response=await run();assert.equal(response.status,200);assert.ok((await response.arrayBuffer()).byteLength<4194304);assert.match(response.headers.get('cache-control'),/no-store/);
 count=0;withdraw=true;assert.equal((await run()).status,404);count=0;withdraw=false;badHash=true;assert.equal((await run()).status,404);
});

test('signed upload expiry is provider metadata, distinct from ten-minute finalization',async()=>{
 const short=await (await setup(60).run()).json();assert.equal(short.signedUploadExpiresIn,60);assert.equal(short.finalizeExpiresIn,600);
 for(const ttl of [0,-1,90000])assert.equal((await setup(ttl).run()).status,503);
});

test('Main image preparation issues only a user-authenticated staging path',async()=>{
 const x=setup(7200,true)
 const response=await x.run(x.prepare)
 assert.equal(response.status,200)
 const payload=await response.json()
 assert.match(payload.authenticatedPath,/^managed\/[0-9a-f-]{36}\.webp$/)
 assert.equal(payload.signedUrl,undefined)
 assert.ok(payload.ticket)
})

test('News card rendition is bounded and full-size bytes remain available only after publication checks',async()=>{
 const {default:sharp}=await import('sharp')
 const norm=loadSource('src/lib/admin/image-normalize.ts',{sharp},{Uint8Array})
 const input=await sharp(crypto.randomBytes(1200*1600*3),{raw:{width:1200,height:1600,channels:3}}).jpeg({quality:90}).toBuffer()
 const hash=crypto.createHash('sha256').update(input).digest('hex')
 let reads=0,denyAt=0
 const {GET}=loadSource('src/app/api/images/[bucket]/[...path]/route.ts',{
  'node:fs/promises':{},'node:path':{},'node:crypto':crypto,
  '@/lib/security-profile':{reviewedMainRuntime:()=>true,isDesktopLocalProfile:()=>false},
  '@/lib/acceptance-rpc':{acceptanceRpc:async()=> ++reads===denyAt?null:{byteCount:input.length,sha256:hash}},
  '@/lib/admin/server-client':{serverClient:()=>({storage:{from:()=>({download:async()=>({data:new Blob([input],{type:'image/jpeg'})})})}})},
  '@/lib/admin/image-normalize':norm
 },{process:{env:{OAZ_GATEWAY_TRANSPORT:'data-api-v1'}},URL,Response,Uint8Array,Buffer})
 const read=query=>GET(new Request(origin+'/api/images/card_news/item.jpg'+query),{params:Promise.resolve({bucket:'card_news',path:['item.jpg']})})
 const thumb=await read('?view=news-card')
 assert.equal(thumb.status,200);assert.match(thumb.headers.get('cache-control'),/no-store/)
 const bytes=Buffer.from(await thumb.arrayBuffer()),info=await sharp(bytes).metadata()
 assert.ok(bytes.length<input.length);assert.equal(info.format,'webp');assert.equal(info.height,960);assert.equal(info.width,720)
 const full=await read('');assert.equal(crypto.createHash('sha256').update(Buffer.from(await full.arrayBuffer())).digest('hex'),hash)
 reads=0;denyAt=2;assert.equal((await read('?view=news-card')).status,404)
})

test('a bundled News rendition requires the exact source digest and a second publication check',async()=>{
 const input=Buffer.alloc(5*1024*1024-20000,1),thumb=Buffer.from('synthetic bounded rendition')
 const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex')
 const cover={path:'test.webp',sourceSha256:hash(input),bytes:thumb.toString('base64'),sha256:hash(thumb)}
 let reads=0,withdraw=false
 const {GET}=loadSource('src/app/api/images/[bucket]/[...path]/route.ts',{
  '@/data/news-list-cover.json':cover,'node:fs/promises':{},'node:path':{},'node:crypto':crypto,
  '@/lib/security-profile':{reviewedMainRuntime:()=>true,isDesktopLocalProfile:()=>false},
  '@/lib/acceptance-rpc':{acceptanceRpc:async()=> ++reads===2&&withdraw?null:{byteCount:input.length,sha256:hash(input)}},
  '@/lib/admin/server-client':{serverClient:()=>({storage:{from:()=>({download:async()=>({data:new Blob([input])})})}})},
  '@/lib/admin/image-normalize':{normalizeDeliveryImage:async bytes=>bytes.subarray(0,1000),newsCardImage:async bytes=>bytes}
 },{process:{env:{OAZ_GATEWAY_TRANSPORT:'data-api-v1'}},URL,Response,Uint8Array,Buffer})
 const read=()=>GET(new Request(origin+'/api/images/card_news/test.webp?view=news-card'),{params:Promise.resolve({bucket:'card_news',path:['test.webp']})})
 const checked=await read();assert.equal(checked.status,200);assert.deepEqual(Buffer.from(await checked.arrayBuffer()),thumb)
 reads=0;withdraw=true;assert.equal((await read()).status,404)
 reads=0;withdraw=false;input[0]=2
 assert.deepEqual(Buffer.from(await (await read()).arrayBuffer()),input.subarray(0,1000))
})
