// Start the actual Hotfix UI against the verified local stack, without writing keys.
import { readdirSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { API, assertLocalUrl, localStatus } from './local-supabase.mjs';

export function localDevelopmentEnvironment(status, inherited) {
  assertLocalUrl(status.API_URL);
  if (!status.ANON_KEY) throw Error('LOCAL_ANON_KEY_REQUIRED');
  const env = Object.fromEntries(Object.entries(inherited).filter(([name]) => !/SUPABASE|^PG|^POSTGRES|^DATABASE|^OAZ_|^NEXT_PUBLIC_|^VERCEL|^NODE_OPTIONS$|^GITHUB_TEST_/.test(name)));
  return { ...env, NODE_ENV: 'development', VERCEL_ENV: 'development', NEXT_TELEMETRY_DISABLED: '1',
    NEXT_PUBLIC_SUPABASE_URL: API, NEXT_PUBLIC_SUPABASE_KEY: status.ANON_KEY,
    NEXT_PUBLIC_OAZ_PRIVACY_V2: 'true', NEXT_PUBLIC_OAZ_OAUTH_TEST_ORIGIN: 'http://127.0.0.1:3000' };
}
export function assertNoEnvironmentFiles(names) {
  if (names.some(name => /^\.env(?:$|\.)/.test(name))) throw Error('LOCAL_ENV_FILE_NOT_ALLOWED');
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const root = fileURLToPath(new URL('../', import.meta.url));
    // Next's own env loader must not reintroduce credentials removed from inheritance.
    assertNoEnvironmentFiles(readdirSync(root));
    const env = localDevelopmentEnvironment(localStatus(), process.env);
    const child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '--hostname', '127.0.0.1', '--port', '3000'], { cwd: root, env, stdio: 'inherit', windowsHide: true });
    child.on('error', () => { console.error('LOCAL_UI_STOP'); process.exitCode = 1; });
    child.on('exit', code => { process.exitCode = code ?? 1; });
  } catch { console.error('LOCAL_UI_STOP: verified stack and environment isolation required'); process.exitCode = 1; }
}
