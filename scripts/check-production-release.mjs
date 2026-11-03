// Offline RC checks only. No credentials loaded from disk, requests, SQL or deployment.
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const mainRef = 'maoefmwpdcnugyenyiea';
const mainOrigin = `https://${mainRef}.supabase.co`;
const stop = code => { throw Error(`RELEASE_STOP:${code}`); };

function jwtClaims(value) {
  try { return JSON.parse(Buffer.from(value.split('.')[1], 'base64url').toString('utf8')); }
  catch { stop('CREDENTIAL_FORMAT'); }
}
function publicKey(value, nowSeconds) {
  if (/^sb_publishable_[A-Za-z0-9_-]{16,}$/.test(value)) return 'OPAQUE_KEY_PROJECT_BINDING_REQUIRES_DASHBOARD';
  if (!/^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value)) stop('PUBLIC_KEY_FORMAT');
  const claims = jwtClaims(value);
  if (claims?.role !== 'anon' || claims.ref !== mainRef || !Number.isFinite(claims.exp) || claims.exp <= nowSeconds) stop('PUBLIC_KEY_CLAIMS');
  return 'ANON_CLAIMS_MATCH_SIGNATURE_NOT_VERIFIED';
}
function postgresTarget(host, user, database, port) {
  const direct = host === `db.${mainRef}.supabase.co`;
  const pooler = /^aws-\d+-[a-z0-9-]+\.pooler\.supabase\.com$/.test(host);
  if (!direct && !pooler || database && database !== 'postgres' || port && !['5432', '6543'].includes(String(port))) stop('SERVER_CONNECTION_TARGET');
  if (user?.includes('.') && !user.endsWith(`.${mainRef}`)) stop('SERVER_CONNECTION_TARGET');
  // A shared pooler host cannot identify a project without its scoped username.
  return direct || !!user?.endsWith(`.${mainRef}`);
}

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
  if (createHash('sha256').update(read('supabase/config.toml').replaceAll('\r\n', '\n')).digest('hex') !==
      '2c7a7a34593e5cfed813d5c6cd661ef52018d71c099c9063e4dfad89b3420830') stop('LOCAL_DEFAULT_CONFIG_CHANGED');
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
  const credentialCheck = publicKey(key, nowSeconds);
  const keyAliases = new Set(['NEXT_PUBLIC_SUPABASE_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_ANON_KEY', 'SUPABASE_PUBLISHABLE_KEY']);
  const refs = new Set(['SUPABASE_PROJECT_REF', 'SUPABASE_REF', 'NEXT_PUBLIC_SUPABASE_PROJECT_REF', 'NEXT_PUBLIC_SUPABASE_REF']);
  const urls = new Set(['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_URL']);
  const storage = new Set(['NEXT_PUBLIC_PROJECT_STORAGE_URL', 'NEXT_PUBLIC_SUPABASE_STORAGE_URL', 'SUPABASE_STORAGE_URL']);
  const serverSecrets = new Set(['SUPABASE_SECRET_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_JWT_SECRET', 'POSTGRES_PASSWORD']);
  const serverUrls = new Set(['POSTGRES_URL', 'POSTGRES_PRISMA_URL', 'POSTGRES_URL_NON_POOLING']);
  const serverParts = new Set(['POSTGRES_HOST', 'POSTGRES_USER', 'POSTGRES_DATABASE', 'POSTGRES_PORT']);
  let unboundServerVariables = 0;
  for (const [name, value] of Object.entries(env)) {
    if (!value) continue;
    // Integration-managed server credentials are not imported by this public-client app.
    // Keep them server-only; validate a project claim when one is actually available.
    if (serverSecrets.has(name)) {
      if (name === 'SUPABASE_SERVICE_ROLE_KEY' || name === 'SUPABASE_SECRET_KEY') {
        if (String(value).startsWith('eyJ')) {
          const claims = jwtClaims(value);
          if (claims?.role !== 'service_role' || claims.ref !== mainRef || !Number.isFinite(claims.exp) || claims.exp <= nowSeconds) stop('SERVER_CREDENTIAL_TARGET');
        } else if (!/^sb_secret_[A-Za-z0-9_-]{16,}$/.test(value)) stop('SERVER_CREDENTIAL_FORMAT');
        else unboundServerVariables++;
      } else unboundServerVariables++;
      continue;
    }
    if (serverUrls.has(name)) {
      let target;
      try { target = new URL(value); } catch { stop('SERVER_CONNECTION_FORMAT'); }
      if (!['postgres:', 'postgresql:'].includes(target.protocol) || target.hash) stop('SERVER_CONNECTION_FORMAT');
      let user;
      try { user = decodeURIComponent(target.username); } catch { stop('SERVER_CONNECTION_FORMAT'); }
      if (!postgresTarget(target.hostname, user, target.pathname.slice(1), target.port)) unboundServerVariables++;
      continue;
    }
    if (serverParts.has(name)) {
      if (name === 'POSTGRES_HOST' && !postgresTarget(value, env.POSTGRES_USER, env.POSTGRES_DATABASE, env.POSTGRES_PORT)) unboundServerVariables++;
      if (name === 'POSTGRES_USER' && String(value).includes('.') && !value.endsWith(`.${mainRef}`) ||
          name === 'POSTGRES_DATABASE' && value !== 'postgres' || name === 'POSTGRES_PORT' && !['5432', '6543'].includes(value)) stop('SERVER_CONNECTION_TARGET');
      continue;
    }
    if (name.startsWith('NEXT_PUBLIC_') && (/SECRET|PASSWORD|SERVICE_ROLE/.test(name) || /^postgres(?:ql)?:/i.test(value))) stop('BROWSER_SECRET');
    if (String(value).startsWith('sb_secret_')) stop('PRIVILEGED_CREDENTIAL');
    if (String(value).startsWith('eyJ')) {
      try {
        const claims = JSON.parse(Buffer.from(value.split('.')[1], 'base64url').toString('utf8'));
        if (claims?.role === 'service_role' || claims?.ref && claims.ref !== mainRef) stop('UNREVIEWED_CREDENTIAL_ALIAS');
      } catch (error) { if (error.message.startsWith('RELEASE_STOP:')) throw error; }
    }
    // A legacy anon JWT and a new publishable key legitimately differ.
    if (keyAliases.has(name)) { publicKey(value, nowSeconds); continue; }
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
    unboundServerVariables, dashboardVerified: false, databaseVerified: false, productionApproved: false };
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
