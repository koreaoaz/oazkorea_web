import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

export function inspectSource(file, content) {
  const problems = [];
  if (/(?:^|\/)(?:seal|surface|manifest|result)\.json$|(?:^|\/)\.env(?:\.|$)/.test(file)) problems.push('PRIVATE_ARTIFACT');
  if (/\.(?:dump|backup|pgpass|key|zip|7z|tar|gz)$/i.test(file) || /(?:^|\/)(?:catalog-check-|p0-preflight-|storage-backup-|rls-risk-)/.test(file)) problems.push('OPERATIONAL_ARTIFACT');
  if (/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(content)) problems.push('PRIVATE_KEY');
  if (/\bsb_secret_[A-Za-z0-9_-]{16,}|\b(?:ghp|gho)_[A-Za-z0-9]{20,}|\bgithub_pat_[A-Za-z0-9_]{30,}/.test(content)) problems.push('SECRET_TOKEN');
  if (/postgres(?:ql)?:\/\/[^\s:'"/]+:[^\s@'"/]+@/i.test(content)) problems.push('PASSWORD_URI');
  for (const match of content.matchAll(/eyJ[A-Za-z0-9_-]+\.([A-Za-z0-9_-]+)\.[A-Za-z0-9_-]+/g)) {
    // Even an anon token must not be committed as a live credential literal.
    if (match) problems.push('JWT_LITERAL');
  }
  if (file.startsWith('src/') && /NEXT_PUBLIC_\w*(?:SERVICE_ROLE|SECRET_KEY|DB_PASSWORD)/.test(content)) problems.push('PUBLIC_SECRET_VARIABLE');
  return [...new Set(problems)];
}

export function checkRelease(root = process.cwd()) {
  const files = execFileSync('git', ['ls-files', '-co', '--exclude-standard', '-z'], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean);
  let checked = 0;
  const failures = [];
  for (const file of new Set(files)) {
    for (const code of inspectSource(file, '')) failures.push({ file, code });
    if (!existsSync(`${root}/${file}`) || !/\.(?:ts|tsx|mts|cts|js|mjs|cjs|py|json|sql|md|yml|yaml|cmd|txt)$|(?:^|\/)\.env/.test(file)) continue;
    const content = readFileSync(`${root}/${file}`, 'utf8'); checked++;
    for (const code of inspectSource(file, content)) failures.push({ file, code });
  }
  const sql = readFileSync(`${root}/reports/main-safety/integration/sql/010-privacy-minimal.sql`);
  if (createHash('sha256').update(sql).digest('hex') !== 'bea86d888eea295c5ef092b2fa0f39955d494cf4b81a304615cf3079be57ed98') failures.push({ file: '010-privacy-minimal.sql', code: 'SQL_RELEASE_HASH' });
  return { checked, failures };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const result = checkRelease();
    console.log(JSON.stringify(result)); // Only filenames/codes/counts; never matching values or lines.
    process.exitCode = result.failures.length ? 1 : 0;
  } catch { console.error('SECURITY_CHECK_FAILED'); process.exitCode = 1; }
}
