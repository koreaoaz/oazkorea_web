import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import net from 'node:net';

// Only a synthetic startup test of an existing offline build. No HTTP request,
// database credentials or real provider login is used. Outbound traffic is denied.
const next = fileURLToPath(new URL('../node_modules/next/dist/bin/next', import.meta.url));
const guard = fileURLToPath(new URL('./offline-network.cjs', import.meta.url)).replaceAll('\\', '/');
const server = net.createServer();
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;
await new Promise(resolve => server.close(resolve));

const fixture = {
  ...process.env, NEXT_TELEMETRY_DISABLED: '1', VERCEL: '1', VERCEL_ENV: 'preview',
  VERCEL_GIT_COMMIT_REF: 'hotfix/privacy-p0', VERCEL_BRANCH_URL: 'fixture-preview.vercel.app',
  VERCEL_URL: 'fixture-deploy.vercel.app', OAZ_PREVIEW_ISOLATED_REF: 'abcdefghijklmnopqrst',
  NEXT_PUBLIC_SUPABASE_URL: 'https://abcdefghijklmnopqrst.supabase.co',
  NEXT_PUBLIC_SUPABASE_KEY: 'sb_publishable_synthetic_fixture_only',
  NEXT_PUBLIC_OAZ_OAUTH_TEST_ORIGIN: 'https://fixture-preview.vercel.app',
  NODE_OPTIONS: `--require="${guard}"`,
};
let failed = 0;
for (const [label, env, expected] of [
  ['Main target rejected at server startup', { ...fixture, NEXT_PUBLIC_SUPABASE_URL: 'https://maoefmwpdcnugyenyiea.supabase.co' }, 'PREVIEW_STOP:TARGET_MISMATCH'],
  ['Production key rejected at server startup', { ...fixture, NEXT_PUBLIC_SUPABASE_KEY: 'sb_secret_' + 'synthetic'.repeat(5) }, 'PREVIEW_STOP:PUBLIC_KEY_REQUIRED'],
  ['Offline development build cannot be promoted to Preview', fixture, 'PREVIEW_STOP:SERVER_CONFIGURATION'],
]) {
  const result = spawnSync(process.execPath, [next, 'start', '--hostname', '127.0.0.1', '--port', String(port)], {
    env, encoding: 'utf8', timeout: 20000,
  });
  const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
  const passed = result.status !== null && result.status !== 0 && !result.error && output.includes(expected);
  console.log(`${passed ? 'PASS' : 'FAIL'} ${label}`);
  if (!passed) console.log(JSON.stringify({ exit: result.status, signal: result.signal, timeout: result.error?.code === 'ETIMEDOUT',
    stop_codes: [...new Set(output.match(/PREVIEW_STOP:[A-Z_]+/g) ?? [])], ready: /Ready in/.test(output), offline_block: /Offline build:/.test(output) }));
  if (!passed) failed++;
}
console.log(JSON.stringify({ passed: 3 - failed, failed, production_connected: false, raw_output_disclosed: false }));
process.exitCode = failed ? 1 : 0;
