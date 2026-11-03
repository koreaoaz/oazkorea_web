// Explicit opt-in integration test. Executes writes only in the verified local fake stack.
import assert from 'node:assert/strict';
import { randomBytes, createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { API, localStatus, sql, reviewedSql, verifyRelease } from './local-supabase.mjs';
import { prepareLocalGraphql, graphqlPreparationPhase } from './prepare-local-graphql.mjs';
let phase = 'precheck';

export function localFetch(fetcher = globalThis.fetch) {
  return (input, options = {}) => {
    const value = typeof input === 'string' || input instanceof URL ? String(input) : input.url;
    const url = new URL(value);
    if (url.origin !== API || url.username || url.password || !['/auth/v1/', '/rest/v1/', '/graphql/v1', '/storage/v1/'].some(p => url.pathname.startsWith(p))) throw Error('LOCAL_REQUEST_ONLY');
    return fetcher(input, { ...options, redirect: 'error', signal: options.signal ?? AbortSignal.timeout(15000) });
  };
}
export function requireGraphqlData(response, body, field) {
  if (response.status !== 200 || !body || body.errors?.length || !body.data || !Object.hasOwn(body.data, field)) throw Error('LOCAL_GRAPHQL_POSITIVE_REQUIRED');
  return body.data[field];
}
export function requirePrivacyDenial(result) {
  if (result.error?.code !== '42501') throw Error('LOCAL_PERMISSION_DENIAL_REQUIRED');
}
export async function integration() {
  verifyRelease();
  phase = 'reviewed-local-graphql';
  await prepareLocalGraphql();
  const status = localStatus();
  const fetcher = localFetch();
  const client = key => createClient(API, key, { global: { fetch: fetcher }, auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  const admin = client(status.SERVICE_ROLE_KEY);
  const anon = client(status.ANON_KEY);
  const password = randomBytes(32).toString('base64url'); // ephemeral synthetic password; never persisted
  let checks = 0;
  const ok = condition => { assert.ok(condition); checks++; };
  const passed = () => console.log(`LOCAL_INTEGRATION_STAGE_PASS phase=${phase} checks=${checks}`);
  // Refuse an existing application schema. Never reset or reuse other local data.
  ok(sql("SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p');") === '0');
  const users = [];
  const clients = [];
  const emails = ['admin', 'member', 'other', 'new', 'admin5', 'fake6', 'fake7', 'synthetic'].map(s => `${s}@example.invalid`);
  phase = 'fake-auth';
  for (let i = 0; i < emails.length; i++) {
    const c = client(status.ANON_KEY);
    const result = i === 3
      ? await c.auth.signUp({ email: emails[i], password })
      : await admin.auth.admin.createUser({ email: emails[i], password, email_confirm: true, app_metadata: { provider: 'github', providers: ['github'] } });
    ok(!result.error && !!result.data.user?.id);
    ok(/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(result.data.user.id));
    users.push(result.data.user.id);
    // Model verified GitHub provider identity for SQL tests; NOT an OAuth round trip.
    const updated = await admin.auth.admin.updateUserById(users[i], { app_metadata: { provider: 'github', providers: ['github'] } });
    ok(!updated.error);
    ok(!(await c.auth.signInWithPassword({ email: emails[i], password })).error);
    clients.push(c);
  }
  ok((await clients[1].auth.getUser()).data.user?.id === users[1]);
  ok((await clients[2].auth.getUser()).data.user?.id === users[2]);
  ok(users[1] !== users[2]);
  passed();
  phase = 'fake-schema';
  const fixture = readFileSync(new URL('../tests/fixtures/privacy.sql', import.meta.url), 'utf8');
  const schema = fixture.slice(fixture.indexOf('CREATE TABLE public.supervisor_id'), fixture.indexOf('INSERT INTO auth.users'));
  let seed = fixture.slice(fixture.indexOf('INSERT INTO public.supervisor_id'));
  for (let i = 0; i < users.length; i++) seed = seed.replaceAll(`00000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`, users[i]);
  sql(schema + seed);
  sql('COMMENT ON SCHEMA public IS \'@graphql({"inflect_names": true, "introspection": true})\';');
  async function graphql(c, query) {
    const token = (await c.auth.getSession()).data.session?.access_token ?? status.ANON_KEY;
    const response = await fetcher(`${API}/graphql/v1`, { method: 'POST', headers: { apikey: status.ANON_KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ query }) });
    return { response, body: await response.json() };
  }
  // Establish that this exact GraphQL field works before protection. An invalid
  // field name or dead endpoint must never masquerade as a privacy denial.
  const privateQuery = '{ registeredMemberCollection { edges { node { email } } } }';
  phase = 'graphql-before-protection';
  const baselineGraphql = await graphql(clients[1], privateQuery);
  const baselineMembers = requireGraphqlData(baselineGraphql.response, baselineGraphql.body, 'registeredMemberCollection');
  ok(baselineMembers.edges.some(edge => edge.node.email === emails[2]));
  passed();
  // Bind approvals to this synthetic catalog only. No operational seal is imported.
  const fingerprint = sql('BEGIN READ ONLY; SET LOCAL search_path=pg_catalog;\n' + reviewedSql('010-catalog-fingerprint.sql') + '\nROLLBACK;');
  ok(/^[a-f0-9]{64}$/.test(fingerprint));
  // Fake local metadata only. Do not emit function sources, keys or policy text.
  const metadata = JSON.parse(sql("SELECT json_build_object('postgres_version',current_setting('server_version'),'pg_graphql_version',(SELECT extversion FROM pg_extension WHERE extname='pg_graphql'),'wrapper_language',(SELECT l.lanname FROM pg_proc p JOIN pg_language l ON l.oid=p.prolang WHERE p.oid=to_regprocedure('graphql_public.graphql(text,text,jsonb,jsonb)')),'wrapper_definer',(SELECT prosecdef FROM pg_proc WHERE oid=to_regprocedure('graphql_public.graphql(text,text,jsonb,jsonb)')),'wrapper_source_hash',(SELECT encode(sha256(convert_to(regexp_replace(prosrc,'\\s','','g'),'UTF8')),'hex') FROM pg_proc WHERE oid=to_regprocedure('graphql_public.graphql(text,text,jsonb,jsonb)')));"));
  console.log('LOCAL_FAKE_STACK_METADATA ' + JSON.stringify(metadata));
  const approval = `SET oaz.approve_privacy_v3='yes'; SET oaz.privacy_surface_review_approved='yes'; SET oaz.privacy_exposed_schemas='["public","graphql_public"]'; SET oaz.privacy_extra_search_path='["public","extensions"]'; SET oaz.privacy_auto_expose_new_tables='on'; SET oaz.privacy_expected_catalog_sha256='${fingerprint}';`;
  phase = 'sql-preflight';
  sql(approval + reviewedSql('010-preflight.sql'));
  phase = 'sql-apply-local-only';
  sql(approval + reviewedSql('010-privacy-minimal.sql'));
  phase = 'sql-postcheck';
  ok(sql(reviewedSql('010-postcheck.sql')).includes('P0_V3_POSTCHECK_PASS_METADATA_ONLY'));
  passed();
  sql("NOTIFY pgrst, 'reload schema';");
  // The catalog notification is local-only. Wait for PostgREST's asynchronous schema reload.
  phase = 'rpc-schema-ready';
  let ready = false;
  for (let attempt = 0; attempt < 30; attempt++) {
    const r = await clients[1].rpc('oaz_member_self_v3');
    if (!r.error) { ready = true; break; }
    if (r.error.code !== 'PGRST202') throw Error('LOCAL_RPC_FAILED');
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  ok(ready);
  phase = 'rest-privacy-and-signup';
  const own = await clients[1].from('registered_member').select('uuid').eq('uuid', users[1]);
  ok(!own.error && own.data.length === 1);
  for (const c of [anon, clients[1], clients[2]]) {
    for (const table of ['registered_member', 'allowed_user', 'supervisor_id']) {
      const r = await c.from(table).select('email');
      requirePrivacyDenial(r); checks++;
    }
  }
  const b = await clients[1].from('registered_member').select('uuid').eq('uuid', users[2]);
  ok(!b.error && b.data.length === 0);
  const boss = await clients[1].from('who_is_boss').select('uuid');
  requirePrivacyDenial(boss); checks++;
  // Auth user_metadata is user-controlled and must never grant editor access.
  ok(!(await clients[1].auth.updateUser({ data: { role: 'admin', is_manager: true } })).error);
  requirePrivacyDenial(await clients[1].rpc('oaz_privacy_editor_list_v3', { board: 'registered_member' })); checks++;
  requirePrivacyDenial(await clients[3].from('registered_member').insert({ uuid: users[3], email: emails[3], name: 'fake escalation', is_manager: true })); checks++;
  const approved = await clients[3].from('registered_member').insert({ uuid: users[3], email: emails[3], name: 'fake new', is_manager: false });
  ok(!approved.error);
  const unapproved = await clients[7].from('registered_member').insert({ uuid: users[7], email: emails[7], name: 'fake unapproved' });
  requirePrivacyDenial(unapproved); checks++;
  requirePrivacyDenial(await clients[1].rpc('oaz_privacy_editor_list_v3', { board: 'allowed_user' })); checks++;
  sql(`INSERT INTO oaz_privacy_v3.capabilities VALUES('${users[0]}','members.read','LEGACY',NULL);`);
  const directory = await clients[0].rpc('oaz_privacy_editor_list_v3', { board: 'registered_member' });
  ok(!directory.error && directory.data.rows.length === 3);
  const donors = await anon.from('editor_5_donators').select('id,name');
  ok(!donors.error && donors.data.length === 1);
  requirePrivacyDenial(await anon.from('editor_5_donators').select('uuid')); checks++;
  passed();
  phase = 'graphql-after-protection';
  for (const c of [anon, clients[1]]) {
    const positive = await graphql(c, '{ editor5DonatorsCollection { edges { node { id name } } } }');
    ok(requireGraphqlData(positive.response, positive.body, 'editor5DonatorsCollection').edges.length === 1);
    const { response, body } = await graphql(c, privateQuery);
    ok(response.status === 200 && Array.isArray(body.errors) && body.errors.length > 0 && body.data == null);
  }
  passed();
  // Exercise real private Storage transport and owner isolation with disposable fake content.
  phase = 'private-storage';
  const bucket = 'privacy-fake-private';
  ok(!(await admin.storage.createBucket(bucket, { public: false })).error);
  sql("CREATE POLICY local_fake_storage ON storage.objects FOR ALL TO authenticated USING(bucket_id='privacy-fake-private' AND (storage.foldername(name))[1]=auth.uid()::text) WITH CHECK(bucket_id='privacy-fake-private' AND (storage.foldername(name))[1]=auth.uid()::text);");
  const object = `${users[1]}/fake.txt`;
  ok(!(await clients[1].storage.from(bucket).upload(object, new Blob(['synthetic fixture']), { contentType: 'text/plain' })).error);
  const downloaded = await clients[1].storage.from(bucket).download(object);
  ok(!downloaded.error && await downloaded.data.text() === 'synthetic fixture');
  ok(!!(await clients[2].storage.from(bucket).download(object)).error);
  ok(!!(await anon.storage.from(bucket).download(object)).error);
  passed();
  phase = 'expired-session';
  const session = (await clients[1].auth.getSession()).data.session;
  // Create a correctly signed but expired synthetic JWT in RAM only. This is
  // the verified disposable stack's signing secret, never an operational key.
  const [header, payload] = session.access_token.split('.');
  ok(JSON.parse(Buffer.from(header, 'base64url')).alg === 'HS256' && !!status.JWT_SECRET);
  const claims = JSON.parse(Buffer.from(payload, 'base64url'));
  const expiredPayload = Buffer.from(JSON.stringify({ ...claims, iat: 1, exp: 2 })).toString('base64url');
  const unsigned = `${header}.${expiredPayload}`;
  const expired = `${unsigned}.${createHmac('sha256', status.JWT_SECRET).update(unsigned).digest('base64url')}`;
  const expiredResponse = await fetcher(`${API}/rest/v1/rpc/oaz_member_self_v3`, { method: 'POST', headers: { apikey: status.ANON_KEY, Authorization: `Bearer ${expired}`, 'Content-Type': 'application/json' }, body: '{}' });
  ok(expiredResponse.status === 401);
  passed();
  phase = 'signout';
  for (const c of clients) {
    ok(!(await c.auth.signOut()).error);
    ok((await c.auth.getSession()).data.session === null);
  }
  const revokedRefresh = await client(status.ANON_KEY).auth.refreshSession({ refresh_token: session.refresh_token });
  ok(!!revokedRefresh.error && revokedRefresh.data.session === null);
  passed();
  console.log(`LOCAL_SUPABASE_INTEGRATION_PASS checks=${checks}`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  integration().catch(error => { const guard = /^LOCAL_[A-Z0-9_]+$/.test(error.message) || /^LOCAL_SQL_GUARD_[a-f0-9]{12}$/.test(error.message) ? ` guard=${error.message}` : ''; const detail = phase === 'reviewed-local-graphql' ? ` preparation=${graphqlPreparationPhase()}` : ''; console.error(`LOCAL_SUPABASE_INTEGRATION_STOP phase=${phase}${detail}${guard}`); process.exitCode = 1; });
}
