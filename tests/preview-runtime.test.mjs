import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { checkPreviewEnvironment, assertRuntimeEnvironment } from '../src/lib/privacy/preview-environment.mjs';
import { loadSource } from './helpers/react-dom.mjs';

const ref = 'abcdefghijklmnopqrst';
const preview = {
  VERCEL: '1', VERCEL_ENV: 'preview', VERCEL_GIT_COMMIT_REF: 'hotfix/privacy-p0',
  VERCEL_BRANCH_URL: 'fixture-preview.vercel.app', VERCEL_URL: 'fixture-deploy.vercel.app',
  OAZ_PREVIEW_ISOLATED_REF: ref, NEXT_PUBLIC_SUPABASE_URL: `https://${ref}.supabase.co`,
  NEXT_PUBLIC_SUPABASE_KEY: 'sb_publishable_synthetic_fixture_only',
  NEXT_PUBLIC_OAZ_OAUTH_TEST_ORIGIN: 'https://fixture-preview.vercel.app',
};
const publicVariables = env => ({
  NEXT_PUBLIC_OAZ_VERCEL: env.VERCEL, NEXT_PUBLIC_OAZ_DEPLOYMENT_ENV: env.VERCEL_ENV,
  NEXT_PUBLIC_OAZ_DEPLOYMENT_BRANCH: env.VERCEL_GIT_COMMIT_REF,
  NEXT_PUBLIC_OAZ_PREVIEW_BRANCH_HOST: env.VERCEL_BRANCH_URL,
  NEXT_PUBLIC_OAZ_PREVIEW_DEPLOYMENT_HOST: env.VERCEL_URL,
  NEXT_PUBLIC_OAZ_PREVIEW_ISOLATED_REF: env.OAZ_PREVIEW_ISOLATED_REF,
  NEXT_PUBLIC_SUPABASE_URL: env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_KEY: env.NEXT_PUBLIC_SUPABASE_KEY,
  NEXT_PUBLIC_OAZ_OAUTH_TEST_ORIGIN: env.NEXT_PUBLIC_OAZ_OAUTH_TEST_ORIGIN,
});
const jwt = claims => ['eyJhbGciOiJIUzI1NiJ9', Buffer.from(JSON.stringify(claims)).toString('base64url'), 'synthetic'].join('.');

test('Preview validates real branch context, complete target and exact public credential', () => {
  assert.match(checkPreviewEnvironment(preview), /REMOTE_ISOLATION_UNVERIFIED$/);
  for (const change of [
    { VERCEL_ENV: undefined }, { VERCEL_ENV: 'unknown' }, { VERCEL_GIT_COMMIT_REF: undefined },
    { NEXT_PUBLIC_SUPABASE_URL: undefined }, { NEXT_PUBLIC_SUPABASE_KEY: undefined },
    { NEXT_PUBLIC_SUPABASE_KEY: jwt({ role: 'service_role', ref }) },
    { NEXT_PUBLIC_SUPABASE_KEY: jwt({ role: 'anon', ref: 'maoefmwpdcnugyenyiea' }) },
    { NEXT_PUBLIC_SUPABASE_KEY: 'sb_publishable_short' },
    { NEXT_PUBLIC_OAZ_OAUTH_TEST_ORIGIN: 'https://user:pass@fixture-preview.vercel.app' },
    { NEXT_PUBLIC_OAZ_OAUTH_TEST_ORIGIN: 'https://fixture-preview.vercel.app/path' },
  ]) assert.throws(() => checkPreviewEnvironment({ ...preview, ...change }), /^Error: PREVIEW_STOP:[A-Z_]+$/);
  assert.doesNotThrow(() => checkPreviewEnvironment({ ...preview, NEXT_PUBLIC_SUPABASE_KEY: jwt({ role: 'anon', ref }) }));
  assert.throws(() => checkPreviewEnvironment({ NODE_ENV: 'production' }), /DEPLOYMENT_CONTEXT_REQUIRED/);
  assert.throws(() => checkPreviewEnvironment({ ...preview, VERCEL_ENV: 'production', NEXT_PUBLIC_OAZ_OAUTH_TEST_ORIGIN: '' }), /PRODUCTION_BRANCH_REQUIRED/);
  for (const name of ['SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SECRET_KEY', 'DATABASE_URL', 'POSTGRES_PASSWORD']) {
    assert.throws(() => checkPreviewEnvironment({ ...preview, [name]: 'synthetic-unused-credential' }), /UNNEEDED_SERVER_CREDENTIAL/);
    assert.throws(() => assertRuntimeEnvironment(preview, { ...preview, [name]: 'synthetic-unused-credential' }), /UNNEEDED_SERVER_CREDENTIAL/);
  }
  assert.throws(() => checkPreviewEnvironment({ ...preview, SUPABASE_URL: 'https://maoefmwpdcnugyenyiea.supabase.co' }), /ALTERNATE_TARGET/);
  assert.throws(() => checkPreviewEnvironment({ ...preview, NEXT_PUBLIC_SUPABASE_ANON_KEY: 'other-fixture' }), /ALTERNATE_KEY/);
});

test('Runtime rejects unsafe live configuration and mismatch with the compiled app', () => {
  assert.doesNotThrow(() => assertRuntimeEnvironment(preview, preview));
  for (const runtime of [
    { ...preview, NEXT_PUBLIC_SUPABASE_URL: 'https://maoefmwpdcnugyenyiea.supabase.co' },
    { ...preview, NEXT_PUBLIC_SUPABASE_KEY: 'sb_secret_' + 'fixture'.repeat(6) },
    { ...preview, OAZ_PREVIEW_ISOLATED_REF: 'maoefmwpdcnugyenyiea' },
    { ...preview, NEXT_PUBLIC_SUPABASE_KEY: 'sb_publishable_other_synthetic_key' },
    { ...preview, VERCEL_ENV: 'production', NEXT_PUBLIC_OAZ_OAUTH_TEST_ORIGIN: '' },
    { VERCEL_ENV: 'development' },
  ]) assert.throws(() => assertRuntimeEnvironment(preview, runtime), /^Error: PREVIEW_STOP:[A-Z_]+$/);
  assert.throws(() => assertRuntimeEnvironment({ VERCEL_ENV: 'production' }, preview), /RUNTIME_CONTEXT/);
});

for (const browser of [false, true]) test(`Supabase client cannot be created for a production target in Preview (browser=${browser})`, () => {
  let creations = 0;
  const bad = { ...preview, NEXT_PUBLIC_SUPABASE_URL: 'https://maoefmwpdcnugyenyiea.supabase.co' };
  assert.throws(() => loadSource('src/lib/supabaseClient.ts', {
    '@supabase/supabase-js': { createClient() { creations++; throw Error('Must not create client'); } },
  }, { process: { env: { ...bad, ...publicVariables(bad) } }, URL, atob, window: browser ? {} : undefined }), /PREVIEW_STOP/);
  assert.equal(creations, 0);
});

test('Safe isolated browser client uses the validated project without a network request', () => {
  let creations = 0;
  loadSource('src/lib/supabaseClient.ts', {
    '@supabase/supabase-js': { createClient(url, key) { creations++; assert.equal(url, preview.NEXT_PUBLIC_SUPABASE_URL); assert.equal(key, preview.NEXT_PUBLIC_SUPABASE_KEY); return {}; } },
  }, { process: { env: publicVariables(preview) }, URL, atob, window: {} });
  assert.equal(creations, 1);
});

test('Instrumentation fails before serving requests when runtime points at Main', async () => {
  let stopped = false;
  const register = loadSource('src/instrumentation.ts', {
    './lib/privacy/deployment-environment': { publicDeploymentEnvironment: () => preview },
  }, { process: {
    env: { ...preview, NEXT_RUNTIME: 'nodejs', NEXT_PUBLIC_SUPABASE_URL: 'https://maoefmwpdcnugyenyiea.supabase.co' },
    exit(code) { assert.equal(code, 1); stopped = true; throw Error('PREVIEW_STOP:SERVER_CONFIGURATION'); },
  }, URL, atob }).register;
  await assert.rejects(register(), /PREVIEW_STOP/);
  assert.equal(stopped, true);
});

test('Direct Next config loading also rejects Main in Preview', () => {
  assert.throws(() => loadSource('next.config.ts', {}, { process: { env: { ...preview, NEXT_PUBLIC_SUPABASE_URL: 'https://maoefmwpdcnugyenyiea.supabase.co' } }, URL, atob }), /PREVIEW_STOP/);
});

test('Preview CLI failure returns only a fixed code, with no key or target value', () => {
  const badKey = 'sb_secret_' + 'fixture'.repeat(6);
  const result = spawnSync(process.execPath, ['scripts/check-preview-env.mjs'], {
    encoding: 'utf8', env: { ...process.env, ...preview, NEXT_PUBLIC_SUPABASE_KEY: badKey },
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr.trim(), /^PREVIEW_STOP:[A-Z_]+$/);
  assert.doesNotMatch(result.stderr + result.stdout, new RegExp(badKey));
});

test('Dotenv branch overrides do not bypass Preview checks', () => {
  // Isolated fake dotenv files only; original project environment is not touched.
  const dir = mkdtempSync(path.join(tmpdir(), 'oaz-preview-env-'));
  writeFileSync(path.join(dir, '.env.production'), 'NEXT_PUBLIC_SUPABASE_URL=https://generic.invalid\n');
  writeFileSync(path.join(dir, '.env.production.local'), `NEXT_PUBLIC_SUPABASE_URL=${preview.NEXT_PUBLIC_SUPABASE_URL}\n`);
  const source = `const {loadEnvConfig}=require(${JSON.stringify(path.resolve('node_modules/@next/env'))});loadEnvConfig(${JSON.stringify(dir)},false,{info(){},error(){}});if(process.env.NEXT_PUBLIC_SUPABASE_URL!==${JSON.stringify(preview.NEXT_PUBLIC_SUPABASE_URL)})process.exit(1);`;
  execFileSync(process.execPath, ['-e', source], { env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot }, stdio: 'pipe' });
});
