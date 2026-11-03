import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { renderOAuthConfig, openOAuthConfig, restoreOAuthConfig, oauthLifecycle, validateOAuthCredentials } from '../scripts/local-oauth-config.mjs';
import { selectOAuthTestUser, reviewedOAuthFixture } from '../scripts/local-oauth.mjs';
import { localDevelopmentEnvironment } from '../scripts/local-dev.mjs';
import { createClient } from '@supabase/supabase-js';
import { loadSource } from './helpers/react-dom.mjs';

const original = readFileSync('supabase/config.toml');
const credentials = () => ({ GITHUB_TEST_CLIENT_ID: 'Iv1SyntheticOnly', GITHUB_TEST_CLIENT_SECRET: 'synthetic'.repeat(5) });
function sandbox() {
  const dir = mkdtempSync(join(tmpdir(), 'oaz-oauth-test-'));
  mkdirSync(join(dir, 'supabase')); writeFileSync(join(dir, 'supabase/config.toml'), original);
  return dir;
}
test('Temporary OAuth config contains env references and exact local URLs, with no credentials', () => {
  const config = renderOAuthConfig(original);
  for (const value of Object.values(credentials())) assert.ok(!config.includes(value));
  assert.match(config, /client_id = "env\(GITHUB_TEST_CLIENT_ID\)"/);
  assert.match(config, /secret = "env\(GITHUB_TEST_CLIENT_SECRET\)"/);
  assert.match(config, /redirect_uri = "http:\/\/127.0.0.1:56321\/auth\/v1\/callback"/);
  assert.match(config, /http:\/\/127.0.0.1:3000\/login_callback/);
  assert.match(config, /http:\/\/127.0.0.1:3000\/oauth_callback/);
  assert.throws(() => renderOAuthConfig(Buffer.from('project_id="unreviewed"')), /BASE_CONFIG_CHANGED/);
});
test('Local OAuth never falls back to Production for localhost or another origin', () => {
  const { privacyOAuthRedirect } = loadSource('src/lib/privacy/oauth.ts', {}, { URL,
    process: { env: { NEXT_PUBLIC_OAZ_OAUTH_TEST_ORIGIN: 'http://127.0.0.1:3000' } } });
  assert.equal(privacyOAuthRedirect('login_callback', 'http://127.0.0.1:3000'), 'http://127.0.0.1:3000/login_callback');
  for (const origin of [undefined, 'http://localhost:3000', 'https://www.oazkorea.co.kr', 'https://example.invalid']) {
    assert.throws(() => privacyOAuthRedirect('login_callback', origin), /LOCAL_OAUTH_ORIGIN_MISMATCH/);
  }
});
test('Installed SDK generates local Auth authorization URL and both exact local app callbacks', async () => {
  const client = createClient('http://127.0.0.1:56321', 'synthetic-local-public', {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  for (const callback of ['login_callback', 'oauth_callback']) {
    const result = await client.auth.signInWithOAuth({ provider: 'github', options: {
      redirectTo: `http://127.0.0.1:3000/${callback}`, skipBrowserRedirect: true } });
    assert.equal(result.error, null);
    const url = new URL(result.data.url);
    assert.equal(url.origin, 'http://127.0.0.1:56321'); assert.equal(url.pathname, '/auth/v1/authorize');
    assert.equal(url.searchParams.get('redirect_to'), `http://127.0.0.1:3000/${callback}`);
  }
});
test('Config lock is exclusive and exact original bytes are restored', () => {
  const dir = sandbox();
  try {
    openOAuthConfig(dir);
    assert.throws(() => openOAuthConfig(dir));
    restoreOAuthConfig(dir); assert.deepEqual(readFileSync(join(dir, 'supabase/config.toml')), original);
    restoreOAuthConfig(dir, true); assert.equal(existsSync(join(dir, 'supabase/.oauth-local')), false);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
test('Cleanup preserves concurrent user config edits rather than overwriting them', () => {
  const dir = sandbox();
  try {
    openOAuthConfig(dir); writeFileSync(join(dir, 'supabase/config.toml'), 'synthetic concurrent edit');
    assert.throws(() => restoreOAuthConfig(dir, true), /CONCURRENT_CHANGE/);
    assert.equal(readFileSync(join(dir, 'supabase/config.toml'), 'utf8'), 'synthetic concurrent edit');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
for (const failure of [undefined, 'start', 'initialize', 'serve', 'wait', 'stop']) {
  test(`OAuth lifecycle clears credentials and restores config on ${failure ?? 'normal completion'}`, async () => {
    const dir = sandbox(), env = credentials(), steps = [];
    const adapters = Object.fromEntries(['start', 'initialize', 'serve', 'wait', 'closeUi', 'stop'].map(name => [name, async restore => {
      steps.push(name);
      if (name === 'start') { assert.match(readFileSync(join(dir, 'supabase/config.toml'), 'utf8'), /auth.external.github/); restore(); }
      if (name === 'initialize') assert.deepEqual(env, {});
      if (name === failure) throw Error('synthetic failure with no real secret');
    }]));
    try {
      if (failure) await assert.rejects(oauthLifecycle(dir, adapters, env));
      else await oauthLifecycle(dir, adapters, env);
      assert.deepEqual(env, {}); assert.deepEqual(readFileSync(join(dir, 'supabase/config.toml')), original);
      assert.equal(existsSync(join(dir, 'supabase/.oauth-local')), false); assert.ok(steps.includes('stop'));
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
}
test('Concurrent config changes still stop owned services and never overwrite the user edit', async () => {
  const dir = sandbox(), env = credentials(); let stopped = false;
  try {
    await assert.rejects(oauthLifecycle(dir, {
      start: async restore => restore(), initialize: async () => {}, serve: async () => ({}),
      wait: async () => { writeFileSync(join(dir, 'supabase/config.toml'), 'synthetic user edit'); },
      closeUi: async () => {}, stop: async () => { stopped = true; },
    }, env), /CONCURRENT_CHANGE/);
    assert.equal(stopped, true); assert.deepEqual(env, {});
    assert.equal(readFileSync(join(dir, 'supabase/config.toml'), 'utf8'), 'synthetic user edit');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
test('UI never inherits provider secret, ID or elevated Supabase credentials', () => {
  const env = localDevelopmentEnvironment({ API_URL: 'http://127.0.0.1:56321', ANON_KEY: 'synthetic-public' }, {
    ...credentials(), PATH: 'synthetic-path', SUPABASE_SERVICE_ROLE_KEY: 'synthetic-secret', DATABASE_URL: 'synthetic' });
  assert.equal(env.PATH, 'synthetic-path');
  for (const name of ['GITHUB_TEST_CLIENT_ID', 'GITHUB_TEST_CLIENT_SECRET', 'SUPABASE_SERVICE_ROLE_KEY', 'DATABASE_URL']) assert.ok(!(name in env));
});
test('Only exactly one real local GitHub identity can be selected; app metadata is insufficient', () => {
  const user = { id: '00000000-0000-4000-8000-000000000099', email: 'oauth@example.invalid', email_confirmed_at: '2026-01-01', identities: [{ provider: 'github' }] };
  assert.equal(selectOAuthTestUser([user]).id, user.id);
  for (const users of [[], [user, user], [{ ...user, identities: [], app_metadata: { provider: 'github' } }], [{ ...user, email_confirmed_at: null }]]) {
    assert.throws(() => selectOAuthTestUser(users));
  }
});
test('An existing volume is resumable only with this reviewed fixture provenance', () => {
  const receipt = { version: 1, project: 'oaz-privacy-local', syntheticAppFixture: true,
    sqlSha256: 'bea86d888eea295c5ef092b2fa0f39955d494cf4b81a304615cf3079be57ed98' };
  assert.equal(reviewedOAuthFixture(receipt), true);
  for (const value of [null, {}, { ...receipt, project: 'other' }, { ...receipt, syntheticAppFixture: false }, { ...receipt, secret: 'synthetic' }]) assert.equal(reviewedOAuthFixture(value), false);
});
test('Credentials are validated in memory; the CLI accepts no credential or remote-host arguments', () => {
  assert.doesNotThrow(() => validateOAuthCredentials(credentials()));
  assert.throws(() => validateOAuthCredentials({}), /CREDENTIAL_FORMAT/);
  const r = spawnSync(process.execPath, ['scripts/local-oauth.mjs', 'start', 'synthetic-sensitive-argument'], { encoding: 'utf8' });
  assert.equal(r.status, 1); assert.equal(r.stderr.trim(), 'LOCAL_OAUTH_ACTION_REQUIRED');
  assert.ok(!`${r.stdout}${r.stderr}`.includes('synthetic-sensitive-argument'));
});
test('Windows launcher uses masked input, finally cleanup and no credential argument or env file', () => {
  const source = readFileSync('scripts/Start-Local-OAuth-Test.ps1', 'utf8');
  assert.match(source, /Read-Host[^\n]+-AsSecureString/);
  assert.match(source, /ZeroFreeBSTR/); assert.match(source, /finally/);
  assert.doesNotMatch(source, /Set-Content|Out-File|Start-Transcript/);
  assert.match(source, /& node scripts\/local-oauth.mjs start\s*\n/);
  assert.ok(source.indexOf('scripts/local-oauth.mjs prerequisites') < source.indexOf('Read-Host'));
});
