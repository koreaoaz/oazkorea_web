// Re-run the real fresh-stack suite without resetting the operator's fixture.
// Only the project identifier differs in the temporary, hash-checked script copy.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, realpathSync, lstatSync, rmSync } from 'node:fs';
import { dirname, join, delimiter, basename } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { API, PROJECT, run, requireLocalDiskReserve, localCommandEnvironment, assertDockerEndpoint } from './local-supabase.mjs';
import { localExecutable } from './local-executable.mjs';
import { requireUnusedPort } from './local-oauth.mjs';
import { checkReleaseAssets } from './check-production-release.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
export const REVIEW_PROJECT = 'oaz-privacy-local-review';
export function reviewProjectCopy(source, kind) {
  const before = kind === 'script' ? `export const PROJECT = '${PROJECT}';` : `project_id = "${PROJECT}"`;
  const after = kind === 'script' ? `export const PROJECT = '${REVIEW_PROJECT}';` : `project_id = "${REVIEW_PROJECT}"`;
  if (!['script', 'config'].includes(kind) || source.split(before).length !== 2) throw Error('LOCAL_REVIEW_COPY_REQUIRED');
  const result = source.replace(before, after);
  if (result.replace(after, before) !== source) throw Error('LOCAL_REVIEW_COPY_REQUIRED');
  return result;
}
async function main() {
  requireLocalDiskReserve();
  if (run('git', ['branch', '--show-current']) !== 'hotfix/privacy-p0') throw Error('LOCAL_REVIEW_BRANCH_REQUIRED');
  assertDockerEndpoint(JSON.parse(run('docker', ['context', 'inspect']))[0]?.Endpoints?.docker?.Host);
  checkReleaseAssets(); // Includes default config, frozen SQL and no linked target.
  if (process.env.GITHUB_TEST_CLIENT_ID || process.env.GITHUB_TEST_CLIENT_SECRET) throw Error('LOCAL_REVIEW_CREDENTIALS_FORBIDDEN');
  const volumes = ['db', 'config', 'storage'].map(service => `supabase_${service}_${REVIEW_PROJECT}`);
  if (run('docker', ['ps', '-aq', '--filter', `label=com.supabase.cli.project=${REVIEW_PROJECT}`]) ||
      run('docker', ['volume', 'ls', '-q', '--filter', `label=com.supabase.cli.project=${REVIEW_PROJECT}`]) ||
      run('docker', ['volume', 'ls', '-q']).split(/\s+/).some(name => volumes.includes(name))) throw Error('LOCAL_REVIEW_EXISTING_ASSET_PRESERVED');
  for (const port of [3000, 56320, 56321, 56322]) await requireUnusedPort(port);
  const parent = join(realpathSync(root), 'build');
  mkdirSync(parent, { recursive: true });
  if (lstatSync(parent).isSymbolicLink() || realpathSync(parent) !== parent) throw Error('LOCAL_REVIEW_PATH_REQUIRED');
  const stage = mkdtempSync(join(parent, 'fresh-review-'));
  const scripts = ['local-supabase.mjs', 'local-executable.mjs', 'prepare-local-graphql.mjs', 'test-local-supabase.mjs', 'storage-rca.mjs'];
  const sqlNames = JSON.parse(readFileSync(join(root, 'reports/privacy-hotfix/RC_SQL_HASHES.json'), 'utf8'));
  const sqlFiles = Array.isArray(sqlNames) ? sqlNames.map(entry => entry.file) : Object.keys(sqlNames);
  // Copy the explicit reviewed source tree; never copy dotenv, credentials,
  // node_modules, user data or Git metadata. Dependencies resolve in the ancestor.
  const files = [...scripts.map(name => `scripts/${name}`), 'tests/fixtures/privacy.sql', 'supabase/config.toml',
    ...sqlFiles.map(name => `reports/main-safety/integration/sql/${basename(name)}`)];
  let phase = 'copy';
  let mayHaveStarted = false;
  let passed = false;
  const env = localCommandEnvironment();
  const inheritedPath = Object.entries(env).find(([key]) => key.toUpperCase() === 'PATH')?.[1] ?? '';
  // Windows environment keys are case-insensitive; keep exactly one PATH alias.
  for (const key of Object.keys(env)) if (key.toUpperCase() === 'PATH') delete env[key];
  env.PATH = dirname(localExecutable('supabase')) + delimiter + inheritedPath;
  function child(script, action, marker) {
    const result = spawnSync(process.execPath, [join(stage, 'scripts', script), ...(action ? [action] : [])],
      { cwd: stage, env, encoding: 'utf8', timeout: 600000, maxBuffer: 16 * 1024 * 1024, windowsHide: true });
    if (result.error || result.status !== 0 || marker && !result.stdout.split(/\r?\n/).includes(marker)) throw Error('LOCAL_REVIEW_CHILD_FAILED');
    return result.stdout;
  }
  try {
    for (const file of files) {
      const source = join(root, file);
      if (lstatSync(source).isSymbolicLink()) throw Error('LOCAL_REVIEW_SOURCE_LINK');
      const bytes = readFileSync(source);
      let copied = bytes;
      if (file === 'scripts/local-supabase.mjs' || file === 'supabase/config.toml') {
        copied = Buffer.from(reviewProjectCopy(bytes.toString('utf8'), file.startsWith('scripts/') ? 'script' : 'config'));
      }
      const target = join(stage, file);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, copied, { flag: 'wx' });
      if (createHash('sha256').update(readFileSync(target)).digest('hex') !== createHash('sha256').update(copied).digest('hex')) throw Error('LOCAL_REVIEW_COPY_HASH');
    }
    phase = 'start'; mayHaveStarted = true;
    child('local-supabase.mjs', 'start', 'LOCAL_STACK_PASS');
    console.log('LOCAL_FRESH_REVIEW_STAGE_PASS phase=start');
    phase = 'integration';
    const output = child('test-local-supabase.mjs', null, 'LOCAL_SUPABASE_INTEGRATION_PASS checks=95');
    if (!output.includes('LOCAL_GRAPHQL_LOADED_BINARY_PASS {"mappedFile":true,"inode":true,"officialHash":true}')) throw Error('LOCAL_REVIEW_LOADED_BINARY_REQUIRED');
    passed = true;
  } catch {
    console.error('LOCAL_FRESH_REVIEW_STOP phase=' + phase); process.exitCode = 1;
  } finally {
    let clean = true;
    try {
      if (mayHaveStarted) child('local-supabase.mjs', 'stop', 'LOCAL_STACK_PASS');
      if (run('docker', ['ps', '-aq', '--filter', `label=com.supabase.cli.project=${REVIEW_PROJECT}`])) throw Error('LOCAL_REVIEW_CONTAINER_REMAINS');
      for (const name of volumes) {
        if (!run('docker', ['volume', 'ls', '-q']).split(/\s+/).includes(name)) continue;
        const volume = JSON.parse(run('docker', ['volume', 'inspect', name]))[0];
        if (volume.Name !== name || volume.Labels?.['com.supabase.cli.project'] !== REVIEW_PROJECT ||
            run('docker', ['ps', '-aq', '--filter', `volume=${name}`])) throw Error('LOCAL_REVIEW_VOLUME_OWNER');
        run('docker', ['volume', 'rm', name]); // Only this invocation's new namespace.
      }
      if (run('docker', ['volume', 'ls', '-q', '--filter', `label=com.supabase.cli.project=${REVIEW_PROJECT}`])) throw Error('LOCAL_REVIEW_VOLUME_REMAINS');
      const resolved = realpathSync(stage);
      if (dirname(resolved) !== parent || !basename(resolved).startsWith('fresh-review-')) throw Error('LOCAL_REVIEW_PATH_REQUIRED');
      rmSync(resolved, { recursive: true });
    } catch { clean = false; process.exitCode = 1; }
    console.log(clean ? 'LOCAL_FRESH_REVIEW_CLEANUP_PASS' : 'LOCAL_FRESH_REVIEW_CLEANUP_FAILED');
    if (passed && clean) console.log(`LOCAL_FRESH_REVIEW_PASS checks=95 project=${REVIEW_PROJECT} originalFixturePreserved=true api=${API}`);
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { if (process.argv.length !== 2) throw Error('LOCAL_REVIEW_ARGUMENTS'); await main(); }
  catch { console.error('LOCAL_FRESH_REVIEW_PREREQUISITES_STOP'); process.exitCode = 1; }
}
