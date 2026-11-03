import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createClient } from '@supabase/supabase-js';
import { API, NETWORK, PROJECT, commandDiagnostic, containerDiagnostics, assertLocalUrl, assertDockerEndpoint, verifyNetwork, verifyBindings, verifyRelease, safeCommandFailure } from '../scripts/local-supabase.mjs';
import { localFetch, requireGraphqlData, requirePrivacyDenial } from '../scripts/test-local-supabase.mjs';
import { assertNoEnvironmentFiles, localDevelopmentEnvironment } from '../scripts/local-dev.mjs';
import { unpackReviewedGraphql, validateContainerPgPath, GRAPHQL_ASSET, GRAPHQL_SHA } from '../scripts/prepare-local-graphql.mjs';

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
test('SQL guard diagnostics preserve failure without printing stderr or policy text', () => {
  const result = safeCommandFailure('ERROR: P0_STOP: fake guard failure\nCONTEXT: fake private policy and credentials');
  assert.match(result, /^LOCAL_SQL_GUARD_[a-f0-9]{12}$/);
  assert.doesNotMatch(result, /fake|private|credentials|P0_STOP/);
  assert.equal(safeCommandFailure('password rejected: fake-private'), 'LOCAL_STACK_COMMAND_FAILED');
});
test('Fresh-install lock retains chalk dependencies and integrity metadata', () => {
  const lock = JSON.parse(readFileSync('package-lock.json', 'utf8'));
  const chalk = lock.packages['node_modules/chalk'];
  assert.ok(chalk.dependencies['ansi-styles']);
  assert.ok(chalk.dependencies['supports-color']);
  for (const name of ['chalk', 'ansi-styles', 'supports-color', 'color-convert', 'color-name', 'has-flag']) {
    const entry = lock.packages[`node_modules/${name}`];
    assert.match(entry.resolved, /^https:\/\/registry\.npmjs\.org\//);
    assert.match(entry.integrity, /^sha512-/);
  }
});
test('Local GraphQL provisioning cannot accept an untrusted artifact or target path', () => {
  assert.equal(new URL(GRAPHQL_ASSET).hostname, 'github.com');
  assert.match(GRAPHQL_ASSET, /supabase\/pg_graphql\/releases\/download\/v1\.6\.3\/.*pg17-amd64-linux-gnu\.deb$/);
  assert.equal(GRAPHQL_SHA, 'e827939c60bd1e0b861bf30206d04a274e354b1f8942d36fe4b7cd8889f4dc84');
  assert.throws(() => unpackReviewedGraphql(Buffer.from('fake untrusted package')), /INTEGRITY/);
  for (const value of ['/etc', '/usr/../etc', '/usr/lib;echo fake', 'https://remote.invalid/lib', 'C:/backups']) assert.throws(() => validateContainerPgPath(value));
  assert.equal(validateContainerPgPath('/usr/lib/postgresql/17/lib'), '/usr/lib/postgresql/17/lib');
  assert.equal(validateContainerPgPath('/nix/store/' + 'a'.repeat(32) + '-postgresql-17.6/lib'), '/nix/store/' + 'a'.repeat(32) + '-postgresql-17.6/lib');
  assert.equal(validateContainerPgPath('/nix/store/' + 'b'.repeat(32) + '-postgresql-and-plugins-17.6/share/postgresql'), '/nix/store/' + 'b'.repeat(32) + '-postgresql-and-plugins-17.6/share/postgresql');
  for (const value of ['/nix/store/invalid/lib', '/nix/store/' + 'a'.repeat(32) + '-postgresql/../../etc', '/usr/lib/..', '/nix/var/nix/profiles/default/lib']) assert.throws(() => validateContainerPgPath(value));
});
test('Extension failure classification emits fixed safe categories only', () => {
  assert.equal(safeCommandFailure('could not load library: fake-sensitive-path'), 'LOCAL_EXTENSION_ABI');
  assert.equal(safeCommandFailure('permission denied for fake-sensitive-object'), 'LOCAL_SQL_PERMISSION');
  assert.equal(safeCommandFailure('dependent objects still exist: fake-sensitive-object'), 'LOCAL_EXTENSION_DEPENDENCY');
  assert.equal(safeCommandFailure(null), 'LOCAL_STACK_COMMAND_FAILED');
});

test('Diagnostics expose only allowlisted command, exit, timing and failure fields', () => {
  const secret = 'fake-private-never-emit';
  const result = commandDiagnostic('supabase', ['status', '-o', 'json', secret], {
    status: 1, stderr: `container is not ready: starting\n${secret}`, stdout: secret,
  }, 123);
  assert.deepEqual(result, { command: 'cli.status', exitCode: 1, timeout: false, type: 'health_starting', guard: 'LOCAL_STACK_COMMAND_FAILED', elapsedMs: 123 });
  assert.ok(!JSON.stringify(result).includes(secret));
  assert.equal(commandDiagnostic('docker', ['inspect', secret], { status: null, error: { code: 'ETIMEDOUT', message: secret } }, 12).type, 'timeout');
  assert.equal(commandDiagnostic('docker', ['inspect'], { error: { code: 'ENOENT' } }, 1).type, 'executable_missing');
  assert.equal(commandDiagnostic('docker', ['exec', secret, 'psql'], { status: 2, stderr: secret }, 1).command, 'docker.exec.psql');
});

test('Container diagnostic cannot leak environment, logs, arbitrary names or images', () => {
  const secret = 'fake-private-never-emit';
  const states = containerDiagnostics([{ Name: `/supabase_db_${PROJECT}`, Config: { Image: 'public.ecr.aws/supabase/postgres:17.6.1.029', Env: [secret] },
    State: { Status: 'running', Health: { Status: 'starting', Log: [{ Output: secret }] }, OOMKilled: false }, RestartCount: 0,
    NetworkSettings: { Networks: { [NETWORK]: {} } } }, { Name: secret, Config: { Image: secret } }]);
  assert.equal(states[0].health, 'starting');
  assert.equal(states[0].imageVersion, '17.6.1.029');
  assert.equal(states[1].state, 'missing');
  assert.ok(!JSON.stringify(states).includes(secret));
});
