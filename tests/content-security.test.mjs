import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {validAuthenticatedToken, restWriteDenied, graphqlWriteDenied} from '../scripts/test-local-content-security.mjs';
import {contentSql} from '../scripts/local-content-guard.mjs';
import {checkReleaseAssets} from '../scripts/check-production-release.mjs';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';

test('Content HTTP tests accept only a genuine ordinary role and verify subject, expiry, session and signature', () => {
  const secret='synthetic-unit-signing-secret';
  const id='00000000-0000-4000-8000-000000000099';
  const original={sub:id,role:'authenticated',session_id:id,exp:Math.floor(Date.now()/1000)+300};
  function token(claims=original,key=secret) {
    const h=Buffer.from(JSON.stringify({alg:'HS256'})).toString('base64url');
    const p=Buffer.from(JSON.stringify(claims)).toString('base64url');
    return `${h}.${p}.${createHmac('sha256',key).update(`${h}.${p}`).digest('base64url')}`;
  }
  assert.equal(validAuthenticatedToken(token(),id,secret),true);
  for(const claims of [{...original,role:'service_role'},{...original,role:'anon'},
    {...original,sub:'00000000-0000-4000-8000-000000000098'},{...original,exp:1},{...original,session_id:null}]) {
    assert.equal(validAuthenticatedToken(token(claims),id,secret),false);
  }
  assert.equal(validAuthenticatedToken(token(original,'wrong-key'),id,secret),false);
});
test('REST denial cannot be faked by invalid input, missing tables, arbitrary errors or a successful write', () => {
  for(const op of ['insert','update','delete']) {
    assert.equal(restWriteDenied(403,{code:'42501'},op),true);
    for(const [status,body] of [[500,{code:'42501'}],[400,{code:'PGRST204'}],[404,{code:'42P01'}],[200,[{id:1}]]]) {
      assert.equal(restWriteDenied(status,body,op),false);
    }
  }
  assert.equal(restWriteDenied(200,[],'insert'),false);
  assert.equal(restWriteDenied(200,[],'update'),true);
  assert.equal(restWriteDenied(200,[],'delete'),true);
});
test('GraphQL denial requires actual RLS denial, zero affected rows or a verified role-hidden canonical field', () => {
  const name='updateEditor0NotiCollection';
  assert.equal(graphqlWriteDenied(200,{data:{[name]:{affectedCount:0}}},name,[name]),true);
  assert.equal(graphqlWriteDenied(200,{errors:[{message:'new row violates row-level security policy'}]},name,[name]),true);
  const hidden={errors:[{message:`Unknown field '${name}' on type 'Mutation'`}]};
  assert.equal(graphqlWriteDenied(200,hidden,name,[]),true);
  assert.equal(graphqlWriteDenied(200,hidden,name,[name]),false);
  assert.equal(graphqlWriteDenied(200,{errors:[{message:'Unknown type Mutation'}]},name,[]),true);
  assert.equal(graphqlWriteDenied(200,{errors:[{message:'Unknown type Mutation'}]},name,[name]),false);
  for(const body of [null,{errors:[{message:'invalid input'}]},{errors:[{message:'unknown field typo'}]},
    {errors:[{message:'Input for type Editor0NotiInsertInput contains extra keys'}]},
    {data:{[name]:{affectedCount:1}}}]) assert.equal(graphqlWriteDenied(200,body,name,[name]),false);
  assert.equal(graphqlWriteDenied(500,{errors:[{message:'permission denied'}]},name,[name]),false);
});
test('Additional content SQL has its own manifest while the frozen thirteen privacy SQL files stay intact', () => {
  assert.equal(checkReleaseAssets().sqlFiles,13);
  assert.ok(contentSql('011-content-write-guard.sql'));
  assert.ok(contentSql('012-content-write-postcheck.sql'));
  assert.throws(()=>contentSql('../010-privacy-minimal.sql'),/LOCAL_CONTENT_SQL_REQUIRED/);
});
test('CI cannot mark an untested fixture or omit the actual content permission suite', () => {
  const yaml=createRequire(import.meta.url)('js-yaml');
  const workflow=yaml.load(readFileSync('.github/workflows/privacy-hotfix.yml','utf8'));
  const job=workflow.jobs['local-supabase'];
  assert.equal(workflow.permissions.contents,'read');
  const steps=job.steps;
  const integration=steps.findIndex(s=>s.run==='npm run test:local-supabase');
  const provenance=steps.findIndex(s=>s.run?.includes("writeFileSync('build/oauth/fixture-provenance.json'"));
  const content=steps.findIndex(s=>s.run?.includes('node scripts/test-local-content-security.mjs verify'));
  assert.ok(integration>=0 && provenance>integration && content>provenance);
  for(const i of [integration,provenance,content]) {
    assert.equal(steps[i]['continue-on-error'],undefined);
    assert.equal(steps[i].if,undefined);
  }
  assert.ok(steps[content].run.indexOf('node scripts/local-content-guard.mjs apply')<steps[content].run.indexOf('node scripts/test-local-content-security.mjs verify'));
  assert.ok(steps.slice(content+1).some(s=>s.if==='always()' && s.run==='npm run local:stop'));
});
