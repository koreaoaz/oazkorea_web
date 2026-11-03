// Operator-only local OAuth harness. No remote host, token or SQL arguments exist.
import { readdirSync, existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createServer } from 'node:net';
import { createInterface } from 'node:readline/promises';
import { once } from 'node:events';
import { createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { API, PROJECT, CLI_VERSION, run, start, sql, localStatus, assertDockerEndpoint, waitForServices, reviewedSql, preflightBindings, localCommandEnvironment } from './local-supabase.mjs';
import { localDevelopmentEnvironment, assertNoEnvironmentFiles } from './local-dev.mjs';
import { oauthLifecycle, oauthSession, restoreOAuthConfig, renderOAuthConfig, clearOAuthCredentials, OAUTH_ORIGIN, recordOAuthUi, recordOAuthContainers, validUiIdentity } from './local-oauth-config.mjs';
import { integration } from './test-local-supabase.mjs';
import { checkReleaseAssets } from './check-production-release.mjs';
import { reviewedOAuthFixture } from './local-supabase.mjs';
import { prepareLocalGraphql } from './prepare-local-graphql.mjs';
export { reviewedOAuthFixture } from './local-supabase.mjs';
export function oauthMenuAction(value) {
  if (value === '') return 'stop';
  const actions = { '1': 'verify', '2': 'approve', '3': 'existing', '4': 'administrator' };
  if (!Object.hasOwn(actions, value)) throw Error('LOCAL_OAUTH_MENU_REQUIRED');
  return actions[value];
}

const root = fileURLToPath(new URL('../', import.meta.url));
const provenancePath = `${root}/build/oauth/fixture-provenance.json`;
const provenance = { version: 1, project: PROJECT, syntheticAppFixture: true,
  sqlSha256: 'bea86d888eea295c5ef092b2fa0f39955d494cf4b81a304615cf3079be57ed98' };
const nextCli = fileURLToPath(new URL('../node_modules/next/dist/bin/next', import.meta.url));
export function sameUiIdentity(expected, actual) {
  if (!validUiIdentity(expected)) throw Error('LOCAL_OAUTH_UI_IDENTITY_REQUIRED');
  return validUiIdentity(actual) && ['pid', 'startedTicks', 'commandSha256'].every(key => actual[key] === expected[key]);
}
export function selectOwnedOAuthContainers(expected, actual) {
  if (!Array.isArray(expected) || expected.some(id => !/^[a-f0-9]{64}$/.test(id)) ||
      !Array.isArray(actual) || actual.some(id => !/^[a-f0-9]{64}$/.test(id))) throw Error('LOCAL_OAUTH_CONTAINER_MANUAL_CHECK_REQUIRED');
  return { owned: actual.filter(id => expected.includes(id)), foreign: actual.filter(id => !expected.includes(id)) };
}
function windowsUiIdentity(pid) {
  if (!Number.isSafeInteger(pid) || pid < 1) throw Error('LOCAL_OAUTH_UI_IDENTITY_REQUIRED');
  const command = `$ErrorActionPreference='Stop'; $p=Get-Process -Id ${pid} -ErrorAction SilentlyContinue; if (!$p) {exit 3}; try {` +
    `$c=Get-CimInstance Win32_Process -Filter 'ProcessId=${pid}' -ErrorAction Stop; ` +
    "if (!$c -or $p.HasExited) {exit 3}; @{ticks=$p.StartTime.ToUniversalTime().Ticks.ToString(); exe=$c.ExecutablePath; cmd=$c.CommandLine} | ConvertTo-Json -Compress} catch {exit 4}";
  const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command],
    { env: localCommandEnvironment(), encoding: 'utf8', windowsHide: true, timeout: 20000 });
  if (result.status === 3) return null;
  if (result.error || result.status !== 0) throw Error('LOCAL_OAUTH_UI_IDENTITY_REQUIRED');
  let data;
  try { data = JSON.parse(result.stdout); } catch { throw Error('LOCAL_OAUTH_UI_IDENTITY_REQUIRED'); }
  if (typeof data.exe !== 'string' || !data.exe || typeof data.cmd !== 'string' || !data.cmd) throw Error('LOCAL_OAUTH_UI_IDENTITY_REQUIRED');
  const normal = value => String(value ?? '').replaceAll('\\', '/').toLowerCase();
  if (normal(data.exe) !== normal(process.execPath) || !normal(data.cmd).includes(normal(nextCli))) return null;
  return { pid, startedTicks: data.ticks, commandSha256: createHash('sha256').update(data.cmd).digest('hex') };
}
async function recoverUi(state) {
  if (!state.ui) {
    try { await requireUnusedPort(3000); } catch { throw Error('LOCAL_OAUTH_UI_MANUAL_CHECK_REQUIRED'); }
    return;
  }
  if (process.platform !== 'win32') throw Error('LOCAL_OAUTH_UI_MANUAL_CHECK_REQUIRED');
  if (!validUiIdentity(state.ui)) throw Error('LOCAL_OAUTH_UI_IDENTITY_REQUIRED');
  const actual = windowsUiIdentity(state.ui.pid);
  if (!sameUiIdentity(state.ui, actual)) {
    console.log('LOCAL_OAUTH_PREVIOUS_UI_GONE_OTHER_PROCESS_PRESERVED');
  } else {
    const result = spawnSync('taskkill.exe', ['/PID', String(state.ui.pid), '/T', '/F'],
      { env: localCommandEnvironment(), stdio: 'ignore', windowsHide: true });
    if (result.status !== 0 && sameUiIdentity(state.ui, windowsUiIdentity(state.ui.pid))) throw Error('LOCAL_OAUTH_UI_CLEANUP_REQUIRED');
    if (sameUiIdentity(state.ui, windowsUiIdentity(state.ui.pid))) throw Error('LOCAL_OAUTH_UI_CLEANUP_REQUIRED');
    console.log('LOCAL_OAUTH_OWNED_UI_RECOVERED');
  }
  try { await requireUnusedPort(3000); } catch { throw Error('LOCAL_OAUTH_UI_MANUAL_CHECK_REQUIRED'); }
}
export async function requireUnusedPort(port) {
  await new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', () => reject(Error('LOCAL_OAUTH_PORT_IN_USE')));
    server.listen({ host: '127.0.0.1', port, exclusive: true }, () => server.close(error => error ? reject(Error('LOCAL_OAUTH_PORT_CHECK')) : resolve()));
  });
}
export async function prerequisites() {
  if (Number(process.versions.node.split('.')[0]) !== 24) throw Error('LOCAL_NODE24_REQUIRED');
  if (run('git', ['branch', '--show-current']) !== 'hotfix/privacy-p0') throw Error('LOCAL_HOTFIX_BRANCH_REQUIRED');
  assertNoEnvironmentFiles(readdirSync(root));
  assertNoEnvironmentFiles(readdirSync(`${root}/supabase`)); // CLI also loads nested dotenv files.
  if (existsSync(`${root}/supabase/.temp/project-ref`) || existsSync(`${root}/supabase/.oauth-local`)) throw Error('LOCAL_OAUTH_RECOVERY_OR_UNLINK_REQUIRED');
  renderOAuthConfig(readFileSync(`${root}/supabase/config.toml`));
  checkReleaseAssets();
  if (run('supabase', ['--version']) !== CLI_VERSION) throw Error('LOCAL_PINNED_CLI_REQUIRED');
  assertDockerEndpoint(JSON.parse(run('docker', ['context', 'inspect']))[0]?.Endpoints?.docker?.Host);
  if (run('docker', ['info', '--format', '{{.OSType}}']) !== 'linux') throw Error('LOCAL_LINUX_ENGINE_REQUIRED');
  if (run('docker', ['ps', '-aq', '--filter', `label=com.supabase.cli.project=${PROJECT}`])) throw Error('LOCAL_EXISTING_PROJECT_PRESERVED');
  const hasVolumes = !!(run('docker', ['volume', 'ls', '-q', '--filter', `label=com.supabase.cli.project=${PROJECT}`]) ||
      run('docker', ['volume', 'ls', '-q', '--filter', `name=${PROJECT}`]));
  // Resume only our previously initialized fixture. Never reset/reseed another stack.
  if (hasVolumes && (!existsSync(provenancePath) || !reviewedOAuthFixture(JSON.parse(readFileSync(provenancePath, 'utf8'))))) throw Error('LOCAL_EXISTING_VOLUME_PRESERVED');
  for (const port of [3000, 56320, 56321, 56322]) await requireUnusedPort(port);
  preflightBindings(); // Fail closed before the PowerShell launcher asks for a Secret.
  console.log('LOCAL_OAUTH_PREREQUISITES_PASS');
  return { reuseFixture: hasVolumes };
}
async function serve() {
  const env = localDevelopmentEnvironment(localStatus(), process.env);
  const child = spawn(process.execPath, [nextCli, 'dev', '--webpack', '--hostname', '127.0.0.1', '--port', '3000'],
    { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  child.stdout.resume(); child.stderr.resume(); // Never forward URL, provider error or framework diagnostics.
  let launchError = false;
  child.on('error', () => { launchError = true; });
  try {
    if (process.platform === 'win32' && child.pid) {
      const identity = windowsUiIdentity(child.pid);
      if (!identity) throw Error('LOCAL_OAUTH_UI_IDENTITY_REQUIRED');
      recordOAuthUi(root, identity);
    }
    for (let attempt = 0; attempt < 120; attempt++) {
      if (launchError || child.exitCode !== null) throw Error('LOCAL_OAUTH_UI_FAILED');
      try {
        const response = await fetch(OAUTH_ORIGIN, { redirect: 'error', signal: AbortSignal.timeout(1000) });
        await response.body?.cancel();
        if (response.status === 200) return child;
      } catch { /* fixed loopback readiness probe only */ }
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    throw Error('LOCAL_OAUTH_UI_TIMEOUT');
  } catch (error) {
    await closeUi(child); // A failed readiness check must not orphan Next's child tree.
    throw error;
  }
}
async function closeUi(child) {
  if (!child || !Number.isSafeInteger(child.pid) || child.exitCode !== null) return;
  const closed = once(child, 'exit');
  if (process.platform === 'win32') {
    // Only this launcher's owned child tree; never kill a process found by port.
    const result = spawnSync('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
    if (result.status !== 0 && child.exitCode === null) throw Error('LOCAL_OAUTH_UI_CLEANUP_REQUIRED');
  } else child.kill();
  await Promise.race([closed, new Promise((_, reject) => {
    const timer = setTimeout(() => reject(Error('LOCAL_OAUTH_UI_CLEANUP_REQUIRED')), 10000); timer.unref();
  })]);
}
function stopOAuthContainers() {
  // Config-independent shutdown: even a concurrent config edit cannot redirect cleanup.
  assertDockerEndpoint(JSON.parse(run('docker', ['context', 'inspect']))[0]?.Endpoints?.docker?.Host);
  const current = run('docker', ['ps', '-aq', '--no-trunc', '--filter', `label=com.supabase.cli.project=${PROJECT}`]).split(/\s+/).filter(Boolean);
  if (!current.length) return;
  const expected = oauthSession(root).containers;
  const { owned: ids, foreign } = selectOwnedOAuthContainers(expected, current);
  const containers = ids.length ? JSON.parse(run('docker', ['inspect', ...ids])) : [];
  // Shutdown does not open an API/DB connection. Its ownership guard must still
  // allow stopping OUR containers when their port binding has become unsafe.
  if (containers.some(c => !/^\/supabase_[a-z0-9_]+_oaz-privacy-local$/.test(c.Name) ||
      c.Config?.Labels?.['com.supabase.cli.project'] !== PROJECT)) throw Error('LOCAL_OAUTH_CONTAINER_OWNER');
  if (ids.length) {
    run('docker', ['stop', ...ids]);
    run('docker', ['rm', ...ids]); // Retain every volume; remove credential-bearing container config.
  }
  if (foreign.length) throw Error('LOCAL_EXISTING_PROJECT_PRESERVED');
  if (run('docker', ['ps', '-aq', '--filter', `label=com.supabase.cli.project=${PROJECT}`])) throw Error('LOCAL_OAUTH_CONTAINER_CLEANUP_REQUIRED');
}
export function selectOAuthTestUser(users) {
  const candidates = users.filter(user => user.identities?.some(identity => identity.provider === 'github'));
  if (candidates.length !== 1) throw Error('LOCAL_ONE_GITHUB_TEST_ACCOUNT_REQUIRED');
  const user = candidates[0];
  if (!/^[a-f0-9-]{36}$/.test(user.id) || !user.email_confirmed_at || !user.email || user.banned_until && Date.parse(user.banned_until) > Date.now()) throw Error('LOCAL_VERIFIED_GITHUB_ACCOUNT_REQUIRED');
  return user;
}
async function accountAction(action) {
  const state = oauthSession(root);
  if (!state.ready) throw Error('LOCAL_OAUTH_SESSION_NOT_READY');
  try { process.kill(state.ownerPid, 0); } catch { throw Error('LOCAL_OAUTH_SESSION_NOT_RUNNING'); }
  const status = localStatus();
  const admin = createClient(API, status.SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: (input, init) => {
      if (new URL(input).origin !== API) throw Error('LOCAL_REQUEST_ONLY');
      return fetch(input, { ...init, redirect: 'error', signal: AbortSignal.timeout(10000) });
    } } });
  const result = await admin.auth.admin.listUsers({ page: 1, perPage: 100 });
  if (result.error || result.data.users.length >= 100) throw Error('LOCAL_ACCOUNT_INVENTORY_FAILED');
  const user = selectOAuthTestUser(result.data.users);
  const id = user.id;
  const email = "'" + user.email.replaceAll("'", "''") + "'";
  if (action !== 'verify') {
    // Explicit operator action in the already verified disposable local fixture only.
    const confirm = createInterface({ input: process.stdin, output: process.stdout });
    try { if (await confirm.question('현재 로컬 테스트 계정만 변경합니다. 확인하려면 LOCAL-TEST-ACCOUNT-ONLY 입력: ') !== 'LOCAL-TEST-ACCOUNT-ONLY') throw Error('LOCAL_ACCOUNT_ACTION_NOT_CONFIRMED'); }
    finally { confirm.close(); }
    if (action === 'approve') sql(`INSERT INTO public.allowed_user(email,name) VALUES(${email},'Local OAuth test') ON CONFLICT(email) DO NOTHING;`);
    if (action === 'existing') sql(`INSERT INTO public.registered_member(uuid,email,name,department,generation,phone_number,student_id,is_manager) VALUES('${id}',${email},'Local OAuth test','Synthetic','test','000-0000-0000','oauth-test',false) ON CONFLICT(uuid) DO NOTHING;`);
    if (action === 'administrator') {
      if (sql(`SELECT EXISTS(SELECT FROM public.registered_member WHERE uuid='${id}');`) !== 't') throw Error('LOCAL_REGISTERED_TEST_ACCOUNT_REQUIRED');
      sql(`INSERT INTO public.supervisor_id(uuid,email,name) SELECT '${id}',${email},'Local OAuth test' WHERE NOT EXISTS(SELECT FROM public.supervisor_id WHERE uuid='${id}');`);
    }
  }
  const evidence = JSON.parse(sql(`BEGIN READ ONLY; SELECT json_build_object('githubIdentity',true,'serverSessionPresent',EXISTS(SELECT FROM auth.sessions WHERE user_id='${id}'),'memberPresent',EXISTS(SELECT FROM public.registered_member WHERE uuid='${id}'),'approvalPresent',EXISTS(SELECT FROM public.allowed_user WHERE email=${email}),'localEditorAssigned',EXISTS(SELECT FROM public.supervisor_id WHERE uuid='${id}')); ROLLBACK;`));
  console.log('LOCAL_OAUTH_SERVER_EVIDENCE ' + JSON.stringify({ ...evidence, browserRoundTripAttested: false }));
}
async function main(action) {
  if (action === 'prerequisites') return prerequisites();
  if (action === 'recover') {
    if (!existsSync(`${root}/supabase/.oauth-local`)) {
      if (run('docker', ['ps', '-aq', '--filter', `label=com.supabase.cli.project=${PROJECT}`])) throw Error('LOCAL_EXISTING_PROJECT_PRESERVED');
      console.log('LOCAL_OAUTH_RECOVERY_NOT_REQUIRED'); return;
    }
    const state = oauthSession(root);
    try { process.kill(state.ownerPid, 0); throw Error('LOCAL_OAUTH_OWNER_STILL_RUNNING'); }
    catch (error) { if (error.code !== 'ESRCH') throw error; }
    try { await recoverUi(state); }
    finally {
      try { restoreOAuthConfig(root); }
      finally { stopOAuthContainers(); }
    }
    restoreOAuthConfig(root, true);
    console.log('LOCAL_OAUTH_RECOVERY_COMPLETE'); return;
  }
  if (['approve', 'existing', 'administrator', 'verify'].includes(action)) return accountAction(action);
  if (action !== 'start' || !process.stdin.isTTY || !process.stdout.isTTY) throw Error('LOCAL_PRIVATE_TERMINAL_REQUIRED');
  const { reuseFixture } = await prerequisites();
  let cancelled = false;
  let cancel;
  const cancellation = new Promise(resolve => { cancel = resolve; });
  const interrupt = () => { cancelled = true; cancel(); };
  process.on('SIGINT', interrupt); process.on('SIGTERM', interrupt);
  try { await oauthLifecycle(root, {
    start: restore => {
      start(true, restore);
      recordOAuthContainers(root, run('docker', ['ps', '-aq', '--no-trunc', '--filter', `label=com.supabase.cli.project=${PROJECT}`]).split(/\s+/).filter(Boolean));
    },
    initialize: async () => {
      if (cancelled) throw Error('LOCAL_OAUTH_CANCELLED');
      if (reuseFixture) {
        await prepareLocalGraphql({ resumeFixture: true });
        await waitForServices();
        if (!sql(reviewedSql('010-postcheck.sql')).includes('P0_V3_POSTCHECK_PASS_METADATA_ONLY')) throw Error('LOCAL_OAUTH_POSTCHECK_FAILED');
        console.log('LOCAL_OAUTH_REVIEWED_FIXTURE_RESUMED');
      } else {
        await integration();
        mkdirSync(`${root}/build/oauth`, { recursive: true });
        writeFileSync(provenancePath, JSON.stringify(provenance)); // No identities/keys/configuration values.
      }
      if (cancelled) throw Error('LOCAL_OAUTH_CANCELLED');
    }, serve, closeUi: async child => {
      if (child) await closeUi(child);
      else {
        const state = oauthSession(root);
        if (state.ready) await recoverUi(state);
      }
    },
    wait: async child => {
      console.log('LOCAL_OAUTH_READY http://127.0.0.1:3000');
      console.log('브라우저에서 위 주소를 열고 OAZ Privacy Local OAuth Test로 직접 로그인하세요.');
      console.log('이 메뉴에 Secret을 입력하지 마세요. 변경 메뉴는 이 로컬 테스트 계정에만 적용됩니다.');
      const ended = Symbol('ui-exited');
      const childExit = once(child, 'exit').then(() => ended, () => ended);
      while (!cancelled) {
        const terminal = createInterface({ input: process.stdin, output: process.stdout });
        let value;
        try {
          value = await Promise.race([terminal.question(
            '\n1 로그인 증거 확인 | 2 테스트 가입 승인 | 3 기존 회원 준비 | 4 관리자 테스트 준비 | Enter 종료: '),
          childExit, cancellation]);
        } finally { terminal.close(); }
        if (value === ended) throw Error('LOCAL_OAUTH_UI_EXITED');
        if (value === undefined) break;
        try {
          const selected = oauthMenuAction(value);
          if (selected === 'stop') break;
          await accountAction(selected);
        } catch (error) {
          if (error.message === 'LOCAL_OAUTH_MENU_REQUIRED') console.log('1~4 또는 Enter를 입력하세요.');
          else if (error.message === 'LOCAL_ONE_GITHUB_TEST_ACCOUNT_REQUIRED') console.log('검증할 GitHub 계정이 아직 없거나 여러 개입니다. 브라우저 로그인 상태를 확인하세요.');
          else if (/^LOCAL_[A-Z0-9_]+$/.test(error.message)) console.error(error.message);
          else throw error;
        }
      }
    }, stop: stopOAuthContainers,
  }, process.env); }
  finally { process.off('SIGINT', interrupt); process.off('SIGTERM', interrupt); }
  console.log('LOCAL_OAUTH_STOPPED_CONFIG_RESTORED');
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (process.argv.length !== 3) throw Error('LOCAL_OAUTH_ACTION_REQUIRED');
    await main(process.argv[2]);
  } catch (error) {
    console.error(/^LOCAL_[A-Z0-9_]+$/.test(error.message) ? error.message : 'LOCAL_OAUTH_STOP_DIAGNOSTICS_SUPPRESSED');
    process.exitCode = 1;
  } finally { clearOAuthCredentials(process.env); }
}
