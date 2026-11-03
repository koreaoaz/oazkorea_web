// Installs an official hash-pinned extension in the disposable LOCAL container only.
import { createHash, randomUUID } from 'node:crypto';
import { zstdDecompressSync } from 'node:zlib';
import { mkdtempSync, writeFileSync, rmSync, realpathSync, readFileSync, mkdirSync, lstatSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname, basename } from 'node:path';
import { localStatus, run, sql, PROJECT, NETWORK, inspectStack, waitForDatabase, waitForServices, reportStack, reviewedOAuthFixture, reviewedSql } from './local-supabase.mjs';

export const GRAPHQL_ASSET = 'https://github.com/supabase/pg_graphql/releases/download/v1.6.3/pg_graphql-v1.6.3-pg17-amd64-linux-gnu.deb';
export const GRAPHQL_SHA = 'e827939c60bd1e0b861bf30206d04a274e354b1f8942d36fe4b7cd8889f4dc84';
let preparationPhase = 'fresh-check';
export function graphqlPreparationPhase() { return preparationPhase; }
const wanted = {
  './usr/lib/postgresql/lib/pg_graphql.so': 'pg_graphql.so',
  './var/lib/postgresql/extension/pg_graphql--1.6.3.sql': 'pg_graphql--1.6.3.sql',
  './var/lib/postgresql/extension/pg_graphql.control': 'pg_graphql.control',
};
const root = fileURLToPath(new URL('../', import.meta.url));
export function verifyGraphqlContainer(container) {
  const mounts = container?.Mounts;
  const expected = new Map([[`supabase_db_${PROJECT}`, '/var/lib/postgresql/data'],
    [`supabase_config_${PROJECT}`, '/etc/postgresql-custom']]);
  if (container?.Name !== `/supabase_db_${PROJECT}` ||
      container.Config?.Labels?.['com.supabase.cli.project'] !== PROJECT ||
      container.Config?.Image !== 'public.ecr.aws/supabase/postgres:17.6.1.029' ||
      !Array.isArray(mounts) || mounts.length !== expected.size ||
      mounts.some(m => m.Type !== 'volume' || expected.get(m.Name) !== m.Destination) ||
      new Set(mounts.map(m => m.Name)).size !== expected.size) throw Error('LOCAL_GRAPHQL_CONTAINER_REQUIRED');
}
export function verifyLoadedGraphql(maps, path, inode) {
  if (!/^[1-9][0-9]*$/.test(inode ?? '') || !path?.endsWith('/pg_graphql.so')) throw Error('LOCAL_GRAPHQL_MAPPING_REQUIRED');
  validateContainerPgPath(dirname(path));
  const rows = maps.split(/\r?\n/).filter(line => /\/pg_graphql(?:-[a-zA-Z0-9._-]+)?\.so(?:\s|$)/.test(line));
  if (!rows.length || rows.some(line => {
    const fields = line.trim().split(/\s+/);
    return fields.length !== 6 || fields[4] !== inode || fields[5] !== path;
  }) || !rows.some(line => line.trim().split(/\s+/)[1] === 'r-xp')) throw Error('LOCAL_GRAPHQL_MAPPING_REQUIRED');
}
async function backendProbe(loadedLibrary, expectedHash) {
  const container = `supabase_db_${PROJECT}`;
  const app = 'oaz_graphql_probe_' + randomUUID().replaceAll('-', '');
  const query = loadedLibrary
    ? "DO $$ BEGIN IF graphql.resolve('{ __typename }') #>> '{data,__typename}' IS DISTINCT FROM 'Query' THEN RAISE EXCEPTION 'LOCAL_GRAPHQL_QUERY_REQUIRED'; END IF; END $$; SELECT pg_sleep(30);"
    : 'SELECT pg_sleep(30);';
  try {
    // A short, owned connection keeps the actual backend alive while /proc is
    // inspected. SQL is fixed and contains neither credentials nor user data.
    run('docker', ['exec', '-d', container, 'env', `PGAPPNAME=${app}`, 'psql', '-X', '-qAt',
      '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-c', query]);
    let pid;
    for (let attempt = 0; attempt < 20; attempt++) {
      const value = sql(`SELECT pid FROM pg_stat_activity WHERE application_name='${app}' AND usename='postgres' AND datname='postgres' AND wait_event='PgSleep';`);
      if (/^[1-9][0-9]*$/.test(value)) { pid = value; break; }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    if (!pid) throw Error('LOCAL_GRAPHQL_BACKEND_REQUIRED');
    const executable = run('docker', ['exec', '--user', 'postgres', container, 'readlink', '-f', `/proc/${pid}/exe`]);
    if (loadedLibrary) {
      const canonical = run('docker', ['exec', container, 'readlink', '-f', loadedLibrary]);
      if (canonical !== loadedLibrary) throw Error('LOCAL_GRAPHQL_MAPPING_REQUIRED');
      const inode = run('docker', ['exec', container, 'stat', '-Lc', '%i', loadedLibrary]);
      const maps = run('docker', ['exec', '--user', 'postgres', container, 'cat', `/proc/${pid}/maps`]);
      verifyLoadedGraphql(maps, canonical, inode);
      if (run('docker', ['exec', container, 'sha256sum', canonical]).split(/\s+/)[0] !== expectedHash) throw Error('LOCAL_GRAPHQL_INSTALLED_HASH');
      console.log('LOCAL_GRAPHQL_LOADED_BINARY_PASS ' + JSON.stringify({ mappedFile: true, inode: true, officialHash: true }));
    }
    return executable;
  } finally {
    // Exact random application name and local DB/user, never a PID discovered
    // from a port or a pre-existing application connection.
    sql(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE application_name='${app}' AND usename='postgres' AND datname='postgres';`);
    if (sql(`SELECT count(*) FROM pg_stat_activity WHERE application_name='${app}';`) !== '0') throw Error('LOCAL_GRAPHQL_BACKEND_CLEANUP_REQUIRED');
  }
}
export function unpackReviewedGraphql(bytes) {
  if (createHash('sha256').update(bytes).digest('hex') !== GRAPHQL_SHA) throw Error('LOCAL_GRAPHQL_INTEGRITY');
  if (bytes.subarray(0, 8).toString() !== '!<arch>\n') throw Error('LOCAL_GRAPHQL_ARCHIVE');
  let tar;
  for (let offset = 8; offset < bytes.length;) {
    const header = bytes.subarray(offset, offset + 60);
    const name = header.subarray(0, 16).toString().trim().replace(/\/$/, '');
    const size = Number(header.subarray(48, 58).toString());
    if (!Number.isSafeInteger(size) || size < 0 || offset + 60 + size > bytes.length) throw Error('LOCAL_GRAPHQL_ARCHIVE');
    if (name === 'data.tar.zst') tar = zstdDecompressSync(bytes.subarray(offset + 60, offset + 60 + size), { maxOutputLength: 32 * 1024 * 1024 });
    offset += 60 + size + size % 2;
  }
  if (!tar) throw Error('LOCAL_GRAPHQL_ARCHIVE');
  const files = {};
  for (let offset = 0; offset + 512 <= tar.length && tar[offset];) {
    const header = tar.subarray(offset, offset + 512);
    const name = header.subarray(0, 100).toString().split('\0')[0];
    const size = parseInt(header.subarray(124, 136).toString().replaceAll('\0', '').trim() || '0', 8);
    if (!Number.isSafeInteger(size) || size < 0 || offset + 512 + size > tar.length) throw Error('LOCAL_GRAPHQL_ARCHIVE');
    // Extract exactly three regular files. Never follow archive paths or links.
    if (wanted[name] && header[156] === 48) files[wanted[name]] = tar.subarray(offset + 512, offset + 512 + size);
    offset += 512 + Math.ceil(size / 512) * 512;
  }
  if (Object.keys(files).length !== 3 || files['pg_graphql.so'].subarray(0, 4).toString('hex') !== '7f454c46' ||
      !files['pg_graphql.control'].toString().includes("default_version = '1.6.3'")) throw Error('LOCAL_GRAPHQL_CONTENTS');
  return files;
}
export function validateContainerPgPath(value) {
  // Official supabase/postgres:17.6.1.029 is Nix-based. pg_config returns
  // absolute /nix/store paths rather than its compatibility /usr symlinks.
  const normal = /^\/(?:usr|opt)\/[a-zA-Z0-9_./-]+$/.test(value);
  const nix = /^\/nix\/store\/[a-z0-9]{32}-[a-zA-Z0-9+._-]+\/(?:lib|share)(?:\/postgresql)?$/.test(value);
  if ((!normal && !nix) || value.split('/').some(part => part === '..' || part === '.')) throw Error('LOCAL_PG_PATH_REQUIRED');
  return value;
}
export function serverLibraryPath(compiled, executable) {
  validateContainerPgPath(compiled);
  // The Nix image's pg_config belongs to plain PostgreSQL, but the running
  // server belongs to postgresql-and-plugins and resolves $libdir there.
  if (compiled.startsWith('/nix/store/')) {
    if (!/^\/nix\/store\/[a-z0-9]{32}-postgresql-and-plugins-17\.[0-9]+\/bin\/(?:postgres|\.postgres-wrapped)$/.test(executable)) throw Error('LOCAL_PG_SERVER_PATH_REQUIRED');
    return validateContainerPgPath(executable.replace(/\/bin\/(?:postgres|\.postgres-wrapped)$/, '/lib'));
  }
  return compiled;
}
export async function prepareLocalGraphql({ resumeFixture = false } = {}) {
  preparationPhase = 'fresh-check';
  localStatus(); // validates fixed loopback API, Docker context, network and container identity
  if (sql("SELECT current_setting('server_version_num')::integer/10000;") !== '17') throw Error('LOCAL_PG17_REQUIRED');
  if (sql('SHOW dynamic_library_path;') !== '$libdir') throw Error('LOCAL_PG_LIBRARY_SEARCH_PATH_REQUIRED');
  if (resumeFixture) {
    const receipt = JSON.parse(readFileSync(fileURLToPath(new URL('../build/oauth/fixture-provenance.json', import.meta.url)), 'utf8'));
    if (!reviewedOAuthFixture(receipt) || !sql(reviewedSql('010-postcheck.sql')).includes('P0_V3_POSTCHECK_PASS_METADATA_ONLY')) throw Error('REVIEWED_FAKE_STACK_REQUIRED');
  } else if (sql("SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p');") !== '0' ||
      sql('SELECT count(*) FROM auth.users;') !== '0') throw Error('FRESH_FAKE_STACK_REQUIRED');
  const version = sql("SELECT extversion FROM pg_extension WHERE extname='pg_graphql';");
  if (resumeFixture ? version !== '1.6.3' : !['1.5.11', '1.6.3'].includes(version)) throw Error('UNREVIEWED_LOCAL_GRAPHQL_VERSION');
  const container = `supabase_db_${PROJECT}`;
  verifyGraphqlContainer(inspectStack().find(c => c.Name === `/${container}`));
  for (const name of [`supabase_db_${PROJECT}`, `supabase_config_${PROJECT}`]) {
    const volume = JSON.parse(run('docker', ['volume', 'inspect', name]))[0];
    if (volume?.Name !== name || volume.Labels?.['com.supabase.cli.project'] !== PROJECT) throw Error('LOCAL_GRAPHQL_CONTAINER_REQUIRED');
  }
  if (run('docker', ['exec', container, 'uname', '-m']) !== 'x86_64') throw Error('LOCAL_AMD64_REQUIRED');
  preparationPhase = 'official-download';
  const response = await fetch(GRAPHQL_ASSET, { signal: AbortSignal.timeout(60000) });
  if (!response.ok) throw Error('OFFICIAL_GRAPHQL_DOWNLOAD_FAILED');
  const files = unpackReviewedGraphql(Buffer.from(await response.arrayBuffer()));
  preparationPhase = 'compiled-pg-paths';
  const library = serverLibraryPath(run('docker', ['exec', container, 'pg_config', '--pkglibdir']),
    await backendProbe());
  const shared = validateContainerPgPath(run('docker', ['exec', container, 'pg_config', '--sharedir']));
  const stageParent = join(realpathSync(root), 'build');
  mkdirSync(stageParent, { recursive: true });
  if (lstatSync(stageParent).isSymbolicLink() || realpathSync(stageParent) !== stageParent) throw Error('LOCAL_STAGE_PATH_REQUIRED');
  const stage = mkdtempSync(join(stageParent, 'graphql-stage-'));
  try {
    preparationPhase = 'copy-reviewed-files';
    for (const [name, bytes] of Object.entries(files)) {
      const host = join(stage, name);
      writeFileSync(host, bytes, { flag: 'wx', mode: 0o600 });
      verifyGraphqlContainer(inspectStack().find(c => c.Name === `/${container}`));
      const target = name.endsWith('.so') ? `${library}/${name}` : `${shared}/extension/${name}`;
      run('docker', ['cp', host, `${container}:${target}.oaz-new`]);
      // Atomic rename preserves any old mapped library until all backends restart.
      run('docker', ['exec', '--user', 'root', container, 'chmod', name.endsWith('.so') ? '755' : '644', `${target}.oaz-new`]);
      run('docker', ['exec', '--user', 'root', container, 'mv', '-f', `${target}.oaz-new`, target]);
      const installedHash = run('docker', ['exec', container, 'sha256sum', target]).split(/\s+/)[0];
      if (installedHash !== createHash('sha256').update(bytes).digest('hex')) throw Error('LOCAL_GRAPHQL_INSTALLED_HASH');
    }
    preparationPhase = 'restart-local-db';
    const before = inspectStack().find(c => c.Name === `/${container}`);
    const restartAt = Date.now();
    run('docker', ['restart', container]);
    preparationPhase = 'database-readiness';
    await waitForDatabase();
    const after = inspectStack().find(c => c.Name === `/${container}`);
    if (before.Id !== after.Id || before.NetworkSettings.Networks[NETWORK].NetworkID !== after.NetworkSettings.Networks[NETWORK].NetworkID) throw Error('LOCAL_RESTART_IDENTITY_CHANGED');
    console.log('LOCAL_RESTART_DIAGNOSTIC ' + JSON.stringify({ restartsIssued: 1, identityStable: true, elapsedMs: Date.now() - restartAt }));
    // Fresh synthetic DB only: replace the old extension with the reviewed real engine.
    // No CASCADE and no application data/schema exist at this point.
    preparationPhase = 'create-reviewed-extension';
    if (!resumeFixture) sql("DROP EXTENSION pg_graphql; CREATE EXTENSION pg_graphql WITH SCHEMA graphql VERSION '1.6.3'; GRANT USAGE ON SCHEMA graphql,graphql_public TO anon,authenticated; GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA graphql TO anon,authenticated;");
    if (sql("SELECT extversion FROM pg_extension WHERE extname='pg_graphql';") !== '1.6.3') throw Error('LOCAL_GRAPHQL_VERSION_MISMATCH');
    preparationPhase = 'actual-loaded-library';
    await backendProbe(`${library}/pg_graphql.so`, createHash('sha256').update(files['pg_graphql.so']).digest('hex'));
    console.log('LOCAL_GRAPHQL_1_6_3_OFFICIAL_ASSET_VERIFIED');
    if (resumeFixture && !sql(reviewedSql('010-postcheck.sql')).includes('P0_V3_POSTCHECK_PASS_METADATA_ONLY')) throw Error('REVIEWED_FAKE_STACK_REQUIRED');
    preparationPhase = 'service-readiness';
    await waitForServices();
    preparationPhase = 'complete';
  } catch (error) {
    reportStack();
    throw error;
  } finally {
    // Only the freshly-created host staging directory, never database volumes/backups.
    const resolved = realpathSync(stage);
    if (dirname(resolved) !== stageParent || !basename(resolved).startsWith('graphql-stage-')) throw Error('LOCAL_STAGE_PATH_REQUIRED');
    rmSync(resolved, { recursive: true });
  }
}
