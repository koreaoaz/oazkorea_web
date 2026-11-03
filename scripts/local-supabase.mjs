// Local-only controller. No login, link, push, remote credentials, or reset command.
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';

export const CLI_VERSION = '2.54.11';
export const PROJECT = 'oaz-privacy-local';
export const NETWORK = 'oaz-privacy-loopback';
export const API = 'http://127.0.0.1:56321';
const root = fileURLToPath(new URL('../', import.meta.url));
export function safeCommandFailure(stderr = '') {
  const guard = (stderr ?? '').match(/ERROR:\s+(P0_STOP:[^\r\n]+)/i)?.[1];
  if (guard) return 'LOCAL_SQL_GUARD_' + createHash('sha256').update(guard).digest('hex').slice(0, 12);
  if (/GLIBC_.*not found|incompatible library|could not load library|undefined symbol/i.test(stderr ?? '')) return 'LOCAL_EXTENSION_ABI';
  if (/must be superuser|permission denied|must be owner/i.test(stderr ?? '')) return 'LOCAL_SQL_PERMISSION';
  if (/dependent objects still exist|cannot drop extension.*other objects depend/i.test(stderr ?? '')) return 'LOCAL_EXTENSION_DEPENDENCY';
  return 'LOCAL_STACK_COMMAND_FAILED';
}
export function run(command, args, input) {
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/SUPABASE|^PG|^DATABASE|^POSTGRES|^OAZ_|^NEXT_PUBLIC_|^DOCKER_HOST$|^DOCKER_CONTEXT$/.test(key)));
  const r = spawnSync(command, args, { cwd: root, env, input, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, windowsHide: true });
  if (r.error || r.status !== 0) throw Error(safeCommandFailure(r.stderr));
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
        if (binding.HostIp !== '127.0.0.1') throw Error('NON_LOOPBACK_BINDING');
      }
    }
  }
}
export function assertDockerEndpoint(endpoint) {
  if (!endpoint?.startsWith('npipe://') && !endpoint?.startsWith('unix:///')) throw Error('LOCAL_DOCKER_REQUIRED');
}
export function inspectStack() {
  assertDockerEndpoint(JSON.parse(run('docker', ['context', 'inspect']))[0]?.Endpoints?.docker?.Host);
  const ids = run('docker', ['ps', '-q', '--filter', `label=com.supabase.cli.project=${PROJECT}`]).split(/\s+/).filter(Boolean);
  if (!ids.length) throw Error('LOCAL_CONTAINERS_MISSING');
  const containers = JSON.parse(run('docker', ['inspect', ...ids]));
  verifyBindings(containers);
  if (!containers.some(c => c.Name === `/supabase_db_${PROJECT}`)) throw Error('LOCAL_DATABASE_REQUIRED');
  return containers;
}
export function localStatus() {
  inspectStack();
  const status = JSON.parse(cli(['status', '-o', 'json']));
  assertLocalUrl(status.API_URL);
  if (!status.ANON_KEY || !status.SERVICE_ROLE_KEY) throw Error('LOCAL_KEYS_MISSING');
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
export function start() {
  if (run('git', ['branch', '--show-current']) !== 'hotfix/privacy-p0') throw Error('HOTFIX_BRANCH_REQUIRED');
  if (existsSync(new URL('../supabase/.temp/project-ref', import.meta.url))) throw Error('LINKED_PROJECT_FORBIDDEN');
  if (cli(['--version']) !== CLI_VERSION) throw Error('PINNED_CLI_REQUIRED');
  assertDockerEndpoint(JSON.parse(run('docker', ['context', 'inspect']))[0]?.Endpoints?.docker?.Host);
  // Existing networks must be verified, not silently reused or modified.
  const names = run('docker', ['network', 'ls', '--filter', `name=^${NETWORK}$`, '--format', '{{.Name}}']);
  if (!names) run('docker', ['network', 'create', '-o', 'com.docker.network.bridge.host_binding_ipv4=127.0.0.1', NETWORK]);
  verifyNetwork(JSON.parse(run('docker', ['network', 'inspect', NETWORK]))[0]);
  try {
    cli(['start', '--network-id', NETWORK]);
    localStatus();
  } catch {
    // Shut down this project only if exposure/readiness verification fails.
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
  } catch { console.error('LOCAL_STACK_STOP: prerequisites, local binding or health check failed'); process.exitCode = 1; }
}
