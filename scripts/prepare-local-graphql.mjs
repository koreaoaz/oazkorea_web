// Installs an official hash-pinned extension in the disposable LOCAL container only.
import { createHash } from 'node:crypto';
import { zstdDecompressSync } from 'node:zlib';
import { mkdtempSync, writeFileSync, rmSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, basename } from 'node:path';
import { localStatus, run, sql, PROJECT, inspectStack } from './local-supabase.mjs';

export const GRAPHQL_ASSET = 'https://github.com/supabase/pg_graphql/releases/download/v1.6.3/pg_graphql-v1.6.3-pg17-amd64-linux-gnu.deb';
export const GRAPHQL_SHA = 'e827939c60bd1e0b861bf30206d04a274e354b1f8942d36fe4b7cd8889f4dc84';
const wanted = {
  './usr/lib/postgresql/lib/pg_graphql.so': 'pg_graphql.so',
  './var/lib/postgresql/extension/pg_graphql--1.6.3.sql': 'pg_graphql--1.6.3.sql',
  './var/lib/postgresql/extension/pg_graphql.control': 'pg_graphql.control',
};
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
  if (!/^\/(?:usr|opt)\/[a-zA-Z0-9_./-]+$/.test(value) || value.includes('/../')) throw Error('LOCAL_PG_PATH_REQUIRED');
  return value;
}
export async function prepareLocalGraphql() {
  localStatus(); // validates fixed loopback API, Docker context, network and container identity
  if (sql("SELECT current_setting('server_version_num')::integer/10000;") !== '17') throw Error('LOCAL_PG17_REQUIRED');
  if (sql("SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p');") !== '0' ||
      sql('SELECT count(*) FROM auth.users;') !== '0') throw Error('FRESH_FAKE_STACK_REQUIRED');
  const version = sql("SELECT extversion FROM pg_extension WHERE extname='pg_graphql';");
  if (version === '1.6.3') return;
  if (version !== '1.5.11') throw Error('UNREVIEWED_LOCAL_GRAPHQL_VERSION');
  const container = `supabase_db_${PROJECT}`;
  if (run('docker', ['exec', container, 'uname', '-m']) !== 'x86_64') throw Error('LOCAL_AMD64_REQUIRED');
  const response = await fetch(GRAPHQL_ASSET, { signal: AbortSignal.timeout(60000) });
  if (!response.ok) throw Error('OFFICIAL_GRAPHQL_DOWNLOAD_FAILED');
  const files = unpackReviewedGraphql(Buffer.from(await response.arrayBuffer()));
  const library = validateContainerPgPath(run('docker', ['exec', container, 'pg_config', '--pkglibdir']));
  const shared = validateContainerPgPath(run('docker', ['exec', container, 'pg_config', '--sharedir']));
  const stage = mkdtempSync(join(tmpdir(), 'oaz-fake-graphql-'));
  try {
    for (const [name, bytes] of Object.entries(files)) {
      const host = join(stage, name);
      writeFileSync(host, bytes, { flag: 'wx', mode: 0o600 });
      inspectStack();
      const target = name.endsWith('.so') ? `${library}/${name}` : `${shared}/extension/${name}`;
      run('docker', ['cp', host, `${container}:${target}.oaz-new`]);
      // Atomic rename preserves any old mapped library until all backends restart.
      run('docker', ['exec', '--user', 'root', container, 'chmod', name.endsWith('.so') ? '755' : '644', `${target}.oaz-new`]);
      run('docker', ['exec', '--user', 'root', container, 'mv', '-f', `${target}.oaz-new`, target]);
    }
    run('docker', ['restart', container]);
    let ready = false;
    for (let attempt = 0; attempt < 60; attempt++) {
      try { if (sql('SELECT 1;') === '1') { ready = true; break; } } catch { /* local startup only */ }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    if (!ready) throw Error('LOCAL_DB_RESTART_FAILED');
    // Fresh synthetic DB only: replace the old extension with the reviewed real engine.
    // No CASCADE and no application data/schema exist at this point.
    sql("DROP EXTENSION pg_graphql; CREATE EXTENSION pg_graphql WITH SCHEMA graphql VERSION '1.6.3'; GRANT USAGE ON SCHEMA graphql,graphql_public TO anon,authenticated; GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA graphql TO anon,authenticated;");
    if (sql("SELECT extversion FROM pg_extension WHERE extname='pg_graphql';") !== '1.6.3') throw Error('LOCAL_GRAPHQL_VERSION_MISMATCH');
    console.log('LOCAL_GRAPHQL_1_6_3_OFFICIAL_ASSET_VERIFIED');
  } finally {
    // Only the freshly-created host staging directory, never database volumes/backups.
    const resolved = realpathSync(stage);
    if (dirname(resolved) !== realpathSync(tmpdir()) || !basename(resolved).startsWith('oaz-fake-graphql-')) throw Error('LOCAL_STAGE_PATH_REQUIRED');
    rmSync(resolved, { recursive: true });
  }
}
