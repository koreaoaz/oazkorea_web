// 기존 서버를 재시작하지 않는 실제 Auth/REST/GraphQL 검사. 테스트 소유 자료만 정리한다.
import assert from 'node:assert/strict';
import { randomBytes, randomInt, createHmac } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { API, sql } from './local-supabase.mjs';
import { contentFixture, checkContentGuard } from './local-content-guard.mjs';
import { localFetch } from './test-local-supabase.mjs';
export const contentTables = [
  ['editor_0_noti', 'Editor0Noti', 'text'], ['editor_1_projects', 'Editor1Projects', 'project_name'],
  ['editor_2_studies', 'Editor2Studies', 'study_name'], ['editor_3_study_timetable', 'Editor3StudyTimetable', 'study_name'],
  ['editor_4_schedules', 'Editor4Schedules', 'description'], ['editor_5_donators', 'Editor5Donators', 'name'],
  ['editor_6_events', 'Editor6Events', 'title'],
];
export function validAuthenticatedToken(token, userId, secret) {
  try {
    const [h, p, s, extra] = token.split('.');
    const claims = JSON.parse(Buffer.from(p, 'base64url'));
    return !extra && JSON.parse(Buffer.from(h, 'base64url')).alg === 'HS256' && claims.role === 'authenticated' &&
      claims.sub === userId && /^[a-f0-9-]{36}$/.test(claims.session_id) && claims.exp > Date.now()/1000 &&
      createHmac('sha256', secret).update(`${h}.${p}`).digest('base64url') === s;
  } catch { return false; }
}
export function restWriteDenied(status, body, operation) {
  if ([401, 403].includes(status) && body?.code === '42501') return true;
  return operation !== 'insert' && status === 200 && Array.isArray(body) && body.length === 0;
}
export function graphqlWriteDenied(status, body, field, reflectedFields) {
  if (status !== 200 || !body || typeof body !== 'object') return false;
  if (!body.errors && body.data?.[field]?.affectedCount === 0) return true;
  return body.data == null && Array.isArray(body.errors) && body.errors.length > 0 && body.errors.every(e =>
    /row-level security|permission denied/i.test(e.message ?? '') ||
    reflectedFields.length === 0 && e.message === 'Unknown type Mutation' ||
    !reflectedFields.includes(field) && (e.message ?? '').includes(field) && /unknown field|cannot query field/i.test(e.message ?? ''));
}
export function tableDigest(table) {
  if (!contentTables.some(([name]) => name === table)) throw Error('LOCAL_CONTENT_TABLE_REQUIRED');
  return sql(`BEGIN READ ONLY; SELECT md5(coalesce(string_agg(row_to_json(t)::text,'' ORDER BY id),'')) FROM public.${table} t; ROLLBACK;`);
}
async function main(mode) {
  if (!['diagnose', 'verify'].includes(mode)) throw Error('LOCAL_CONTENT_MODE_REQUIRED');
  const status = contentFixture();
  if (mode === 'verify') checkContentGuard();
  const fetcher = localFetch();
  const client = key => createClient(API, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch: fetcher } });
  const admin = client(status.SERVICE_ROLE_KEY); // 준비/정리 전용. 아래 요청에는 이 키를 사용하지 않는다.
  const marker = `oaz-content-${randomBytes(8).toString('hex')}`;
  const password = randomBytes(24).toString('base64url');
  const base = -1000000000 - randomInt(400000000);
  let next = base, checks = 0, phase = 'setup', lastResponse;
  const users = [], tokens = [], clients = [], fields = new Map();
  const before = Object.fromEntries(contentTables.map(([t]) => [t, tableDigest(t)]));
  const ok = value => { assert.ok(value, `LOCAL_CONTENT_ASSERT_${phase}`); checks++; };
  async function request(token, path, method = 'GET', body, headers = {}) {
    const response = await fetcher(API + path, { method, headers: { apikey: status.ANON_KEY,
      Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Prefer: 'return=representation', ...headers },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    let data; try { data = await response.json(); } catch { data = null; }
    lastResponse = { status: response.status, code: /^[A-Z0-9]{5,12}$/.test(data?.code ?? '') ? data.code : null,
      graphqlErrors: (data?.errors ?? []).map(e => /unknown field|cannot query field/i.test(e.message ?? '') ? 'unknown_field' :
        /row-level security/i.test(e.message ?? '') ? 'row_security' : /permission denied/i.test(e.message ?? '') ? 'permission' :
        e.message==='Unknown type Mutation' ? 'hidden_mutation_type' : /input for type|contains extra keys/i.test(e.message ?? '') ? 'input_schema_mismatch' : 'other') };
    return { status: response.status, body: data };
  }
  async function graph(token, query) { return request(token, '/graphql/v1', 'POST', { query }); }
  async function reflection(token) {
    const r = await graph(token, '{ __schema { mutationType { fields { name } } } }');
    ok(r.status === 200 && !r.body.errors && r.body.data?.__schema);
    return r.body.data.__schema.mutationType?.fields.map(f => f.name) ?? [];
  }
  function seed(table, column) {
    const id = --next;
    ok(sql(`SELECT count(*) FROM public.${table} WHERE id=${id};`) === '0');
    sql(`INSERT INTO public.${table}(id,${column}) VALUES(${id},'${marker}');`);
    return id;
  }
  const mutationName = (stem, operation) => `${operation === 'insert' ? 'insertInto' : operation === 'update' ? 'update' : 'deleteFrom'}${stem}Collection`;
  function mutation(table, stem, column, operation, id) {
    const field = mutationName(stem, operation);
    const value = JSON.stringify(`${marker}-${operation}`);
    const graphColumn=column.replace(/_([a-z])/g,(_,letter)=>letter.toUpperCase());
    const args = operation === 'insert' ? `objects:[{${graphColumn}:${value}}]`
      : operation === 'update' ? `set:{${graphColumn}:${value}},filter:{id:{eq:${id}}},atMost:1` : `filter:{id:{eq:${id}}},atMost:1`;
    return { field, query: `mutation { ${field}(${args}) { affectedCount records { id } } }` };
  }
  async function denied(token, table, stem, column, id, protocol, headers = {}) {
    for (const operation of ['insert', 'update', 'delete']) {
      const digest = tableDigest(table), candidate = --next;
      let result;
      if (protocol === 'rest') {
        const body = operation === 'delete' ? undefined : { [column]: `${marker}-${operation}`,
          ...(operation === 'insert' && table !== 'editor_5_donators' ? { id: candidate } : {}) };
        result = await request(token, `/rest/v1/${table}${operation === 'insert' ? '' : `?id=eq.${id}`}`,
          { insert: 'POST', update: 'PATCH', delete: 'DELETE' }[operation], body, headers);
        ok(restWriteDenied(result.status, result.body, operation));
      } else {
        const { field, query } = mutation(table, stem, column, operation, operation === 'insert' ? candidate : id);
        result = await graph(token, query);
        ok(graphqlWriteDenied(result.status, result.body, field, fields.get(token)));
      }
      ok(tableDigest(table) === digest);
    }
  }
  async function positive(token, table, stem, column, protocol) {
    let id = --next;
    const digest = tableDigest(table);
    for (const operation of ['insert', 'update', 'delete']) {
      if (protocol === 'rest') {
        const r = await request(token, `/rest/v1/${table}${operation === 'insert' ? '' : `?id=eq.${id}`}`,
          { insert: 'POST', update: 'PATCH', delete: 'DELETE' }[operation], operation === 'delete' ? undefined :
          { [column]: `${marker}-${operation}`, ...(operation === 'insert' ? { id } : {}) });
        ok([200,201].includes(r.status) && Array.isArray(r.body) && r.body.length === 1 && Number(r.body[0].id) === id);
      } else {
        const { field, query } = mutation(table, stem, column, operation, id);
        const r = await graph(token, query);
        ok(r.status === 200 && !r.body.errors && r.body.data?.[field]?.affectedCount === 1);
        if(operation==='insert') { id=Number(r.body.data[field].records?.[0]?.id);ok(Number.isSafeInteger(id)); }
      }
      const count = sql(`SELECT count(*) FROM public.${table} WHERE id=${id} AND ${column}='${marker}-${operation}';`);
      ok(count === (operation === 'delete' ? '0' : '1'));
    }
    ok(tableDigest(table) === digest);
  }
  try {
    for (let i = 0; i < 2; i++) {
      const email = `${marker}-${i}@example.invalid`;
      const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
      ok(!created.error && created.data.user?.id); users.push(created.data.user.id);
      const c = client(status.ANON_KEY); clients.push(c);
      const signed = await c.auth.signInWithPassword({ email, password });
      ok(!signed.error && !!signed.data.session); tokens.push(signed.data.session.access_token);
      ok(validAuthenticatedToken(tokens[i], users[i], status.JWT_SECRET));
      ok(!(await c.auth.getUser(tokens[i])).error);
      sql(`INSERT INTO public.registered_member(uuid,email,name,is_manager) VALUES('${users[i]}','${email}','${marker}',false);`);
    }
    console.log('LOCAL_CONTENT_AUTH_PASS users=2 role=authenticated authIssued=true privilegedTestRequests=false');
    if (mode === 'diagnose') {
      phase = 'baseline-normal-member';
      const id = seed('editor_0_noti','text');
      const r = await request(tokens[0], `/rest/v1/editor_0_noti?id=eq.${id}`, 'PATCH', { text: `${marker}-rest` });
      ok(r.status === 200 && r.body?.length === 1);
      const q = mutation('editor_0_noti','Editor0Noti','text','update',id);
      const g = await graph(tokens[0],q.query);
      ok(g.status === 200 && !g.body.errors && g.body.data?.[q.field]?.affectedCount === 1);
      console.log('LOCAL_CONTENT_VULNERABILITY_REPRODUCED ordinaryAuthJwt=true restUpdate=1 graphqlUpdate=1');
      return;
    }
    phase = 'editor-grant';
    sql(`INSERT INTO public.supervisor_id(uuid,name) VALUES('${users[1]}','${marker}');`);
    const oldEditorToken = tokens[1];
    for (const token of [status.ANON_KEY,...tokens]) fields.set(token, await reflection(token));
    phase = 'normal-metadata-forgery';
    ok(!(await clients[0].auth.updateUser({ data: { role: 'admin', is_manager: true, supervisor_id: users[1], user_id: users[1] } })).error);
    const refreshed = await clients[0].auth.refreshSession();
    ok(!refreshed.error && refreshed.data.session); tokens[0] = refreshed.data.session.access_token;
    ok(validAuthenticatedToken(tokens[0],users[0],status.JWT_SECRET)); fields.set(tokens[0],await reflection(tokens[0]));
    const targets = [];
    for (const [table,stem,column] of contentTables) {
      phase = `matrix-${table}`;
      const id = seed(table,column); targets.push([table,stem,column,id]);
      for (const token of [status.ANON_KEY,tokens[0]]) {
        const read = await request(token,`/rest/v1/${table}?select=id&id=eq.${id}`);
        ok(read.status === 200 && read.body?.length === 1);
        const collection=stem[0].toLowerCase()+stem.slice(1)+'Collection';
        const graphRead=await graph(token,`{ ${collection}(filter:{id:{eq:${id}}}) { edges { node { id } } } }`);
        ok(graphRead.status===200 && !graphRead.body.errors && graphRead.body.data?.[collection]?.edges.length===1);
        await denied(token,table,stem,column,id,'rest');
        await denied(token,table,stem,column,id,'graphql');
      }
      if (table === 'editor_5_donators') {
        // 기존 donor_writes=false 안전 스위치를 HTTP 검사 때문에 켜지 않는다.
        await denied(oldEditorToken,table,stem,column,id,'rest');
        await denied(oldEditorToken,table,stem,column,id,'graphql');
      } else {
        for (const op of ['insert','update','delete']) ok(fields.get(oldEditorToken).includes(mutationName(stem,op)));
        await positive(oldEditorToken,table,stem,column,'rest');
        await positive(oldEditorToken,table,stem,column,'graphql');
      }
      console.log('LOCAL_CONTENT_MATRIX_PASS table='+table);
    }
    phase = 'private-scope';
    for (const board of ['registered_member','allowed_user','supervisor_id']) {
      const r = await request(oldEditorToken,'/rest/v1/rpc/oaz_privacy_editor_list_v3','POST',{board});
      ok(r.status === 403 && r.body?.code === '42501');
    }
    phase = 'donor-enabled-isolated-transaction';
    {
      const digest=tableDigest('editor_5_donators');
      const claims=JSON.stringify(JSON.parse(Buffer.from(oldEditorToken.split('.')[1],'base64url'))).replaceAll("'","''");
      // 이 연결의 미커밋 상태에서만 기존 donor 쓰기 스위치를 켠다. 다른 요청에서는 계속 false다.
      const result=sql(`BEGIN; SET LOCAL statement_timeout='10s'; UPDATE oaz_privacy_v3.state SET donor_writes=true WHERE id;
DO $$ BEGIN PERFORM set_config('request.jwt.claims','${claims}',true); END $$;
SET LOCAL ROLE authenticated;
DO $$ DECLARE result jsonb; own_id bigint; BEGIN
result:=public.oaz_donor_write_v3('create',NULL,jsonb_build_object('name','${marker}')); own_id:=(result->>'id')::bigint;
IF own_id IS NULL THEN RAISE EXCEPTION 'LOCAL_CONTENT_DONOR_CREATE'; END IF;
PERFORM public.oaz_donor_write_v3('update',own_id,jsonb_build_object('name','${marker}-updated'));
IF NOT EXISTS(SELECT id FROM public.editor_5_donators WHERE id=own_id AND name='${marker}-updated') THEN RAISE EXCEPTION 'LOCAL_CONTENT_DONOR_UPDATE'; END IF;
PERFORM public.oaz_donor_write_v3('delete',own_id,'{}'::jsonb);
IF EXISTS(SELECT id FROM public.editor_5_donators WHERE id=own_id) THEN RAISE EXCEPTION 'LOCAL_CONTENT_DONOR_DELETE'; END IF;
END $$;
RESET ROLE; DELETE FROM public.supervisor_id WHERE uuid='${users[1]}' AND name='${marker}'; SET LOCAL ROLE authenticated;
DO $$ DECLARE denied boolean:=false; BEGIN
BEGIN PERFORM public.oaz_donor_write_v3('create',NULL,jsonb_build_object('name','${marker}')); EXCEPTION WHEN insufficient_privilege THEN denied:=true; END;
IF NOT denied THEN RAISE EXCEPTION 'LOCAL_CONTENT_DONOR_REVOKE'; END IF;
END $$;
SELECT 'LOCAL_CONTENT_DONOR_GATED_CRUD_AND_REVOKE_PASS'; ROLLBACK;`);
      ok(result.includes('LOCAL_CONTENT_DONOR_GATED_CRUD_AND_REVOKE_PASS'));ok(tableDigest('editor_5_donators')===digest);
      ok(sql('SELECT NOT donor_writes FROM oaz_privacy_v3.state WHERE id;')==='t');
      console.log('LOCAL_CONTENT_DONOR_GATED_CRUD_PASS isolatedTransactionRolledBack=true liveSwitchPreserved=true');
    }
    phase = 'unsigned-claims-forgery';
    for (const change of [{role:'service_role'},{sub:users[1]},{role:'authenticated',is_admin:true}]) {
      const [h,p,s] = tokens[0].split('.');
      const fake = `${h}.${Buffer.from(JSON.stringify({...JSON.parse(Buffer.from(p,'base64url')),...change})).toString('base64url')}.${s}`;
      const digest = tableDigest('editor_0_noti');
      const r = await request(fake,'/rest/v1/editor_0_noti','POST',{id:--next,text:marker});
      ok(r.status === 401 && ['PGRST301','PGRST303'].includes(r.body?.code)); ok(tableDigest('editor_0_noti')===digest);
      const q = mutation('editor_0_noti','Editor0Noti','text','insert',--next);
      const g = await graph(fake,q.query); ok(g.status===401); ok(tableDigest('editor_0_noti')===digest);
    }
    phase = 'request-identity-forgery';
    await denied(tokens[0],...targets[0],'rest',{'X-Role':'service_role','X-User-Id':users[1]});
    {
      const digest=tableDigest('editor_0_noti');
      const payload=await request(tokens[0],'/rest/v1/editor_0_noti','POST',{text:marker,role:'admin',user_id:users[1]});
      ok(payload.status===400 && payload.body?.code==='PGRST204');ok(tableDigest('editor_0_noti')===digest);
      const privateSchema=await request(tokens[0],'/rest/v1/capabilities','GET',undefined,{'Accept-Profile':'oaz_privacy_v3'});
      ok(privateSchema.status===406 && privateSchema.body?.code==='PGRST106');ok(tableDigest('editor_0_noti')===digest);
      const q=mutation('editor_0_noti','Editor0Noti','text','update',targets[0][3]);
      const alias=await graph(tokens[0],q.query.replace(q.field,'bypass: '+q.field));
      ok(graphqlWriteDenied(alias.status,alias.body,'bypass',['bypass']));ok(tableDigest('editor_0_noti')===digest);
    }
    phase = 'revoke-existing-jwt';
    sql(`DELETE FROM public.supervisor_id WHERE uuid='${users[1]}' AND name='${marker}';`);
    ok(tokens[1] === oldEditorToken && !(await clients[1].auth.getUser(oldEditorToken)).error);
    const claims = JSON.parse(Buffer.from(oldEditorToken.split('.')[1],'base64url'));
    ok(sql(`SELECT EXISTS(SELECT FROM auth.sessions WHERE id='${claims.session_id}' AND user_id='${users[1]}');`)==='t');
    for (const args of targets) {
      await denied(oldEditorToken,...args,'rest'); await denied(oldEditorToken,...args,'graphql');
    }
    for (const board of ['registered_member','allowed_user','supervisor_id']) {
      const r=await request(oldEditorToken,'/rest/v1/rpc/oaz_privacy_editor_list_v3','POST',{board});
      ok(r.status===403 && r.body?.code==='42501');
    }
    console.log('LOCAL_CONTENT_OLD_JWT_REVOKE_PASS sameToken=true sessionAlive=true tables=7 protocols=2');
  } catch (error) {
    console.error('LOCAL_CONTENT_STAGE_FAILURE '+JSON.stringify({phase,checks,lastResponse}));
    throw error;
  } finally {
    // 실행 중인 브라우저 회원/공지와 무관한 이번 실행의 난수 표식만 대상으로 한다.
    for (const [table,,column] of contentTables) sql(`DELETE FROM public.${table} WHERE ${column} LIKE '${marker}%';`);
    for (const id of users) {
      sql(`DELETE FROM public.supervisor_id WHERE uuid='${id}' AND name='${marker}'; DELETE FROM public.registered_member WHERE uuid='${id}' AND name='${marker}';`);
      const deleted = await admin.auth.admin.deleteUser(id); if(deleted.error)throw Error('LOCAL_CONTENT_USER_CLEANUP_FAILED');
    }
    for (const [table] of contentTables) assert.equal(tableDigest(table), before[table], 'LOCAL_CONTENT_DATA_PRESERVED');
    console.log('LOCAL_CONTENT_OWNED_FIXTURES_CLEANED existingContentPreserved=true');
  }
  if(mode==='verify') console.log(`LOCAL_CONTENT_SECURITY_PASS checks=${checks}`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { if(process.argv.length!==3)throw Error(); await main(process.argv[2]); }
  catch(error) { console.error(/^LOCAL_CONTENT_[A-Z_a-z0-9]+$/.test(error.message)?error.message:'LOCAL_CONTENT_SECURITY_FAILED_DIAGNOSTICS_SUPPRESSED');process.exitCode=1; }
}
