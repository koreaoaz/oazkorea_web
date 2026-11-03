import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const guard = fileURLToPath(new URL('./offline-network.cjs', import.meta.url)).replaceAll('\\', '/');
const next = fileURLToPath(new URL('../node_modules/next/dist/bin/next', import.meta.url));
const options = process.argv.slice(2);
if (options.some(option => option !== '--privacy-v3') || options.length > 1) throw new Error('Unsupported offline build option');
const result = spawnSync(process.execPath, [next, 'build', '--webpack'], {
  stdio: 'inherit', cwd: fileURLToPath(new URL('..', import.meta.url)),
  env: { ...process.env, VERCEL_ENV: 'development', NEXT_PUBLIC_OAZ_OAUTH_TEST_ORIGIN: '', NEXT_TELEMETRY_DISABLED: '1', NEXT_PUBLIC_SUPABASE_URL: 'https://offline.invalid',
    NEXT_PUBLIC_SUPABASE_KEY: 'sb_publishable_offline_fixture',
    NEXT_PUBLIC_OAZ_PRIVACY_V2: options.includes('--privacy-v3') ? 'true' : 'false',
    NODE_OPTIONS: `--require="${guard}"` },
});
process.exitCode = result.status ?? 1;
