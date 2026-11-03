// Real LOCAL Auth provider/configuration smoke test with synthetic credentials.
// Does not contact GitHub, authenticate an account, or accept real credentials.
import assert from 'node:assert/strict';
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { prerequisites, reviewedOAuthFixture } from './local-oauth.mjs';
import { integration } from './test-local-supabase.mjs';
import { prepareLocalGraphql } from './prepare-local-graphql.mjs';
import { oauthLifecycle, clearOAuthCredentials, OAUTH_CALLBACK, OAUTH_ORIGIN } from './local-oauth-config.mjs';
import { API, PROJECT, start, stop, run, sql, reviewedSql, waitForServices } from './local-supabase.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
let checks = 0;
let phase = 'prerequisites';
const ok = condition => { assert.ok(condition); checks++; };
const original = readFileSync(`${root}/supabase/config.toml`);
try {
  // Never consume inherited real provider credentials, including from an operator.
  if (process.env.GITHUB_TEST_CLIENT_ID || process.env.GITHUB_TEST_CLIENT_SECRET) throw Error('LOCAL_SYNTHETIC_PROVIDER_ONLY');
  const { reuseFixture } = await prerequisites();
  process.env.GITHUB_TEST_CLIENT_ID = 'Iv1SyntheticOnly';
  process.env.GITHUB_TEST_CLIENT_SECRET = 'synthetic'.repeat(5);
  await oauthLifecycle(root, {
    start: restore => start(true, restore),
    initialize: async () => {
      if (reuseFixture) await prepareLocalGraphql({ resumeFixture: true });
      if (!reuseFixture) {
        phase = 'fresh-synthetic-integration';
        await integration(); // Requires a fresh fake DB and every existing real API check.
        const receipt = { version: 1, project: PROJECT, syntheticAppFixture: true,
          sqlSha256: 'bea86d888eea295c5ef092b2fa0f39955d494cf4b81a304615cf3079be57ed98' };
        const path = `${root}/build/oauth/fixture-provenance.json`;
        mkdirSync(`${root}/build/oauth`, { recursive: true });
        if (existsSync(path)) ok(reviewedOAuthFixture(JSON.parse(readFileSync(path, 'utf8'))));
        else writeFileSync(path, JSON.stringify(receipt), { flag: 'wx' });
      }
      phase = 'provider-probes';
      const status = await waitForServices();
      ok(sql(reviewedSql('010-postcheck.sql')).includes('P0_V3_POSTCHECK_PASS_METADATA_ONLY'));
      ok(readFileSync(`${root}/supabase/config.toml`).equals(original));
      ok(!process.env.GITHUB_TEST_CLIENT_ID && !process.env.GITHUB_TEST_CLIENT_SECRET);
      const settings = await fetch(`${API}/auth/v1/settings`, {
        headers: { apikey: status.ANON_KEY }, redirect: 'error', signal: AbortSignal.timeout(10000),
      });
      ok(settings.status === 200);
      ok((await settings.json()).external?.github === true);
      for (const callback of ['login_callback', 'oauth_callback']) {
        const url = new URL(`${API}/auth/v1/authorize`);
        url.searchParams.set('provider', 'github');
        url.searchParams.set('redirect_to', `${OAUTH_ORIGIN}/${callback}`);
        // Inspect only the local redirect. Never follow it to GitHub.
        const response = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(10000) });
        ok(response.status === 302 || response.status === 303);
        const location = new URL(response.headers.get('location'));
        ok(location.origin === 'https://github.com' && location.pathname === '/login/oauth/authorize');
        ok(location.searchParams.get('client_id') === 'Iv1SyntheticOnly');
        ok(location.searchParams.get('redirect_uri') === OAUTH_CALLBACK);
        ok(!!location.searchParams.get('state'));
        await response.body?.cancel();
      }
    },
    serve: async () => undefined,
    wait: async () => {},
    closeUi: async () => {},
    stop,
  }, process.env);
  phase = 'restoration';
  ok(readFileSync(`${root}/supabase/config.toml`).equals(original));
  ok(!existsSync(`${root}/supabase/.oauth-local`));
  ok(!process.env.GITHUB_TEST_CLIENT_ID && !process.env.GITHUB_TEST_CLIENT_SECRET);
  ok(!run('docker', ['ps', '-aq', '--filter', `label=com.supabase.cli.project=${PROJECT}`]));
  console.log(`LOCAL_SYNTHETIC_OAUTH_PROVIDER_PASS checks=${checks} githubLogin=NOT_VERIFIED externalRedirectFollowed=false`);
} catch {
  console.error(`LOCAL_SYNTHETIC_OAUTH_PROVIDER_STOP phase=${phase} checks=${checks} githubLogin=NOT_VERIFIED`);
  process.exitCode = 1;
} finally {
  clearOAuthCredentials(process.env);
}
