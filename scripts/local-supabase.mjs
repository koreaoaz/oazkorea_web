// Local-only controller. No login, link, push, remote credentials, or reset command.
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { readFileSync, existsSync, statfsSync } from 'node:fs';
import { localExecutable } from './local-executable.mjs';

export const CLI_VERSION = '2.54.11';
export const PROJECT = 'oaz-privacy-local';
export const NETWORK = 'oaz-privacy-loopback';
export const API = 'http://127.0.0.1:56321';
export function reviewedOAuthFixture(value) {
  const expected = { version: 1, project: PROJECT, syntheticAppFixture: true,
    sqlSha256: 'bea86d888eea295c5ef092b2fa0f39955d494cf4b81a304615cf3079be57ed98' };
  return !!value && Object.keys(value).length === Object.keys(expected).length &&
    Object.entries(expected).every(([key, entry]) => value[key] === entry);
}
const root = fileURLToPath(new URL('../', import.meta.url));
const services = ['db', 'auth', 'rest', 'storage', 'kong', 'imgproxy', 'pg_meta'];
const started = Date.now();
export function commandId(command, args) {
  if (command === 'supabase' && ['start', 'stop', 'status', '--version'].includes(args[0])) return `cli.${args[0].replace('--', '')}`;
  if (command === 'git') return 'git.branch';
  if (command !== 'docker') return 'unknown';
  if (['ps', 'inspect', 'restart', 'cp'].includes(args[0])) return `docker.${args[0]}`;
  if (['context', 'network'].includes(args[0]) && ['inspect', 'ls', 'create'].includes(args[1])) return `docker.${args[0]}.${args[1]}`;
  if (args[0] === 'exec') {
    for (const program of ['psql', 'pg_config', 'uname', 'chmod', 'mv']) if (args.includes(program)) return `docker.exec.${program}`;
  }
  return 'docker.other';
}
export function commandDiagnostic(command, args, result, elapsedMs) {
  const stderr = result.stderr ?? '';
  const type = result.error?.code === 'ETIMEDOUT' ? 'timeout'
    : result.error?.code === 'ENOENT' ? 'executable_missing'
      : result.signal ? 'signal'
        : /container is not ready: starting/.test(stderr) ? 'health_starting'
          : /container is not ready: unhealthy/.test(stderr) ? 'health_unhealthy'
            : /container is not running/.test(stderr) ? 'container_stopped'
              : 'nonzero_exit';
  return { command: commandId(command, args), exitCode: Number.isInteger(result.status) ? result.status : null,
    timeout: type === 'timeout', type, guard: safeCommandFailure(stderr), elapsedMs: Math.max(0, Math.round(elapsedMs)) };
}
export function containerDiagnostics(containers) {
  return services.flatMap(service => {
    const c = containers.find(c => c.Name === `/supabase_${service}_${PROJECT}`);
    if (!c) return [{ service, state: 'missing' }];
    const state = ['running', 'restarting', 'exited', 'created', 'dead', 'paused'].includes(c.State?.Status) ? c.State.Status : 'unknown';
    const health = ['healthy', 'unhealthy', 'starting'].includes(c.State?.Health?.Status) ? c.State.Health.Status : 'none';
    const image = c.Config?.Image ?? '';
    // Never include inspect's Env, health Output, labels or arbitrary image names.
    const version = /^(?:(?:public\.ecr\.aws\/supabase|supabase)\/[a-z0-9_-]+):([a-zA-Z0-9._-]+)$/.exec(image)?.[1] ?? 'unrecognized';
    return [{ service, state, health, restarts: Number.isInteger(c.RestartCount) ? c.RestartCount : null,
      oom: c.State?.OOMKilled === true, loopbackNetwork: !!c.NetworkSettings?.Networks?.[NETWORK], imageVersion: version }];
  });
}
export function reportStack() {
  try {
    const ids = run('docker', ['ps', '-aq', '--filter', `label=com.supabase.cli.project=${PROJECT}`]).split(/\s+/).filter(Boolean);
    const containers = ids.length ? JSON.parse(run('docker', ['inspect', ...ids])) : [];
    console.log('LOCAL_STACK_DIAGNOSTIC ' + JSON.stringify({ cliVersion: CLI_VERSION, elapsedMs: Date.now() - started, services: containerDiagnostics(containers) }));
  } catch { console.log('LOCAL_STACK_DIAGNOSTIC_UNAVAILABLE'); }
}
export function safeCommandFailure(stderr = '') {
  const guard = (stderr ?? '').match(/ERROR:\s+(P0_STOP:[^\r\n]+)/i)?.[1];
  if (guard) return 'LOCAL_SQL_GUARD_' + createHash('sha256').update(guard).digest('hex').slice(0, 12);
  if (/GLIBC_.*not found|incompatible library|could not load library|undefined symbol/i.test(stderr ?? '')) return 'LOCAL_EXTENSION_ABI';
  if (/must be superuser|permission denied|must be owner/i.test(stderr ?? '')) return 'LOCAL_SQL_PERMISSION';
  if (/dependent objects still exist|cannot drop extension.*other objects depend/i.test(stderr ?? '')) return 'LOCAL_EXTENSION_DEPENDENCY';
  return 'LOCAL_STACK_COMMAND_FAILED';
}
export function safeStartFailure(error) {
  const allowed = ['LOCAL_NETWORK_REQUIRED', 'LOCAL_CONTAINERS_MISSING', 'LOCAL_DATABASE_REQUIRED',
    'HOST_NETWORK_FORBIDDEN', 'NON_LOOPBACK_BINDING', 'LOCAL_TARGET_REQUIRED', 'LOCAL_KEYS_MISSING',
    'LOCAL_STACK_COMMAND_FAILED', 'LOCAL_DISK_RESERVE_REQUIRED', 'LOCAL_BINDING_PROBE_ID', 'LOCAL_WINDOWS_BINDING_REQUIRED'];
  return allowed.includes(error?.message) ? error.message : 'LOCAL_START_UNCLASSIFIED';
}
export function requireLocalDiskReserve(stats = statfsSync(root)) {
  const available = stats.bavail * stats.bsize;
  if (!Number.isFinite(available) || available <= 12 * 1024 ** 3) throw Error('LOCAL_DISK_RESERVE_REQUIRED');
}
export function verifyBindingProbe(ports) {
  const bindings = ports?.['9999/tcp'];
  if (!Array.isArray(bindings) || !bindings.length || bindings.some(binding =>
    !isLoopbackBinding(binding?.HostIp) || !/^[0-9]+$/.test(binding?.HostPort ?? ''))) throw Error('NON_LOOPBACK_BINDING');
}
// Docker Desktop's localhost-only publishing includes IPv6 localhost. Accept
// these two exact addresses; wildcard, LAN and mapped addresses remain denied.
function isLoopbackBinding(address) { return address === '127.0.0.1' || address === '::1'; }
export function localCommandEnvironment(inherited = process.env) {
  return Object.fromEntries(Object.entries(inherited).filter(([key]) =>
    !/SUPABASE|^PG|^DATABASE|^POSTGRES|^OAZ_|^NEXT_PUBLIC_|^DOCKER_HOST$|^DOCKER_CONTEXT$|^GITHUB_|^VERCEL|^NODE_OPTIONS$/i.test(key)));
}
export function verifyWindowsListeners(listeners, ports) {
  if (!Array.isArray(ports) || !ports.length || ports.some(port => !Number.isInteger(port) || port < 1 || port > 65535) ||
      !Array.isArray(listeners) || ports.some(port => {
        const matches = listeners.filter(row => row?.LocalPort === port);
        return !matches.length || matches.some(row => !isLoopbackBinding(row.LocalAddress));
      })) throw Error('LOCAL_WINDOWS_BINDING_REQUIRED');
}
function verifyWindowsPublishedBindings(bindings) {
  if (process.platform !== 'win32') return;
  const ports = [...new Set(bindings.map(binding => Number(binding.HostPort)))];
  // Validate numeric input before embedding it in the fixed, read-only command.
  if (!ports.length || ports.some(port => !Number.isInteger(port) || port < 1 || port > 65535)) throw Error('LOCAL_WINDOWS_BINDING_REQUIRED');
  const command = `$ErrorActionPreference='Stop'; $required=@(${ports.join(',')}); ` +
    '$rows=@(Get-NetTCPConnection -State Listen -ErrorAction Stop | Where-Object {$_.LocalPort -in $required} | Select-Object LocalAddress,LocalPort); ' +
    'ConvertTo-Json -InputObject $rows -Compress';
  const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command],
    { env: localCommandEnvironment(), encoding: 'utf8', windowsHide: true, timeout: 20000 });
  if (result.error || result.status !== 0) throw Error('LOCAL_WINDOWS_BINDING_REQUIRED');
  let rows;
  try { rows = JSON.parse(result.stdout); } catch { throw Error('LOCAL_WINDOWS_BINDING_REQUIRED'); }
  verifyWindowsListeners(rows, ports);
  console.log('LOCAL_WINDOWS_BINDING_PASS ports=' + ports.length);
}
export function preflightBindings() {
  requireLocalDiskReserve();
  assertDockerEndpoint(JSON.parse(run('docker', ['context', 'inspect']))[0]?.Endpoints?.docker?.Host);
  const names = run('docker', ['network', 'ls', '--filter', `name=^${NETWORK}$`, '--format', '{{.Name}}']);
  if (!names) run('docker', ['network', 'create', '-o', 'com.docker.network.bridge.host_binding_ipv4=127.0.0.1', NETWORK]);
  verifyNetwork(JSON.parse(run('docker', ['network', 'inspect', NETWORK]))[0]);
  // Test the actual Desktop port forwarder BEFORE starting DB/Auth or using a
  // provider secret. The probe runs only sleep: no listener, data or credentials.
  const image = 'public.ecr.aws/supabase/gotrue:v2.180.0';
  if (!run('docker', ['image', 'ls', image, '-q'])) run('docker', ['pull', image]);
  let id;
  try {
    id = run('docker', ['run', '--rm', '-d', '--label', 'oaz.privacy.binding-probe=1', '--network', NETWORK,
      '--publish', '9999/tcp', '--entrypoint', '/bin/sh', image, '-c', 'sleep 60']);
    if (!/^[a-f0-9]{64}$/.test(id)) throw Error('LOCAL_BINDING_PROBE_ID');
    const ports = JSON.parse(run('docker', ['inspect', '--format', '{{json .NetworkSettings.Ports}}', id]));
    verifyBindingProbe(ports);
    verifyWindowsPublishedBindings(ports['9999/tcp']);
  } finally {
    // Exact ID returned by our own create; never discover/delete another asset.
    if (/^[a-f0-9]{64}$/.test(id ?? '') && run('docker', ['ps', '-aq', '--filter', `id=${id}`])) run('docker', ['rm', '--force', id]);
  }
}
export function run(command, args, input, oauth = false) {
  const env = localCommandEnvironment();
  if (oauth) {
    if (command !== 'supabase' || args[0] !== 'start') throw Error('LOCAL_OAUTH_START_ONLY');
    for (const name of ['GITHUB_TEST_CLIENT_ID', 'GITHUB_TEST_CLIENT_SECRET']) {
      if (!process.env[name]) throw Error('LOCAL_OAUTH_CREDENTIAL_REQUIRED');
      env[name] = process.env[name];
    }
  }
  const before = Date.now();
  const timeout = command === 'supabase' && args[0] === 'start' ? 600000 : 120000;
  const r = spawnSync(localExecutable(command), args, { cwd: root, env, input, encoding: 'utf8', timeout, maxBuffer: 16 * 1024 * 1024, windowsHide: true });
  if (r.error || r.status !== 0) {
    const diagnostic = commandDiagnostic(command, args, r, Date.now() - before);
    console.error('LOCAL_COMMAND_DIAGNOSTIC ' + JSON.stringify(diagnostic));
    const error = Error(diagnostic.guard);
    error.diagnostic = diagnostic;
    throw error;
  }
  return r.stdout.trim(); // never print command output: status contains local credentials
}
export function cli(args) { return run('supabase', args); }
export function assertLocalUrl(value) {
  if (value !== API) throw Error('LOCAL_TARGET_REQUIRED');
}
export function verifyNetwork(network) {
  if (network.Name !== NETWORK || network.Driver !== 'bridge' ||
      network.Options?.['com.docker.network.bridge.host_binding_ipv4'] !== '127.0.0.1') throw Error('LOCAL_NETWORK_REQUIRED');
}
export function verifyBindings(containers) {
  if (!containers.length) throw Error('LOCAL_CONTAINERS_MISSING');
  for (const c of containers) {
    if (c.HostConfig?.NetworkMode === 'host') throw Error('HOST_NETWORK_FORBIDDEN');
    if (!c.NetworkSettings?.Networks?.[NETWORK]) throw Error('LOCAL_NETWORK_REQUIRED');
    for (const bindings of Object.values(c.NetworkSettings?.Ports ?? {})) {
      for (const binding of bindings ?? []) {
        if (!isLoopbackBinding(binding.HostIp)) throw Error('NON_LOOPBACK_BINDING');
      }
    }
  }
}
export function assertDockerEndpoint(endpoint) {
  if (!/^npipe:\/\/\/\/\.\/pipe\/[a-zA-Z0-9_.-]+$/.test(endpoint ?? '') && !endpoint?.startsWith('unix:///')) throw Error('LOCAL_DOCKER_REQUIRED');
}
export function inspectStack() {
  assertDockerEndpoint(JSON.parse(run('docker', ['context', 'inspect']))[0]?.Endpoints?.docker?.Host);
  const ids = run('docker', ['ps', '-aq', '--filter', `label=com.supabase.cli.project=${PROJECT}`]).split(/\s+/).filter(Boolean);
  if (!ids.length) throw Error('LOCAL_CONTAINERS_MISSING');
  const containers = JSON.parse(run('docker', ['inspect', ...ids]));
  verifyBindings(containers);
  if (!containers.some(c => c.Name === `/supabase_db_${PROJECT}`)) throw Error('LOCAL_DATABASE_REQUIRED');
  return containers;
}
export function localStatus() {
  inspectStack();
  let status;
  try { status = JSON.parse(cli(['status', '-o', 'json'])); }
  catch (error) { reportStack(); throw error; }
  assertLocalUrl(status.API_URL);
  if (!status.ANON_KEY || !status.SERVICE_ROLE_KEY) throw Error('LOCAL_KEYS_MISSING');
  return status;
}
export function readiness(containers, scope) {
  if (!['database', 'services'].includes(scope)) throw Error('LOCAL_READINESS_SCOPE');
  const required = scope === 'database' ? ['db'] : ['db', 'auth', 'rest', 'storage', 'kong'];
  const states = containerDiagnostics(containers);
  const pending = [];
  for (const service of required) {
    const c = states.find(c => c.service === service);
    if (c.state === 'missing') throw Error('LOCAL_REQUIRED_SERVICE_MISSING');
    if (!c.loopbackNetwork) throw Error('LOCAL_NETWORK_REQUIRED');
    if (c.oom || ['dead', 'exited', 'paused', 'unknown'].includes(c.state)) throw Error('LOCAL_SERVICE_TERMINATED');
    if (c.health === 'unhealthy') throw Error('LOCAL_SERVICE_UNHEALTHY');
    if (service !== 'rest' && c.health === 'none') throw Error('LOCAL_HEALTHCHECK_REQUIRED');
    if (c.state !== 'running' || c.health === 'starting') pending.push(service);
  }
  return { ready: pending.length === 0, pending };
}
export async function waitForReadiness(probe, { scope, timeoutMs = 60000, now = Date.now,
  delay = ms => new Promise(resolve => setTimeout(resolve, ms)), emit = console.log } = {}) {
  if (!['database', 'services'].includes(scope)) throw Error('LOCAL_READINESS_SCOPE');
  const since = now();
  let attempts = 0;
  while (true) {
    const state = await probe();
    attempts++;
    if (!state || typeof state.ready !== 'boolean' || !Array.isArray(state.pending) ||
        state.pending.some(s => !['db', 'auth', 'rest', 'storage', 'kong'].includes(s))) throw Error('LOCAL_READINESS_RESULT');
    if (state.ready && state.pending.length === 0) {
      emit('LOCAL_READINESS_PASS ' + JSON.stringify({ scope, attempts, elapsedMs: now() - since }));
      return;
    }
    if (now() - since >= timeoutMs) throw Error('LOCAL_READINESS_TIMEOUT');
    // Poll actual state; elapsed sleep alone never authorizes the next step.
    await delay(Math.min(500, timeoutMs - (now() - since)));
  }
}
export async function waitForDatabase() {
  await waitForReadiness(() => {
    const state = readiness(inspectStack(), 'database');
    if (state.ready && sql('SELECT 1;') !== '1') throw Error('LOCAL_DATABASE_PROBE_FAILED');
    return state;
  }, { scope: 'database' });
}
export async function serviceProbe(status, fetcher = globalThis.fetch) {
  assertLocalUrl(status.API_URL);
  const pending = [];
  for (const [service, path] of [['auth', '/auth/v1/health'], ['rest', '/rest/v1/'], ['storage', '/storage/v1/status']]) {
    try {
      const response = await fetcher(API + path, { headers: { apikey: status.ANON_KEY, Authorization: `Bearer ${status.ANON_KEY}` },
        redirect: 'error', signal: AbortSignal.timeout(3000) });
      await response.body?.cancel();
      if (response.status === 200) continue;
      if ([502, 503, 504].includes(response.status)) { pending.push(service); continue; }
      throw Error('LOCAL_SERVICE_PROBE_REJECTED');
    } catch (error) {
      if (error.message === 'LOCAL_SERVICE_PROBE_REJECTED') throw error;
      if (['TimeoutError', 'AbortError'].includes(error.name) || ['ECONNREFUSED', 'ECONNRESET', 'UND_ERR_SOCKET'].includes(error.cause?.code)) pending.push(service);
      else throw Error('LOCAL_SERVICE_PROBE_FAILED');
    }
  }
  return { ready: pending.length === 0, pending };
}
export async function waitForServices() {
  let status;
  await waitForReadiness(async () => {
    const state = readiness(inspectStack(), 'services');
    if (!state.ready) return state;
    status = localStatus();
    return serviceProbe(status);
  }, { scope: 'services' });
  reportStack();
  return status;
}
export function sql(text) {
  inspectStack();
  return run('docker', ['exec', '-i', `supabase_db_${PROJECT}`, 'psql', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', 'postgres'], text);
}
export function reviewedSql(name) {
  return readFileSync(new URL(`../reports/main-safety/integration/sql/${name}`, import.meta.url), 'utf8');
}
export function verifyRelease() {
  const bytes = readFileSync(new URL('../reports/main-safety/integration/sql/010-privacy-minimal.sql', import.meta.url));
  if (createHash('sha256').update(bytes).digest('hex') !== 'bea86d888eea295c5ef092b2fa0f39955d494cf4b81a304615cf3079be57ed98') throw Error('REVIEWED_SQL_CHANGED');
}
export function stop() {
  assertDockerEndpoint(JSON.parse(run('docker', ['context', 'inspect']))[0]?.Endpoints?.docker?.Host);
  cli(['stop']);
  const running = run('docker', ['ps', '-q', '--filter', `label=com.supabase.cli.project=${PROJECT}`]);
  if (running) throw Error('LOCAL_CONTAINERS_STILL_RUNNING');
}
export function start(oauth = false, afterStart = () => {}) {
  if (run('git', ['branch', '--show-current']) !== 'hotfix/privacy-p0') throw Error('HOTFIX_BRANCH_REQUIRED');
  if (existsSync(new URL('../supabase/.temp/project-ref', import.meta.url))) throw Error('LINKED_PROJECT_FORBIDDEN');
  if (cli(['--version']) !== CLI_VERSION) throw Error('PINNED_CLI_REQUIRED');
  assertDockerEndpoint(JSON.parse(run('docker', ['context', 'inspect']))[0]?.Endpoints?.docker?.Host);
  preflightBindings(); // Existing networks are verified; do not trust defaults.
  try {
    run('supabase', ['start', '--network-id', NETWORK], undefined, oauth);
    afterStart(); // OAuth launcher restores the secret-free default config before status/stop.
    localStatus();
    verifyWindowsPublishedBindings(inspectStack().flatMap(container =>
      Object.values(container.NetworkSettings?.Ports ?? {}).flatMap(bindings => bindings ?? [])));
  } catch (error) {
    // Shut down this project only if exposure/readiness verification fails.
    console.error('LOCAL_START_DIAGNOSTIC ' + JSON.stringify({ guard: safeStartFailure(error) }));
    try { stop(); } catch { /* report failure without leaking output */ }
    throw Error('LOCAL_START_OR_BINDING_CHECK_FAILED');
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (process.argv.length !== 3 || !['start', 'check', 'stop'].includes(process.argv[2])) throw Error('LOCAL_ACTION_REQUIRED');
    if (process.argv[2] === 'start') start();
    else if (process.argv[2] === 'check') localStatus();
    else stop();
    console.log('LOCAL_STACK_PASS');
  } catch (error) {
    console.error('LOCAL_STACK_STOP ' + JSON.stringify({ guard: safeStartFailure(error) }));
    process.exitCode = 1;
  }
}
