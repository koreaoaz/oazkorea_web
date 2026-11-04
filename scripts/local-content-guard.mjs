// 검증된 로컬 fixture만 대상으로 한다. 운영 접속/마이그레이션 도구가 아니다.
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { API, PROJECT, localStatus, sql, reviewedSql, reviewedOAuthFixture, run } from './local-supabase.mjs';
import { checkReleaseAssets } from './check-production-release.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
const directory = new URL('../reports/privacy-hotfix/content-write/', import.meta.url);
export function contentSql(name) {
  if (!['011-content-write-guard.sql', '012-content-write-postcheck.sql'].includes(name)) throw Error('LOCAL_CONTENT_SQL_REQUIRED');
  const bytes = readFileSync(new URL(name, directory));
  const hashes = JSON.parse(readFileSync(new URL('HASHES.json', directory), 'utf8'));
  if (createHash('sha256').update(bytes).digest('hex') !== hashes[name]) throw Error('LOCAL_CONTENT_HASH_REQUIRED');
  return bytes.toString('utf8');
}
export function contentFixture() {
  checkReleaseAssets();
  if (run('git', ['branch', '--show-current']) !== 'hotfix/privacy-p0' || existsSync(`${root}/supabase/.temp/project-ref`) ||
      !reviewedOAuthFixture(JSON.parse(readFileSync(`${root}/build/oauth/fixture-provenance.json`, 'utf8')))) throw Error('LOCAL_CONTENT_FIXTURE_REQUIRED');
  const status = localStatus();
  if (status.API_URL !== API || PROJECT !== 'oaz-privacy-local') throw Error('LOCAL_CONTENT_TARGET_REQUIRED');
  return status;
}
export function checkContentGuard() {
  if (!sql('BEGIN READ ONLY;\n' + contentSql('012-content-write-postcheck.sql') + '\nROLLBACK;').includes('LOCAL_CONTENT_WRITE_POSTCHECK_PASS')) throw Error('LOCAL_CONTENT_POSTCHECK_REQUIRED');
  if (!sql(reviewedSql('010-postcheck.sql')).includes('P0_V3_POSTCHECK_PASS_METADATA_ONLY')) throw Error('LOCAL_CONTENT_PRIVACY_REGRESSION');
}
export function applyLocalContentGuard() {
  contentFixture();
  // 기존 보호 SQL의 검사기를 수정하거나 무력화하지 않는다.
  if (!sql(reviewedSql('010-postcheck.sql')).includes('P0_V3_POSTCHECK_PASS_METADATA_ONLY')) throw Error('LOCAL_CONTENT_PRIVACY_PREREQUISITE');
  sql("SET oaz.local_content_fixture='oaz-privacy-local';\n" + contentSql('011-content-write-guard.sql'));
  checkContentGuard();
  console.log('LOCAL_CONTENT_WRITE_GUARD_PASS tables=7');
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (process.argv.length !== 3 || !['apply', 'check'].includes(process.argv[2])) throw Error('LOCAL_CONTENT_ACTION_REQUIRED');
    if (process.argv[2] === 'apply') applyLocalContentGuard();
    else { contentFixture(); checkContentGuard(); console.log('LOCAL_CONTENT_WRITE_POSTCHECK_PASS'); }
  } catch (error) { console.error(/^LOCAL_[A-Z_]+$/.test(error.message) ? error.message : 'LOCAL_CONTENT_STOP_DIAGNOSTICS_SUPPRESSED'); process.exitCode = 1; }
}
