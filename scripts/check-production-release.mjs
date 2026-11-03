// Offline RC checks only. No credentials loaded from disk, requests, SQL or deployment.
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const mainRef = 'maoefmwpdcnugyenyiea';
const mainOrigin = `https://${mainRef}.supabase.co`;
const stop = code => { throw Error(`RELEASE_STOP:${code}`); };

export function checkReleaseAssets(directory = root) {
  const read = name => readFileSync(`${directory}/${name}`, 'utf8');
  const hashes = JSON.parse(read('reports/privacy-hotfix/RC_SQL_HASHES.json'));
  const sql = `${directory}/reports/main-safety/integration/sql`;
  const names = readdirSync(sql).filter(name => name.endsWith('.sql')).sort();
  if (names.length !== 13 || JSON.stringify(names) !== JSON.stringify(Object.keys(hashes).sort())) stop('SQL_INVENTORY');
  for (const name of names) {
    if (createHash('sha256').update(readFileSync(`${sql}/${name}`)).digest('hex') !== hashes[name]) stop('SQL_HASH');
  }
  const vercel = JSON.parse(read('vercel.json'));
  if (vercel.ignoreCommand !== undefined || JSON.stringify(vercel.git?.deploymentEnabled) !==
      JSON.stringify({ 'hotfix/privacy-p0': false })) stop('VERCEL_BRANCH_GUARD');
  if (JSON.parse(read('package.json')).engines?.node !== '24.x') stop('NODE_VERSION');
  return { status: 'LOCAL_RELEASE_ASSETS_PASS', sqlFiles: names.length,
    remoteSettingsVerified: false, productionApproved: false };
}

/** Explicit stage prevents an accidentally missing/OFF final flag from passing.
 * This inspects supplied values only; it cannot authenticate a key or attest Dashboard state.
 * Use as a Production build precheck, not as a substitute for preflight/postcheck/OAuth.
 */
export function checkProductionEnvironment(env, stage, nowSeconds = Date.now() / 1000) {
  if (!['compatibility', 'protected'].includes(stage)) stop('EXPLICIT_STAGE_REQUIRED');
  if (env.VERCEL !== '1' || env.VERCEL_ENV !== 'production' || env.VERCEL_GIT_COMMIT_REF !== 'main') stop('PRODUCTION_MAIN_CONTEXT');
  if (env.NEXT_PUBLIC_SUPABASE_URL !== mainOrigin) stop('MAIN_TARGET');
  if (env.NEXT_PUBLIC_OAZ_OAUTH_TEST_ORIGIN) stop('TEST_OAUTH_ORIGIN');
  if (env.NEXT_PUBLIC_OAZ_PRIVACY_V2 !== (stage === 'protected' ? 'true' : 'false')) stop('PRIVACY_STAGE_FLAG');
  const key = env.NEXT_PUBLIC_SUPABASE_KEY ?? '';
  let credentialCheck;
  if (/^sb_publishable_[A-Za-z0-9_-]{16,}$/.test(key)) {
    credentialCheck = 'OPAQUE_KEY_PROJECT_BINDING_REQUIRES_DASHBOARD';
  } else {
    let claims;
    try {
      if (!/^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(key)) stop('PUBLIC_KEY_FORMAT');
      claims = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString('utf8'));
    } catch { stop('PUBLIC_KEY_FORMAT'); }
    if (claims?.role !== 'anon' || claims.ref !== mainRef || !Number.isFinite(claims.exp) || claims.exp <= nowSeconds) stop('PUBLIC_KEY_CLAIMS');
    credentialCheck = 'ANON_CLAIMS_MATCH_SIGNATURE_NOT_VERIFIED';
  }
  const keyAliases = new Set(['NEXT_PUBLIC_SUPABASE_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_ANON_KEY', 'SUPABASE_PUBLISHABLE_KEY']);
  const refs = new Set(['SUPABASE_PROJECT_REF', 'SUPABASE_REF', 'NEXT_PUBLIC_SUPABASE_PROJECT_REF', 'NEXT_PUBLIC_SUPABASE_REF']);
  const urls = new Set(['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_URL']);
  const storage = new Set(['NEXT_PUBLIC_PROJECT_STORAGE_URL', 'NEXT_PUBLIC_SUPABASE_STORAGE_URL', 'SUPABASE_STORAGE_URL']);
  for (const [name, value] of Object.entries(env)) {
    if (!value) continue;
    if (String(value).startsWith('sb_secret_')) stop('PRIVILEGED_CREDENTIAL');
    if (String(value).startsWith('eyJ')) {
      try {
        const claims = JSON.parse(Buffer.from(value.split('.')[1], 'base64url').toString('utf8'));
        if (claims?.role === 'service_role' || claims?.ref && claims.ref !== mainRef) stop('UNREVIEWED_CREDENTIAL_ALIAS');
      } catch (error) { if (error.message.startsWith('RELEASE_STOP:')) throw error; }
    }
    if (keyAliases.has(name)) { if (value !== key) stop('KEY_ALIAS'); continue; }
    if (refs.has(name)) { if (value !== mainRef) stop('REF_ALIAS'); continue; }
    if (urls.has(name)) { if (value !== mainOrigin) stop('URL_ALIAS'); continue; }
    if (storage.has(name)) {
      let target;
      try { target = new URL(value); } catch { stop('STORAGE_ALIAS'); }
      if (target.origin !== mainOrigin || target.username || target.password || target.search || target.hash ||
          !target.pathname.startsWith('/storage/v1/object/public/')) stop('STORAGE_ALIAS');
      continue;
    }
    if (/(?:^|_)(?:SUPABASE|POSTGRES|POSTGRESQL|DATABASE|DB|DEMO_VISITOR)(?:_|$)/.test(name) ||
        /^PG(?:HOST|HOSTADDR|PORT|USER|PASSWORD|DATABASE|SERVICE|SERVICEFILE|PASSFILE|OPTIONS)$/.test(name) ||
        /^(?:OAZ_PREVIEW_|NEXT_PUBLIC_OAZ_PREVIEW_)/.test(name)) stop('UNREVIEWED_CONNECTION_VARIABLE');
  }
  return { status: 'LOCAL_PRODUCTION_ENVIRONMENT_PASS', stage, credentialCheck,
    dashboardVerified: false, databaseVerified: false, productionApproved: false };
}

export function releaseDecision(evidence) {
  // Caller assertions are an operator checklist, never collected remote proof.
  const required = ['sameCommitCiPassed', 'productionEnvironmentReviewed', 'oauthRoundTripPassed',
    'freshBackupVerified', 'recoveryOwnerAndLimitationsAccepted', 'freshPreflightPassed',
    'serviceInterruptionAccepted', 'productionChangeApproved'];
  const missing = required.filter(key => evidence?.[key] !== true);
  return { decision: missing.length ? 'NO_GO' : 'OPERATOR_CHECKLIST_COMPLETE_NOT_AUTOMATIC_APPROVAL', missing };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const [action = 'assets', stage, ...extra] = process.argv.slice(2);
    if (extra.length || !['assets', 'environment'].includes(action) || action === 'assets' && stage) stop('ARGUMENTS');
    const result = action === 'assets' ? checkReleaseAssets() : checkProductionEnvironment(process.env, stage);
    console.log(JSON.stringify(result)); // Fixed codes/booleans only; no input values.
  } catch (error) {
    console.error(/^RELEASE_STOP:[A-Z_]+$/.test(error.message) ? error.message : 'RELEASE_STOP:LOCAL_CHECK_FAILED');
    process.exitCode = 1;
  }
}
