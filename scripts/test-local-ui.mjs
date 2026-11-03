// HTTP smoke of the actual Next dev server, never a GitHub/browser-login claim.
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { localStatus } from './local-supabase.mjs';
import { localDevelopmentEnvironment, assertNoEnvironmentFiles } from './local-dev.mjs';
import { requireUnusedPort } from './local-oauth.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const origin = 'http://127.0.0.1:3000';
const flag = process.argv[2];
const offlineBuild = process.argv[3] === '--offline-build';
let child;
let phase = 'prerequisites';
let diagnostic = '';
let checks = 0;
try {
  if (!['false', 'true'].includes(flag) || process.argv.length !== (offlineBuild ? 4 : 3)) throw Error('LOCAL_UI_FLAG_REQUIRED');
  assertNoEnvironmentFiles(readdirSync(root));
  await requireUnusedPort(3000);
  const status = offlineBuild ? { API_URL: 'http://127.0.0.1:56321', ANON_KEY: 'sb_publishable_offline_fixture' } : localStatus();
  const env = { ...localDevelopmentEnvironment(status, process.env), NEXT_PUBLIC_OAZ_PRIVACY_V2: flag };
  if (offlineBuild) {
    env.NODE_ENV = 'production';
    env.NODE_OPTIONS = `--require="${fileURLToPath(new URL('./offline-network.cjs', import.meta.url)).replaceAll('\\', '/')}"`;
  }
  // Webpack supports this worktree's shared node_modules junction.
  child = spawn(process.execPath, ['node_modules/next/dist/bin/next', offlineBuild ? 'start' : 'dev',
    ...(offlineBuild ? [] : ['--webpack']), '--hostname', '127.0.0.1', '--port', '3000'],
    { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  let launchFailed = false;
  child.on('error', () => { launchFailed = true; });
  // Retain bounded output only in RAM, and emit only fixed error classifications.
  for (const stream of [child.stdout, child.stderr]) stream.on('data', bytes => { diagnostic = (diagnostic + bytes).slice(-16384); });
  phase = 'readiness';
  let ready = false;
  for (let attempt = 0; attempt < 120; attempt++) {
    if (launchFailed || child.exitCode !== null) break;
    try {
      const response = await fetch(origin, { redirect: 'error', signal: AbortSignal.timeout(3000) });
      await response.body?.cancel();
      if (response.status === 200) { ready = true; break; }
    } catch { /* fixed loopback readiness only */ }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  assert.ok(ready); checks++;
  phase = 'routes-and-client-assets';
  const assets = new Set();
  for (const path of ['/', '/signin', '/login_callback', '/oauth_callback', '/editor']) {
    const response = await fetch(origin + path, { redirect: 'error', signal: AbortSignal.timeout(60000) });
    assert.equal(response.status, 200); checks++;
    assert.match(response.headers.get('content-type'), /text\/html/); checks++;
    const html = await response.text();
    for (const secret of [status.SERVICE_ROLE_KEY, status.JWT_SECRET].filter(Boolean)) { assert.ok(!html.includes(secret)); checks++; }
    for (const match of html.matchAll(/<script[^>]+src="([^"<>]+)"/g)) {
      const url = new URL(match[1].replaceAll('&amp;', '&'), origin);
      if (url.origin === origin && url.pathname.startsWith('/_next/static/')) assets.add(url.href);
    }
  }
  assert.ok(assets.size > 0 && assets.size < 100); checks++;
  for (const url of assets) {
    const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(30000) });
    assert.equal(response.status, 200); checks++;
    const text = await response.text();
    for (const secret of [status.SERVICE_ROLE_KEY, status.JWT_SECRET].filter(Boolean)) { assert.ok(!text.includes(secret)); checks++; }
  }
  console.log(`LOCAL_UI_HTTP_PASS flag=${flag} mode=${offlineBuild ? 'offline-build' : 'local-stack'} checks=${checks} routes=5 clientAssets=${assets.size} browserLogin=NOT_VERIFIED`);
} catch {
  const cause = /outside.*root|symlink|symbolic link|junction/i.test(diagnostic) ? 'dependency_path'
    : /Turbopack/i.test(diagnostic) ? 'turbopack'
      : /heap out of memory|ENOMEM/i.test(diagnostic) ? 'memory' : 'suppressed';
  console.error(`LOCAL_UI_HTTP_STOP flag=${flag} phase=${phase} checks=${checks} diagnostic=${cause}`);
  process.exitCode = 1;
} finally {
  if (child && child.exitCode === null) {
    const exited = new Promise(resolve => child.once('exit', resolve));
    if (process.platform === 'win32') {
      const r = spawnSync('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
      if (r.status !== 0 && child.exitCode === null) process.exitCode = 1;
    } else child.kill();
    await Promise.race([exited, new Promise(resolve => { const timer = setTimeout(() => { process.exitCode = 1; resolve(); }, 10000); timer.unref(); })]);
  }
}
