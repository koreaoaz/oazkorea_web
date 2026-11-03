const productionRef = 'maoefmwpdcnugyenyiea';
const productionHosts = new Set(['www.oazkorea.co.kr', 'oazkorea.co.kr']);
const stop = (code) => { throw new Error(`PREVIEW_STOP:${code}`); };

const readClaims = key => JSON.parse(atob(key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));

// Values are inspected in memory only. Never print or persist environment values.
export function checkPreviewEnvironment(env) {
  if ((env.NODE_ENV === 'production' || env.VERCEL === '1' || env.VERCEL_URL || env.VERCEL_BRANCH_URL) &&
      !['preview', 'production', 'development'].includes(env.VERCEL_ENV)) stop('DEPLOYMENT_CONTEXT_REQUIRED');
  const suppliedKey = env.NEXT_PUBLIC_SUPABASE_KEY ?? '';
  if (suppliedKey.startsWith('sb_secret_')) stop('PUBLIC_KEY_REQUIRED');
  if (suppliedKey.startsWith('eyJ')) {
    try {
      const claims = readClaims(suppliedKey);
      if (claims.role !== 'anon') stop('PUBLIC_KEY_REQUIRED');
    } catch { stop('PUBLIC_KEY_REQUIRED'); }
  }
  if (env.VERCEL_ENV === 'production') {
    if (env.NEXT_PUBLIC_OAZ_OAUTH_TEST_ORIGIN) stop('TEST_CALLBACK_IN_PRODUCTION');
    if (env.VERCEL === '1' && env.VERCEL_GIT_COMMIT_REF !== 'main') stop('PRODUCTION_BRANCH_REQUIRED');
    return 'PRODUCTION_CALLBACK_DEFAULT';
  }
  if (env.VERCEL_ENV !== 'preview') return 'NOT_A_PREVIEW_BUILD';
  // This app uses only the public client. Preview has no reason to receive
  // elevated Supabase credentials or raw Postgres connection strings.
  for (const name of ['SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SERVICE_ROLE', 'SUPABASE_SECRET_KEY',
    'SUPABASE_JWT_SECRET', 'DATABASE_URL', 'POSTGRES_URL', 'POSTGRES_PRISMA_URL',
    'POSTGRES_URL_NON_POOLING', 'POSTGRES_PASSWORD']) {
    if (env[name]) stop('UNNEEDED_SERVER_CREDENTIAL');
  }
  if (env.VERCEL_GIT_COMMIT_REF !== 'hotfix/privacy-p0') stop('HOTFIX_BRANCH_REQUIRED');
  const ref = env.OAZ_PREVIEW_ISOLATED_REF;
  if (!/^[a-z]{20}$/.test(ref ?? '') || ref === productionRef) stop('ISOLATED_REF_REQUIRED');
  let target;
  try { target = new URL(env.NEXT_PUBLIC_SUPABASE_URL); } catch { stop('INVALID_URL'); }
  if (target.origin !== `https://${ref}.supabase.co` || target.username || target.password ||
      target.pathname !== '/' || target.search || target.hash) stop('TARGET_MISMATCH');
  for (const name of ['SUPABASE_URL', 'NEXT_PUBLIC_PROJECT_STORAGE_URL']) {
    if (env[name] && !env[name].startsWith(`${target.origin}/`) && env[name] !== target.origin) stop('ALTERNATE_TARGET_MISMATCH');
  }
  for (const name of ['SUPABASE_ANON_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY']) {
    if (env[name] && env[name] !== env.NEXT_PUBLIC_SUPABASE_KEY) stop('ALTERNATE_KEY_MISMATCH');
  }
  const key = env.NEXT_PUBLIC_SUPABASE_KEY ?? '';
  if (/^sb_publishable_[A-Za-z0-9_-]{16,}$/.test(key)) {
    // Opaque publishable keys cannot prove project binding offline. Dashboard check remains required.
  } else {
    try {
      const payload = readClaims(key);
      if (key.split('.').length !== 3 || payload.role !== 'anon' || payload.ref !== ref) stop('PUBLIC_KEY_TARGET');
    } catch { stop('PUBLIC_KEY_REQUIRED'); }
  }
  let callback;
  try { callback = new URL(env.NEXT_PUBLIC_OAZ_OAUTH_TEST_ORIGIN); } catch { stop('EXACT_CALLBACK_REQUIRED'); }
  const hosts = [env.VERCEL_BRANCH_URL, env.VERCEL_URL].filter(Boolean);
  if (callback.protocol !== 'https:' || callback.origin !== env.NEXT_PUBLIC_OAZ_OAUTH_TEST_ORIGIN ||
      callback.username || callback.password || productionHosts.has(callback.hostname) ||
      !hosts.includes(callback.host)) stop('CALLBACK_TARGET');
  return 'PREVIEW_LOCAL_CHECK_PASS_REMOTE_ISOLATION_UNVERIFIED';
}

/** Check both baked browser settings and current server environment. */
export function assertRuntimeEnvironment(compiled, runtime) {
  checkPreviewEnvironment(compiled);
  checkPreviewEnvironment(runtime);
  if (compiled.VERCEL_ENV === 'preview' || runtime.VERCEL_ENV === 'preview') {
    if (compiled.VERCEL_ENV !== 'preview' || runtime.VERCEL_ENV !== 'preview') stop('RUNTIME_CONTEXT_MISMATCH');
    for (const key of ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_KEY',
      'NEXT_PUBLIC_OAZ_OAUTH_TEST_ORIGIN', 'OAZ_PREVIEW_ISOLATED_REF', 'VERCEL_GIT_COMMIT_REF']) {
      if (compiled[key] !== runtime[key]) stop('RUNTIME_TARGET_MISMATCH');
    }
  }
}
