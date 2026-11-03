import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createClient } from '@supabase/supabase-js';
import { API, NETWORK, assertLocalUrl, assertDockerEndpoint, verifyNetwork, verifyBindings, verifyRelease } from '../scripts/local-supabase.mjs';
import { localFetch, requireGraphqlData, requirePrivacyDenial } from '../scripts/test-local-supabase.mjs';
import { assertNoEnvironmentFiles, localDevelopmentEnvironment } from '../scripts/local-dev.mjs';

test('Local test refuses remote, disguised and alternate-port endpoints', () => {
  assert.doesNotThrow(() => assertLocalUrl(API));
  for (const value of ['https://maoefmwpdcnugyenyiea.supabase.co', 'https://ctbwaqtqubmjmltbxfzm.supabase.co',
    'http://127.0.0.1:54321', `${API}@evil.invalid`, `${API}/`, 'http://localhost:56321']) assert.throws(() => assertLocalUrl(value));
  for (const endpoint of ['tcp://127.0.0.1:2375', 'ssh://remote', undefined]) assert.throws(() => assertDockerEndpoint(endpoint));
  assert.doesNotThrow(() => assertDockerEndpoint('unix:///var/run/docker.sock'));
  assert.doesNotThrow(() => assertDockerEndpoint('npipe:////./pipe/dockerDesktopLinuxEngine'));
});
test('Local network and every published binding must be loopback', () => {
  const network = { Name: NETWORK, Driver: 'bridge', Options: { 'com.docker.network.bridge.host_binding_ipv4': '127.0.0.1' } };
  assert.doesNotThrow(() => verifyNetwork(network));
  assert.throws(() => verifyNetwork({ ...network, Options: {} }));
  const c = { HostConfig: { NetworkMode: NETWORK }, NetworkSettings: { Networks: { [NETWORK]: {} }, Ports: { '8000/tcp': [{ HostIp: '127.0.0.1', HostPort: '56321' }] } } };
  assert.doesNotThrow(() => verifyBindings([c]));
  assert.throws(() => verifyBindings([]));
  for (const ip of ['0.0.0.0', '::', '192.168.0.2']) assert.throws(() => verifyBindings([{ ...c, NetworkSettings: { ...c.NetworkSettings, Ports: { '8000/tcp': [{ HostIp: ip }] } } }]));
  assert.throws(() => verifyBindings([{ ...c, HostConfig: { NetworkMode: 'host' } }]));
  assert.throws(() => verifyBindings([{ ...c, NetworkSettings: { Networks: {} } }]));
});
test('Actual SDK local transport denies external redirects and foreign endpoints before fetch', async () => {
  let count = 0;
  const fetcher = localFetch(async (input, options) => {
    count++;
    assert.equal(options.redirect, 'error');
    assert.ok(options.signal);
    const path = new URL(input).pathname;
    if (path === '/rest/v1/registered_member') return Response.json({ code: '42501', message: 'fake denial' }, { status: 403 });
    return Response.json({ error: 'invalid_grant', error_description: 'fake rejected credentials' }, { status: 400 });
  });
  for (const value of ['https://example.invalid/auth/v1/token', `${API}/admin/`, 'http://127.0.0.1:54321/auth/v1/token', 'http://fake:fake@127.0.0.1:56321/auth/v1/token']) assert.throws(() => fetcher(value));
  assert.equal(count, 0);
  const c = createClient(API, 'sb_publishable_local_fixture', { global: { fetch: fetcher }, auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  assert.ok((await c.auth.signInWithPassword({ email: 'fake@example.invalid', password: 'synthetic' })).error);
  assert.ok((await c.from('registered_member').select('email')).error);
  assert.equal(count, 2);
});
test('Local stack CI is pinned, synthetic and cannot deploy or consume secrets', () => {
  const yaml = createRequire(import.meta.url)('js-yaml');
  const workflow = yaml.load(readFileSync('.github/workflows/privacy-hotfix.yml', 'utf8'));
  assert.deepEqual(workflow.on.push.branches, ['hotfix/privacy-p0']);
  assert.ok('pull_request' in workflow.on && 'workflow_dispatch' in workflow.on);
  assert.deepEqual(workflow.permissions, { contents: 'read' });
  assert.doesNotMatch(JSON.stringify(workflow), /secrets\.|vars\.|pull_request_target|workflow_run|--prod|vercel deploy/);
  for (const value of Object.values(workflow.jobs)) {
    assert.ok(!value.environment);
    assert.ok(value.steps.every(step => !step['continue-on-error']));
    assert.equal(value.steps.find(step => step.uses?.startsWith('actions/checkout')).with['persist-credentials'], false);
  }
  const job = workflow.jobs['local-supabase'];
  assert.equal(job.steps.find(step => step.uses?.startsWith('actions/checkout')).with.ref, '${{ github.event.pull_request.head.sha || github.sha }}');
  assert.equal(job.steps.find(s => s.uses?.startsWith('supabase/setup-cli')).with.version, '2.54.11');
  assert.equal(job.steps.find(s => s.name === 'Stop only the local test project').if, 'always()');
  assert.ok(job.steps.some(s => s.run === 'npm run test:local-supabase'));
  assert.doesNotMatch(JSON.stringify(job), /secrets\.|--linked|db reset|vercel|upload-artifact/);
  const config = readFileSync('supabase/config.toml', 'utf8');
  assert.match(config, /major_version = 17/);
  assert.doesNotMatch(config, /maoefmwpdcnugyenyiea|ctbwaqtqubmjmltbxfzm|env\(/);
  verifyRelease();
});
test('Vercel disables exactly the hotfix branch and leaves main defaults untouched', () => {
  const config = JSON.parse(readFileSync('vercel.json', 'utf8'));
  assert.deepEqual(config.git.deploymentEnabled, { 'hotfix/privacy-p0': false });
  assert.ok(!('ignoreCommand' in config));
});
test('Local UI gets local public credentials only and rejects env file reinjection', () => {
  const env = localDevelopmentEnvironment({ API_URL: API, ANON_KEY: 'sb_publishable_fake_local', SERVICE_ROLE_KEY: 'fake-admin-do-not-inherit' }, {
    PATH: 'fake-path', NODE_OPTIONS: 'fake-preload', VERCEL_ENV: 'preview', DATABASE_URL: 'fake-remote',
    SUPABASE_SERVICE_ROLE_KEY: 'fake-secret', NEXT_PUBLIC_SUPABASE_URL: 'fake-remote', NEXT_PUBLIC_PROJECT_STORAGE_URL: 'fake-remote',
  });
  assert.equal(env.PATH, 'fake-path');
  assert.equal(env.NEXT_PUBLIC_SUPABASE_URL, API);
  assert.equal(env.VERCEL_ENV, 'development');
  assert.equal(env.NEXT_PUBLIC_OAZ_OAUTH_TEST_ORIGIN, 'http://127.0.0.1:3000');
  for (const name of ['NODE_OPTIONS', 'DATABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'NEXT_PUBLIC_PROJECT_STORAGE_URL']) assert.ok(!(name in env));
  assert.ok(!JSON.stringify(env).includes('fake-admin-do-not-inherit'));
  for (const name of ['.env', '.env.local', '.env.development.local', '.env.production']) assert.throws(() => assertNoEnvironmentFiles([name]));
  assert.doesNotThrow(() => assertNoEnvironmentFiles(['package.json']));
});
test('CI cannot count broken GraphQL or authentication as successful privacy protection', () => {
  const body = { data: { fixtureCollection: { edges: [] } } };
  assert.deepEqual(requireGraphqlData({ status: 200 }, body, 'fixtureCollection'), { edges: [] });
  for (const [status, result] of [[404, body], [401, body], [200, { errors: [{ message: 'fake invalid field' }] }], [200, { data: {} }], [200, { data: body.data, errors: [{}] }]]) {
    assert.throws(() => requireGraphqlData({ status }, result, 'fixtureCollection'));
  }
  assert.doesNotThrow(() => requirePrivacyDenial({ error: { code: '42501' } }));
  for (const code of ['401', 'PGRST202', '42703', undefined]) assert.throws(() => requirePrivacyDenial({ error: { code } }));
});
