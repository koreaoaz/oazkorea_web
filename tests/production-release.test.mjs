import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { checkReleaseAssets, checkProductionEnvironment, releaseDecision } from '../scripts/check-production-release.mjs';

const fixture = { VERCEL: '1', VERCEL_ENV: 'production', VERCEL_GIT_COMMIT_REF: 'main',
  NEXT_PUBLIC_SUPABASE_URL: 'https://maoefmwpdcnugyenyiea.supabase.co',
  NEXT_PUBLIC_SUPABASE_KEY: 'sb_publishable_synthetic_fixture_only', NEXT_PUBLIC_OAZ_PRIVACY_V2: 'false' };

test('Frozen 13 SQL files, Vercel branch block and Node release contract match', () => {
  assert.equal(checkReleaseAssets().sqlFiles, 13);
});
test('Production compatibility and protected stages are explicit and do not grant approval', () => {
  for (const [stage, flag] of [['compatibility', 'false'], ['protected', 'true']]) {
    const result = checkProductionEnvironment({ ...fixture, NEXT_PUBLIC_OAZ_PRIVACY_V2: flag }, stage);
    assert.equal(result.productionApproved, false);
    assert.equal(result.databaseVerified, false);
    assert.match(result.credentialCheck, /REQUIRES_DASHBOARD$/);
  }
  assert.throws(() => checkProductionEnvironment(fixture), /EXPLICIT_STAGE/);
});
test('Missing, misspelled and wrong-stage flags cannot pass the release check', () => {
  for (const flag of [undefined, '', 'TRUE', '1', 'true']) {
    assert.throws(() => checkProductionEnvironment({ ...fixture, NEXT_PUBLIC_OAZ_PRIVACY_V2: flag }, 'compatibility'), /STAGE_FLAG/);
  }
  assert.throws(() => checkProductionEnvironment(fixture, 'protected'), /STAGE_FLAG/);
});
test('Preview, Hotfix branch and undeclared deployment context cannot pass Production check', () => {
  for (const change of [{ VERCEL: undefined }, { VERCEL_ENV: 'preview' }, { VERCEL_GIT_COMMIT_REF: 'hotfix/privacy-p0' }]) {
    assert.throws(() => checkProductionEnvironment({ ...fixture, ...change }, 'compatibility'), /MAIN_CONTEXT/);
  }
});
test('Wrong target, URL lookalikes, test callback and secondary DB variables fail closed', () => {
  for (const value of ['http://maoefmwpdcnugyenyiea.supabase.co', 'https://ctbwaqtqubmjmltbxfzm.supabase.co',
    fixture.NEXT_PUBLIC_SUPABASE_URL + '.invalid', fixture.NEXT_PUBLIC_SUPABASE_URL + '/']) {
    assert.throws(() => checkProductionEnvironment({ ...fixture, NEXT_PUBLIC_SUPABASE_URL: value }, 'compatibility'), /MAIN_TARGET/);
  }
  for (const [key, value] of Object.entries({ NEXT_PUBLIC_OAZ_OAUTH_TEST_ORIGIN: 'http://127.0.0.1:3000',
    SUPABASE_URL: 'https://example.invalid', SUPABASE_REF: 'synthetic', SUPABASE_ANON_KEY: 'synthetic',
    DATABASE_URL: 'synthetic', PGPASSWORD: 'synthetic', OAZ_PREVIEW_ISOLATED_REF: 'synthetic' })) {
    assert.throws(() => checkProductionEnvironment({ ...fixture, [key]: value }, 'compatibility'), /^Error: RELEASE_STOP:/);
  }
});
test('Storage aliases must stay on the exact Main public-storage origin', () => {
  assert.doesNotThrow(() => checkProductionEnvironment({ ...fixture,
    NEXT_PUBLIC_PROJECT_STORAGE_URL: fixture.NEXT_PUBLIC_SUPABASE_URL + '/storage/v1/object/public/project_img/' }, 'compatibility'));
  for (const value of ['https://example.invalid/storage/v1/object/public/a', fixture.NEXT_PUBLIC_SUPABASE_URL + '/auth/v1',
    fixture.NEXT_PUBLIC_SUPABASE_URL + '/storage/v1/object/public/a?token=synthetic']) {
    assert.throws(() => checkProductionEnvironment({ ...fixture, NEXT_PUBLIC_PROJECT_STORAGE_URL: value }, 'compatibility'), /STORAGE_ALIAS/);
  }
});
test('Legacy anon claims must match Main and be unexpired; claims alone are not signature proof', () => {
  const token = claims => ['eyJhbGciOiJIUzI1NiJ9', Buffer.from(JSON.stringify(claims)).toString('base64url'), 'synthetic'].join('.');
  const claims = { ref: 'maoefmwpdcnugyenyiea', role: 'anon', exp: 2000 };
  const run = value => checkProductionEnvironment({ ...fixture, NEXT_PUBLIC_SUPABASE_KEY: token(value) }, 'compatibility', 1000);
  assert.match(run(claims).credentialCheck, /SIGNATURE_NOT_VERIFIED$/);
  for (const change of [{ role: 'service_role' }, { role: 'authenticated' }, { ref: 'synthetic' }, { exp: 999 }, { exp: undefined }]) {
    assert.throws(() => run({ ...claims, ...change }), /PUBLIC_KEY_CLAIMS/);
  }
  for (const value of ['eyJinvalid', 'arbitrary', 'sb_secret_' + 'synthetic'.repeat(4)]) {
    assert.throws(() => checkProductionEnvironment({ ...fixture, NEXT_PUBLIC_SUPABASE_KEY: value }, 'compatibility'), /PUBLIC_KEY/);
  }
});
test('Privileged and foreign credentials under aliases fail without echoing input', () => {
  const secret = 'sb_secret_' + 'synthetic'.repeat(4);
  assert.throws(() => checkProductionEnvironment({ ...fixture, UNRELATED: secret }, 'compatibility'), error =>
    error.message === 'RELEASE_STOP:PRIVILEGED_CREDENTIAL' && !error.message.includes(secret));
});

const jwt = claims => ['eyJhbGciOiJIUzI1NiJ9', Buffer.from(JSON.stringify(claims)).toString('base64url'), 'synthetic'].join('.');
const mainRef = 'maoefmwpdcnugyenyiea';
const managed = {
  SUPABASE_URL: fixture.NEXT_PUBLIC_SUPABASE_URL,
  SUPABASE_ANON_KEY: jwt({ ref: mainRef, role: 'anon', exp: 4102444800 }),
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_independent_synthetic',
  SUPABASE_SECRET_KEY: 'sb_secret_' + 'synthetic'.repeat(4),
  SUPABASE_SERVICE_ROLE_KEY: jwt({ ref: mainRef, role: 'service_role', exp: 4102444800 }),
  SUPABASE_JWT_SECRET: 'synthetic-local-signing-value',
  POSTGRES_URL: 'postgresql:' + `//postgres.${mainRef}:synthetic@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres`,
  POSTGRES_PRISMA_URL: 'postgres:' + `//postgres.${mainRef}:synthetic@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true`,
  POSTGRES_HOST: `db.${mainRef}.supabase.co`, POSTGRES_USER: 'postgres', POSTGRES_DATABASE: 'postgres', POSTGRES_PASSWORD: 'synthetic',
};
test('Existing integration-managed server credentials do not reject a valid Main Production environment', () => {
  const result = checkProductionEnvironment({ ...fixture, ...managed }, 'compatibility');
  assert.equal(result.status, 'LOCAL_PRODUCTION_ENVIRONMENT_PASS');
  assert.ok(result.unboundServerVariables > 0);
  const serialized = JSON.stringify(result);
  for (const value of [managed.SUPABASE_SECRET_KEY, managed.SUPABASE_SERVICE_ROLE_KEY, managed.POSTGRES_URL]) assert.ok(!serialized.includes(value));
});
test('Both legacy anon and opaque publishable aliases are supported without equality assumptions', () => {
  assert.doesNotThrow(() => checkProductionEnvironment({ ...fixture, ...managed,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: managed.SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: managed.SUPABASE_PUBLISHABLE_KEY }, 'compatibility'));
});
test('Explicit Demo targets and foreign role claims in server integration variables fail', () => {
  const demo = 'ctbwaqtqubmjmltbxfzm';
  for (const change of [{ POSTGRES_HOST: `db.${demo}.supabase.co` }, { POSTGRES_USER: `postgres.${demo}` },
    { POSTGRES_URL: managed.POSTGRES_URL.replace(mainRef, demo) },
    { POSTGRES_PRISMA_URL: 'postgres:' + `//postgres:synthetic@db.${demo}.supabase.co/postgres` },
    { SUPABASE_SERVICE_ROLE_KEY: jwt({ ref: demo, role: 'service_role', exp: 4102444800 }) },
    { SUPABASE_ANON_KEY: jwt({ ref: demo, role: 'anon', exp: 4102444800 }) },
    { POSTGRES_URL: 'https://example.invalid' }, { POSTGRES_DATABASE: 'unreviewed' }]) {
    assert.throws(() => checkProductionEnvironment({ ...fixture, ...managed, ...change }, 'compatibility'), /^Error: RELEASE_STOP:/);
  }
});
test('Shared pooler with no scoped username remains explicitly unbound, never falsely project-verified', () => {
  const result = checkProductionEnvironment({ ...fixture, POSTGRES_HOST: 'aws-0-ap-northeast-1.pooler.supabase.com', POSTGRES_USER: 'postgres' }, 'compatibility');
  assert.equal(result.unboundServerVariables, 1);
  assert.equal(result.databaseVerified, false);
});
test('Server secrets in any public variable are rejected even with normal server integration values', () => {
  for (const change of [{ NEXT_PUBLIC_OTHER: managed.SUPABASE_SECRET_KEY },
    { NEXT_PUBLIC_OTHER: managed.SUPABASE_SERVICE_ROLE_KEY }, { NEXT_PUBLIC_DB_PASSWORD: 'synthetic' },
    { NEXT_PUBLIC_CUSTOM_URL: managed.POSTGRES_URL }, { NEXT_PUBLIC_JWT_SECRET: 'synthetic' }]) {
    assert.throws(() => checkProductionEnvironment({ ...fixture, ...managed, ...change }, 'compatibility'), /^Error: RELEASE_STOP:/);
  }
});
test('Integration variables never substitute for a missing or wrong-stage privacy flag', () => {
  assert.throws(() => checkProductionEnvironment({ ...fixture, ...managed, NEXT_PUBLIC_OAZ_PRIVACY_V2: undefined }, 'compatibility'), /PRIVACY_STAGE_FLAG/);
  assert.throws(() => checkProductionEnvironment({ ...fixture, ...managed }, 'protected'), /PRIVACY_STAGE_FLAG/);
});
test('CI alone is NO-GO and caller booleans never become automatic production approval', () => {
  const result = releaseDecision({ sameCommitCiPassed: true });
  assert.equal(result.decision, 'NO_GO');
  assert.ok(result.missing.includes('oauthRoundTripPassed'));
  const complete = Object.fromEntries(releaseDecision({}).missing.map(key => [key, true]));
  assert.equal(releaseDecision(complete).decision, 'OPERATOR_CHECKLIST_COMPLETE_NOT_AUTOMATIC_APPROVAL');
  assert.equal(releaseDecision({ ...complete, productionChangeApproved: 'true' }).decision, 'NO_GO');
});
test('Missing or changed SQL and overlapping Vercel deployment rules stop asset validation', () => {
  const dir = mkdtempSync(join(tmpdir(), 'oaz-rc-test-'));
  try {
    mkdirSync(join(dir, 'reports/main-safety/integration/sql'), { recursive: true });
    mkdirSync(join(dir, 'reports/privacy-hotfix'), { recursive: true });
    const hashes = JSON.parse(readFileSync('reports/privacy-hotfix/RC_SQL_HASHES.json', 'utf8'));
    writeFileSync(join(dir, 'reports/privacy-hotfix/RC_SQL_HASHES.json'), JSON.stringify(hashes));
    for (const name of Object.keys(hashes)) writeFileSync(join(dir, 'reports/main-safety/integration/sql', name), readFileSync('reports/main-safety/integration/sql/' + name));
    writeFileSync(join(dir, 'package.json'), readFileSync('package.json'));
    writeFileSync(join(dir, 'vercel.json'), JSON.stringify({ git: { deploymentEnabled: { '*': true, 'hotfix/privacy-p0': false } } }));
    assert.throws(() => checkReleaseAssets(dir), /VERCEL_BRANCH_GUARD/);
    writeFileSync(join(dir, 'vercel.json'), readFileSync('vercel.json'));
    writeFileSync(join(dir, 'reports/main-safety/integration/sql/010-postcheck.sql'), '-- synthetic corruption');
    assert.throws(() => checkReleaseAssets(dir), /SQL_HASH/);
    writeFileSync(join(dir, 'reports/main-safety/integration/sql/010-postcheck.sql'), readFileSync('reports/main-safety/integration/sql/010-postcheck.sql'));
    mkdirSync(join(dir, 'supabase'));
    writeFileSync(join(dir, 'supabase/config.toml'), '[auth.external.github]\nenabled=true');
    assert.throws(() => checkReleaseAssets(dir), /LOCAL_DEFAULT_CONFIG_CHANGED/);
  } finally { rmSync(dir, { recursive: true, force: true }); } // Only the mkdtemp-owned synthetic fixture.
});
test('CLI accepts no secret/file/network arguments and suppresses error details', () => {
  const secret = 'synthetic-sensitive-value';
  const r = spawnSync(process.execPath, ['scripts/check-production-release.mjs', 'unknown', secret], { encoding: 'utf8' });
  assert.equal(r.status, 1);
  assert.equal(r.stderr.trim(), 'RELEASE_STOP:ARGUMENTS');
  assert.ok(!`${r.stdout}${r.stderr}`.includes(secret));
});
