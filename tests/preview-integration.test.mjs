import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { checkPreviewEnvironment, assertRuntimeEnvironment, previewVariableInventory } from '../src/lib/privacy/preview-environment.mjs';

const env = { VERCEL: '1', VERCEL_ENV: 'preview', VERCEL_GIT_COMMIT_REF: 'hotfix/privacy-p0',
  VERCEL_BRANCH_URL: 'fixture-preview.vercel.app', OAZ_PREVIEW_ISOLATED_REF: 'abcdefghijklmnopqrst',
  NEXT_PUBLIC_SUPABASE_URL: 'https://abcdefghijklmnopqrst.supabase.co',
  NEXT_PUBLIC_SUPABASE_KEY: 'sb_publishable_synthetic_fixture_only',
  NEXT_PUBLIC_OAZ_OAUTH_TEST_ORIGIN: 'https://fixture-preview.vercel.app', NEXT_PUBLIC_OAZ_PRIVACY_V2: 'false' };

test('A branch URL override alone never masks inherited production aliases or secrets', () => {
  for (const extra of [
    { SUPABASE_URL: 'https://maoefmwpdcnugyenyiea.supabase.co' },
    { NEXT_PUBLIC_SUPABASE_STORAGE_URL: 'https://maoefmwpdcnugyenyiea.supabase.co/storage/v1' },
    { SUPABASE_PROJECT_REF: 'maoefmwpdcnugyenyiea' },
    { OAZ_SUPABASE_SECRET_KEY: 'synthetic-private' },
    { OAZ_DATABASE_URL: 'synthetic-unused-connection' },
    { PGHOST: 'localhost' }, { PGSERVICEFILE: 'synthetic-file' },
    { NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_other_fixture_key' },
    { DEMO_VISITOR_SERVICE_KEY: 'synthetic-private' },
    { UNRELATED_CUSTOM_NAME: 'sb_secret_' + 'synthetic'.repeat(5) },
  ]) {
    assert.throws(() => checkPreviewEnvironment({ ...env, ...extra }), /PREVIEW_STOP:/);
    assert.throws(() => assertRuntimeEnvironment(env, { ...env, ...extra }), /PREVIEW_STOP:/);
  }
});

test('Every reviewed alias must match the isolated target and public key', () => {
  const matching = { ...env, SUPABASE_URL: env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_STORAGE_URL: env.NEXT_PUBLIC_SUPABASE_URL + '/storage/v1',
    SUPABASE_PROJECT_REF: env.OAZ_PREVIEW_ISOLATED_REF,
    SUPABASE_PUBLISHABLE_KEY: env.NEXT_PUBLIC_SUPABASE_KEY };
  assert.match(checkPreviewEnvironment(matching), /UNVERIFIED/);
  const summary = JSON.stringify(previewVariableInventory(matching));
  assert.doesNotMatch(summary, /https:|sb_publishable_|abcdefghijklmnopqrst/);
  assert.match(summary, /SUPABASE_STORAGE_URL/);
});

test('Feature flag accepts only explicit true or false in Preview', () => {
  for (const flag of ['yes', 'TRUE', '1']) assert.throws(() => checkPreviewEnvironment({ ...env, NEXT_PUBLIC_OAZ_PRIVACY_V2: flag }), /INVALID_PRIVACY_FLAG/);
  assert.doesNotThrow(() => checkPreviewEnvironment({ ...env, NEXT_PUBLIC_OAZ_PRIVACY_V2: 'true' }));
});

test('Existing Netlify Demo is preserved and cannot become a disposable Hotfix target', () => {
  const demo = { ...env, OAZ_PREVIEW_ISOLATED_REF: 'ctbwaqtqubmjmltbxfzm', NEXT_PUBLIC_SUPABASE_URL: 'https://ctbwaqtqubmjmltbxfzm.supabase.co' };
  assert.throws(() => checkPreviewEnvironment(demo), /PRESERVED_DEMO_TARGET/);
  assert.throws(() => assertRuntimeEnvironment(env, demo), /PRESERVED_DEMO_TARGET/);
});

test('Effective environment audit never promotes local checks to remote readiness', () => {
  const result = spawnSync(process.execPath, ['scripts/audit-preview-env.mjs'], { encoding: 'utf8', env: { ...process.env, ...env } });
  assert.equal(result.status, 0);
  const report = JSON.parse(result.stdout);
  assert.equal(report.remote_sources_verified, false);
  assert.equal(report.remote_data_isolation_verified, false);
  assert.equal(report.values_disclosed, false);
  assert.doesNotMatch(result.stdout, /sb_publishable_|https:\/\/|abcdefghijklmnopqrst/);
});

test('Environment audit fails closed for the known unsafe common Preview target', () => {
  const result = spawnSync(process.execPath, ['scripts/audit-preview-env.mjs'], { encoding: 'utf8',
    env: { ...process.env, ...env, NEXT_PUBLIC_SUPABASE_URL: 'https://maoefmwpdcnugyenyiea.supabase.co' } });
  assert.equal(result.status, 1);
  const report = JSON.parse(result.stderr);
  assert.equal(report.status, 'BLOCKED'); assert.equal(report.reason, 'PREVIEW_STOP:TARGET_MISMATCH');
  assert.doesNotMatch(result.stderr, /maoefmwpdcnugyenyiea|sb_publishable_|https:\/\//);
});

test('CI isolated DB job pins real PG 17.6, checks errors, never connects to a remote DB', () => {
  const require = createRequire(import.meta.url);
  const workflow = require('js-yaml').load(readFileSync('.github/workflows/privacy-hotfix.yml', 'utf8'));
  const job = workflow.jobs['isolated-postgres']; assert.equal(job['runs-on'], 'windows-latest');
  const commands = job.steps.filter(s => s.run).map(s => s.run).join('\n');
  assert.match(commands, /get\.enterprisedb\.com\/postgresql\/postgresql-17\.6-1-windows-x64-binaries\.zip/);
  assert.match(commands, /d378882abd001a186735acd6f6ba716bca6ccd192e800412d4fd15ed25376b3e/);
  assert.match(commands, /--auto-grants on/); assert.match(commands, /--auto-grants off/);
  assert.doesNotMatch(commands, /supabase\.co|--db-url|PGPASSWORD|secrets\.|upload-artifact/);
  assert.ok(job.steps.every(s => !s['continue-on-error']));
});
