import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { checkPreviewEnvironment } from '../scripts/check-preview-env.mjs';
import { inspectSource, checkRelease } from '../scripts/check-hotfix-security.mjs';
import { loadSource, domTest, deferred, Image } from './helpers/react-dom.mjs';

const fakeRef = 'abcdefghijklmnopqrst';
const preview = { VERCEL_ENV: 'preview', VERCEL_GIT_COMMIT_REF: 'hotfix/privacy-p0',
  OAZ_PREVIEW_ISOLATED_REF: fakeRef, NEXT_PUBLIC_SUPABASE_URL: `https://${fakeRef}.supabase.co`,
  NEXT_PUBLIC_SUPABASE_KEY: 'sb_publishable_synthetic_fixture_only',
  NEXT_PUBLIC_OAZ_OAUTH_TEST_ORIGIN: 'https://fixture-preview.vercel.app', VERCEL_BRANCH_URL: 'fixture-preview.vercel.app' };
test('Preview requires an isolated target and exact callback; a PASS is not remote proof', () => {
  assert.match(checkPreviewEnvironment(preview), /REMOTE_ISOLATION_UNVERIFIED$/);
  for (const change of [
    { OAZ_PREVIEW_ISOLATED_REF: undefined }, { OAZ_PREVIEW_ISOLATED_REF: 'maoefmwpdcnugyenyiea' },
    { NEXT_PUBLIC_SUPABASE_URL: 'https://maoefmwpdcnugyenyiea.supabase.co' },
    { NEXT_PUBLIC_SUPABASE_URL: `https://${fakeRef}.supabase.co@evil.invalid` },
    { VERCEL_GIT_COMMIT_REF: 'main' }, { NEXT_PUBLIC_SUPABASE_KEY: 'sb_secret_' + 'fixture'.repeat(6) },
    { NEXT_PUBLIC_OAZ_OAUTH_TEST_ORIGIN: 'https://www.oazkorea.co.kr' },
    { NEXT_PUBLIC_OAZ_OAUTH_TEST_ORIGIN: 'https://*.vercel.app' },
    { NEXT_PUBLIC_OAZ_OAUTH_TEST_ORIGIN: 'https://attacker.invalid' },
    { NEXT_PUBLIC_OAZ_OAUTH_TEST_ORIGIN: undefined },
  ]) assert.throws(() => checkPreviewEnvironment({ ...preview, ...change }), /^Error: PREVIEW_STOP:[A-Z_]+$/);
  assert.throws(() => checkPreviewEnvironment({ ...preview, VERCEL_ENV: 'production' }), /TEST_CALLBACK/);
  assert.equal(checkPreviewEnvironment({ VERCEL_ENV: 'production' }), 'PRODUCTION_CALLBACK_DEFAULT');
});

test('Public credential guard rejects privileged keys without disclosing them', () => {
  const { assertPublicCredential } = loadSource('src/lib/privacy/public-key.ts', {}, { atob });
  const token = role => ['eyJhbGciOiJIUzI1NiJ9', Buffer.from(JSON.stringify({ role })).toString('base64url'), 'synthetic'].join('.');
  assert.doesNotThrow(() => assertPublicCredential(token('anon')));
  for (const key of ['sb_secret_' + 'fixture'.repeat(6), token('service_role'), token('authenticated'), 'eyJinvalid']) {
    assert.throws(() => assertPublicCredential(key), e => !e.message.includes(key));
  }
});

test('CI has read-only permissions, full gates, fake configuration and no waiver', () => {
  const require = createRequire(import.meta.url);
  const workflow = require('js-yaml').load(readFileSync('.github/workflows/privacy-hotfix.yml', 'utf8'));
  assert.deepEqual(workflow.permissions, { contents: 'read' });
  const job = workflow.jobs.validate;
  assert.equal(job.env.NEXT_PUBLIC_SUPABASE_URL, 'https://offline.invalid');
  assert.equal(job.steps.find(s => s.uses?.startsWith('actions/checkout')).with['persist-credentials'], false);
  assert.equal(job.steps.find(s => s.uses?.startsWith('actions/setup-node')).with['node-version'], '24');
  const commands = job.steps.filter(s => s.run).map(s => s.run);
  for (const command of ['npm ci --ignore-scripts', 'npm run lint', 'npm run typecheck', 'npm test',
    'npm run check:security', 'npm run test:preview', 'npm run test:runtime', 'npm run build:offline', 'npm run build:offline -- --privacy-v3', 'git diff --check']) assert.ok(commands.includes(command));
  assert.ok(job.steps.every(s => !s['continue-on-error']));
  assert.doesNotMatch(JSON.stringify(workflow), /secrets\.|pull_request_target|write-all|--prod/);
});

test('SQL checkout preserves reviewed release bytes on Windows and Linux', () => {
  const path = 'reports/main-safety/integration/sql/010-privacy-minimal.sql';
  assert.match(execFileSync('git', ['check-attr', 'text', '--', path], { encoding: 'utf8' }), /text: unset/);
  const whitespace = execFileSync('git', ['check-attr', 'whitespace', '--', path], { encoding: 'utf8' });
  for (const rule of ['blank-at-eol', 'blank-at-eof', 'space-before-tab', 'cr-at-eol']) assert.ok(whitespace.includes(rule));
  assert.doesNotMatch(readFileSync(path, 'utf8').replaceAll('\r\n', '\n'), /[ \t]+\n/);
});

test('Security scanner detects credentials/private artifacts and reports codes only', () => {
  assert.deepEqual(inspectSource('seal.json', '{}'), ['PRIVATE_ARTIFACT']);
  assert.deepEqual(inspectSource('src/bad.ts', 'sb_secret_' + 'fixture'.repeat(6)), ['SECRET_TOKEN']);
  assert.deepEqual(inspectSource('src/bad.ts', 'postgresql:' + '//fake:synthetic@localhost/db'), ['PASSWORD_URI']);
  assert.equal(checkRelease().failures.length, 0);
});

const fakeUser = { id: '00000000-0000-4000-8000-000000000101', email: 'a@example.invalid',
  aud: 'authenticated', role: 'authenticated', email_confirmed_at: '2026-01-01T00:00:00Z',
  identities: [{ provider: 'github' }], app_metadata: { provider: 'github' }, user_metadata: {} };
function sdkFixture({ approved = true, expired = false } = {}) {
  const calls = [];
  const token = ['eyJhbGciOiJIUzI1NiJ9', Buffer.from(JSON.stringify({ sub: fakeUser.id, exp: 4102444800 })).toString('base64url'), 'fixture'].join('.');
  const client = createClient('https://auth-fixture.invalid', 'sb_publishable_fixture', {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: async (input, options = {}) => {
      const url = new URL(input); assert.equal(url.origin, 'https://auth-fixture.invalid');
      calls.push({ path: url.pathname, query: url.searchParams, body: options.body });
      if (url.pathname === '/auth/v1/token') return Response.json({ access_token: token, token_type: 'bearer', refresh_token: 'synthetic', expires_in: 3600, user: fakeUser });
      if (url.pathname === '/auth/v1/user') return expired ? Response.json({ msg: 'synthetic private diagnostic' }, { status: 401 }) : Response.json(fakeUser);
      if (url.pathname === '/auth/v1/logout') return new Response(null, { status: 204 });
      if (url.pathname === '/rest/v1/registered_member') {
        if (options.method === 'POST') return approved ? new Response(null, { status: 201 }) : Response.json({ code: '42501', message: 'private policy detail' }, { status: 403 });
        assert.equal(url.searchParams.get('select'), 'uuid');
        assert.equal(url.searchParams.get('uuid'), `eq.${fakeUser.id}`);
        return Response.json([]);
      }
      throw Error('Unexpected SDK fixture request');
    } },
  });
  return { client, calls };
}
test('Installed Supabase SDK builds GitHub implicit authorization URL with exact callback', async () => {
  const f = sdkFixture();
  const { data, error } = await f.client.auth.signInWithOAuth({ provider: 'github', options: {
    redirectTo: 'https://fixture-preview.vercel.app/login_callback', skipBrowserRedirect: true,
  } });
  assert.equal(error, null); const url = new URL(data.url);
  assert.equal(url.origin, 'https://auth-fixture.invalid'); assert.equal(url.pathname, '/auth/v1/authorize');
  assert.equal(url.searchParams.get('provider'), 'github');
  assert.equal(url.searchParams.get('redirect_to'), 'https://fixture-preview.vercel.app/login_callback');
  assert.equal(url.searchParams.has('code_challenge'), false); // Production SDK default is implicit; no PKCE migration.
  assert.equal(f.calls.length, 0);
});
for (const approved of [true, false]) test(`Actual SDK + synthetic Auth/REST transport: registration approved=${approved}`, async () => {
  const f = sdkFixture({ approved });
  await f.client.auth.signInWithPassword({ email: fakeUser.email, password: 'synthetic-not-a-real-password' });
  const { completeRegistration } = loadSource('src/lib/registration.ts');
  const result = await completeRegistration(f.client, () => JSON.stringify({ name: 'Fixture A', department: 'Test', studentId: '000', generation: '0', phone_number: '000' }));
  assert.equal(result.status, approved ? 'registered' : 'error');
  assert.doesNotMatch(JSON.stringify(result), /private policy|example.invalid/);
  const write = JSON.parse(f.calls.find(c => c.path === '/rest/v1/registered_member' && c.body).body);
  assert.equal(write.uuid, fakeUser.id); assert.equal(write.is_manager, false);
  await f.client.auth.signOut(); assert.equal((await f.client.auth.getSession()).data.session, null);
});
test('Actual SDK with expired synthetic Auth response cannot insert registration', async () => {
  const f = sdkFixture({ expired: true });
  await f.client.auth.signInWithPassword({ email: fakeUser.email, password: 'synthetic' });
  const { completeRegistration } = loadSource('src/lib/registration.ts');
  const result = await completeRegistration(f.client, () => '{}');
  assert.equal(result.status, 'error'); assert.ok(f.calls.every(c => !c.path.startsWith('/rest/')));
});

for (const file of ['src/app/login_callback/page.tsx', 'src/app/oauth_callback/page.tsx']) {
  test(`${file}: provider error cannot reuse an old session or expose callback text`, () => domTest(async ({ window, render, container }) => {
    window.history.replaceState(null, '', '/?error=access_denied&error_description=private-fixture');
    const component = loadSource(file, {
      '@/lib/supabaseClient': { supabase: { auth: { getUser() { throw Error('Must not use cached identity after OAuth error'); } } } },
      'next/navigation': { useRouter: () => ({ push() { throw Error('Unexpected success'); } }) },
      'next/link': ({ children }) => children,
    }, { URLSearchParams }).default;
    await render(component); assert.doesNotMatch(container.textContent, /private-fixture/);
    assert.match(container.textContent, /인증이 완료되지|등록되지 않은/);
  }));
}
test('Login callback checks only verified own UUID and ignores completion after unmount', () => domTest(async ({ render, unmount }) => {
  const pending = deferred(); const pushes = []; const router = { push: x => pushes.push(x) };
  const component = loadSource('src/app/login_callback/page.tsx', {
    '@/lib/supabaseClient': { supabase: { auth: { getUser: async () => ({ data: { user: fakeUser }, error: null }) },
      from(table) { assert.equal(table, 'registered_member'); return { select(c) { assert.equal(c, 'uuid'); return { eq(c,v) {
        assert.equal(c,'uuid'); assert.equal(v,fakeUser.id); return { maybeSingle: () => pending.promise };
      } }; } }; } } }, 'next/navigation': { useRouter: () => router },
  }).default;
  await render(component, {}, false); await unmount(); pending.resolve({ data: { uuid: fakeUser.id }, error: null });
  await pending.promise; assert.deepEqual(pushes, []);
}));

test('Editor cannot regain access from stale administrator response after sign-out', () => domTest(async ({ React, act, render, container, window }) => {
  const old = deferred(); let event; let user = fakeUser;
  const router = { replace() {} }; window.alert = () => {};
  const Empty = () => null; const mocks = {
    'next/navigation': { useRouter: () => router },
    '@/lib/supabaseClient': { supabase: { auth: {
      getUser: async () => ({ data: { user }, error: null }),
      onAuthStateChange(fn) { event = fn; return { data: { subscription: { unsubscribe() {} } } }; },
    }, from(table) { assert.equal(table, 'supervisor_id'); return { select(c) { assert.equal(c,'uuid'); return { eq: () => ({ maybeSingle: () => old.promise }) }; } }; } } },
    './EditorLayout': { EditorLayout: ({ children }) => React.createElement('div', { 'data-editor': true }, children) },
    './components/BoardTabs': { BoardTabs: Empty }, './components/PostList': { PostList: Empty }, './components/PrivacyBoard': { PrivacyBoard: Empty },
    './hooks/useBoardPosts': { useBoardPosts: () => ({ posts: [], setPosts() {}, reload() {}, loading: false }) },
  };
  for (const [path, name] of [['0_notice','Notice'],['1_project','Project'],['2_study','Study'],['3_timetable','Timetable'],['5_schedule','Schedule'],['6_event','Event']]) mocks[`./boards/${path}/${name}Form`] = { [`${name}Form`]: Empty };
  const component = loadSource('src/app/editor/page.tsx', mocks).default;
  await render(component, {}, false);
  await act(async () => { user = null; event('SIGNED_OUT', null); old.resolve({ data: { uuid: fakeUser.id }, error: null }); await new Promise(resolve => setTimeout(resolve, 10)); });
  assert.equal(container.querySelector('[data-editor]'), null);
}));

test('Storage image source changes synchronously and invalid boards do not retain previous URLs', () => domTest(async ({ render, container }) => {
  const { ImageFromStorage } = loadSource('src/app/editor/components/ImageFromStorage.tsx', {
    'next/image': Image, '../services/storage.service': { getPublicImageUrl: (bucket, file) => `https://fixture.invalid/${bucket}/${file}` },
  });
  await render(ImageFromStorage, { board: '프로젝트', filename: 'one.png' }); assert.match(container.querySelector('img').src, /project_img\/one.png$/);
  await render(ImageFromStorage, { board: '스터디', filename: 'two.png' }); assert.match(container.querySelector('img').src, /study-images\/two.png$/);
  await render(ImageFromStorage, { board: 'unknown', filename: 'two.png' }); assert.equal(container.querySelector('img'), null);
}));

test('Notice create failure preserves input, unlocks submit and never leaks diagnostics', () => domTest(async ({ act, render, container, window }) => {
  const pending = deferred(); let writes = 0;
  const { NoticeForm } = loadSource('src/app/editor/boards/0_notice/NoticeForm.tsx', {
    '../../services/board.service': { fetchPosts: async () => [{ id: 1, text: 'Fixture notice', description: 'Safe', is_noti: true }], insertPost() { writes++; return pending.promise; } },
    '../../services/order.service': { persistOrder: async () => {} },
  });
  await render(NoticeForm); assert.match(container.textContent, /Fixture notice/);
  const form = container.querySelector('form');
  await act(async () => { form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })); form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })); });
  assert.equal(writes, 1);
  await act(async () => pending.reject(Error('private diagnostic')));
  assert.match(container.querySelector('[role=alert]').textContent, /저장하지 못/);
  assert.doesNotMatch(container.textContent, /private diagnostic/);
  assert.equal(container.querySelector('button[disabled]'), null);
}));

test('Board change discards an older asynchronous content response', () => domTest(async ({ React, act, render, container }) => {
  const pending = deferred();
  const { useBoardPosts } = loadSource('src/app/editor/hooks/useBoardPosts.ts', {
    '../services/board.service': { fetchPosts: table => table === 'editor_1_projects' ? pending.promise : Promise.resolve([{ id: 2, name: 'Current study' }]) },
  });
  function View({ board }) { const { posts } = useBoardPosts(board); return React.createElement('p', null, posts.map(p => p.name).join(',')); }
  await render(View, { board: '프로젝트' }, false);
  await render(View, { board: '스터디' }, false);
  await act(async () => pending.resolve([{ id: 1, name: 'Stale project' }]));
  assert.equal(container.textContent, 'Current study');
}));

test('Project archive preserves latest semester, public projection and modal input', () => domTest(async ({ React, render, container }) => {
  const rows = [
    { id: 1, project_name: 'Older', year: 2025, semester: 2, filename: 'old.png' },
    { id: 2, project_name: 'Current', year: 2026, semester: 1, filename: 'current.png', tech_stack: '["TypeScript"]' },
  ];
  let selection;
  const component = loadSource('src/app/projects/archives/page.tsx', {
    '@/lib/supabaseClient': { supabase: {
      from(table) { assert.equal(table, 'editor_1_projects'); return { select(fields) { selection = fields; return { order: async () => ({ data: rows, error: null }) }; } }; },
      storage: { from: () => ({ getPublicUrl: file => ({ data: { publicUrl: `https://fixture.invalid/${file}` } }) }) },
    } },
    '../../../components/projects/ProjectGrid': ({ Projects: projects }) => React.createElement('p', null, projects.map(p => `${p.title}:${p.tech_stack.join(',')}`).join('|')),
    '../../../components/projects/ProjectModal': () => null,
  }).default;
  await render(component); assert.match(container.textContent, /Current:TypeScript/); assert.doesNotMatch(container.textContent, /Older/);
  assert.ok(selection.includes('project_name')); assert.ok(!selection.includes('*'));
}));

test('Study archive keeps latest semester and public storage image contract', () => domTest(async ({ render, container }) => {
  const component = loadSource('src/components/home/features/StudyArchiveGrid.tsx', {
    'next/image': Image,
    '@/lib/supabaseClient': { supabase: {
      from(table) { assert.equal(table, 'editor_2_studies'); return { select: () => ({ order: async () => ({ data: [
        { id: 1, study_name: 'Old fixture', year: 2025, semester: 2 },
        { id: 2, study_name: 'Latest fixture', year: 2026, semester: 1, filename: 'study.png' },
      ], error: null }) }) }; },
      storage: { from(bucket) { assert.equal(bucket, 'study-images'); return { getPublicUrl: file => ({ data: { publicUrl: `https://fixture.invalid/${file}` } }) }; } },
    } },
  }).default;
  await render(component); assert.match(container.textContent, /Latest fixture/); assert.doesNotMatch(container.textContent, /Old fixture/);
}));

test('Public donor query stays id/name and failure never displays DB diagnostic', () => domTest(async ({ render, container }) => {
  const component = loadSource('src/components/home/features/Donators.tsx', {
    '@/lib/supabaseClient': { supabase: { from(table) {
      assert.equal(table, 'editor_5_donators'); return { select(columns) {
        assert.equal(columns.replaceAll(' ', ''), 'id,name'); return { order: async () => ({ data: null, error: { message: 'private diagnostic' } }) };
      } };
    } } },
  }).default;
  await render(component); assert.doesNotMatch(container.textContent, /private diagnostic/);
  assert.match(container.textContent, /불러오지 못/);
}));
