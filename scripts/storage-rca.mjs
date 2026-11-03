// Diagnostic projection only. This module never decides that a denial test passes.
import { createHmac } from 'node:crypto';
import { API } from './local-supabase.mjs';

const actors = ['owner', 'other-user', 'anonymous'];
const codes = ['NoSuchKey', 'NoSuchBucket', 'AccessDenied', 'InvalidJWT', 'DatabaseError', 'InternalError'];
export function storageFailureDiagnostic(error, body, context = {}) {
  const response = error?.originalError instanceof Response ? error.originalError : null;
  const status = context.httpStatus ?? response?.status ?? error?.status;
  const httpStatus = Number.isInteger(status) && status >= 100 && status <= 599 ? status : null;
  const responseOk = typeof context.responseOk === 'boolean' ? context.responseOk : response?.ok ?? null;
  const storageCode = body?.code == null ? 'absent' : codes.includes(body.code) ? body.code : 'other';
  let verdict = 'UNCLASSIFIED_RESPONSE';
  if (responseOk === true || httpStatus === 200) verdict = context.fixtureMatches === true ? 'HTTP_SUCCESS_FIXTURE_CONTENT' : 'HTTP_SUCCESS';
  else if (httpStatus >= 500) verdict = 'SERVER_ERROR';
  else if (httpStatus === 401 || storageCode === 'InvalidJWT') verdict = 'AUTHENTICATION_ERROR';
  else if ([400, 403].includes(httpStatus) && storageCode === 'AccessDenied') verdict = 'ACCESS_DENIED_CODE';
  else if ([400, 404].includes(httpStatus) && String(body?.statusCode) === '404') {
    if (body?.message === 'Object not found' && storageCode === 'NoSuchKey') verdict = 'HIDDEN_OBJECT_WITH_CODE';
    else if (body?.message === 'Bucket not found' && storageCode === 'NoSuchBucket') verdict = 'HIDDEN_BUCKET_WITH_CODE';
    else if (body?.code === undefined && body?.error === 'not_found' && body?.message === 'Object not found') verdict = 'LEGACY_HIDDEN_OBJECT_NO_CODE';
    else if (body?.code === undefined && body?.error === 'Bucket not found' && body?.message === 'Bucket not found') verdict = 'LEGACY_HIDDEN_BUCKET_NO_CODE';
  }
  if (httpStatus !== null && responseOk === false && context.parseFailed === true) verdict = 'NON_JSON_ERROR_RESPONSE';
  if (httpStatus === null) verdict = 'NO_HTTP_RESPONSE';
  return {
    request: actors.includes(context.request) ? context.request : 'other-user',
    httpStatus,
    sdkErrorClass: error == null ? 'none' : ['StorageApiError', 'StorageUnknownError'].includes(error.name) ? error.name : 'other',
    storageCode,
    responseWrapper: response ? 'Response' : error?.originalError instanceof TypeError ? 'TypeError' : error?.originalError instanceof Error ? 'Error' : error?.originalError == null ? 'none' : 'other',
    responseOk,
    dataPresent: context.dataPresent === true,
    phase: 'private-storage',
    verdict,
  };
}

export function storageSessionVerdict(tokens, users, secret, now = Date.now() / 1000) {
  try {
    if (tokens.length !== 2 || users.length !== 2 || tokens[0] === tokens[1] || users[0] === users[1] || !secret) return 'SESSION_IDENTITY_MISMATCH';
    const valid = tokens.every((token, i) => {
      const [header, payload, signature] = token.split('.');
      const claims = JSON.parse(Buffer.from(payload, 'base64url'));
      return JSON.parse(Buffer.from(header, 'base64url')).alg === 'HS256' &&
        createHmac('sha256', secret).update(`${header}.${payload}`).digest('base64url') === signature &&
        claims.sub === users[i] && claims.role === 'authenticated' && Number.isFinite(claims.exp) && claims.exp > now;
    });
    return valid ? 'DISTINCT_VALID_AUTHENTICATED_SESSIONS' : 'SESSION_IDENTITY_MISMATCH';
  } catch { return 'SESSION_IDENTITY_MISMATCH'; }
}

export function storageDownloadProbe(fetcher = globalThis.fetch, emit = value => console.log('LOCAL_STORAGE_DIAGNOSTIC ' + JSON.stringify(value))) {
  let active;
  return {
    fetch: async (input, options = {}) => {
      const url = new URL(typeof input === 'string' || input instanceof URL ? String(input) : input.url);
      if (!active || url.origin !== API || url.pathname !== active.path || (options.method ?? 'GET') !== 'GET') return fetcher(input, options);
      const observed = active;
      const headers = new Headers(options.headers ?? (input instanceof Request ? input.headers : undefined));
      emit({ request: observed.request, phase: 'storage-wire-identity', verdict: headers.get('Authorization') === `Bearer ${observed.token}` ? 'EXPECTED_SESSION_TOKEN' : 'UNEXPECTED_SESSION_TOKEN' });
      const response = await fetcher(input, options);
      observed.httpStatus = response.status;
      observed.responseOk = response.ok;
      // Read only a clone, never replace the response or consume the SDK body.
      if (!response.ok) {
        try { observed.body = await response.clone().json(); } catch { observed.parseFailed = true; }
      }
      return response;
    },
    download: async (request, client, bucket, object, token) => {
      if (!actors.includes(request) || active) throw Error('LOCAL_STORAGE_DIAGNOSTIC_CONTEXT');
      active = { request, path: `/storage/v1/object/${bucket}/${object}`, token };
      try {
        const result = await client.storage.from(bucket).download(object);
        let fixtureMatches = false;
        if (active.responseOk && result.data instanceof Blob) fixtureMatches = await result.data.text() === 'synthetic fixture';
        emit(storageFailureDiagnostic(result.error, active.body, { ...active, dataPresent: result.data != null, fixtureMatches }));
        return result; // Original result; the existing owner/denial assertions are unchanged.
      } catch (error) {
        emit(storageFailureDiagnostic(error, active.body, active));
        throw error;
      } finally { active = undefined; }
    },
  };
}

export function storageCatalogVerdicts(meta) {
  return [
    { phase: 'storage-bucket', verdict: meta.private_bucket === true ? 'PRIVATE_BUCKET_CONFIRMED' : 'BUCKET_REVIEW_REQUIRED' },
    { phase: 'storage-select-policies', verdict: meta.rls === true && meta.no_bypass === true && meta.auth_policies === 1 && meta.expected_policy === 1 && meta.anon_policies === 0 ? 'SINGLE_PERMISSIVE_OWNER_POLICY_RLS_NO_BYPASS' : 'POLICY_REVIEW_REQUIRED' },
    { phase: 'storage-select-grants', verdict: meta.auth_select === true && meta.anon_select === true ? 'ANON_AND_AUTHENTICATED_SELECT_SUBJECT_TO_RLS' : 'GRANT_REVIEW_REQUIRED' },
  ];
}

// Only the verified disposable stack is supplied as query(). No operational SQL
// files, policies, grants or configuration are changed by these observations.
export function recordStorageCatalog(query, users, emit = value => console.log('LOCAL_STORAGE_DIAGNOSTIC ' + JSON.stringify(value))) {
  if (users.length !== 2 || !users.every(id => /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(id))) throw Error('LOCAL_STORAGE_DIAGNOSTIC_ID');
  const meta = JSON.parse(query(`BEGIN READ ONLY;
SELECT json_build_object(
 'private_bucket', EXISTS(SELECT 1 FROM storage.buckets WHERE id='privacy-fake-private' AND public=false),
 'rls', c.relrowsecurity,
 'no_bypass', NOT r.rolsuper AND NOT r.rolbypassrls AND NOT pg_has_role(r.oid,c.relowner,'USAGE'),
 'auth_select', has_table_privilege('authenticated',c.oid,'SELECT'),
 'anon_select', has_table_privilege('anon',c.oid,'SELECT'),
 'auth_policies', (SELECT count(*) FROM pg_policy p WHERE p.polrelid=c.oid AND p.polcmd IN ('r','*') AND (0=ANY(p.polroles) OR EXISTS(SELECT 1 FROM unnest(p.polroles) role_id WHERE role_id<>0 AND pg_has_role('authenticated',role_id,'USAGE')))),
 'anon_policies', (SELECT count(*) FROM pg_policy p WHERE p.polrelid=c.oid AND p.polcmd IN ('r','*') AND (0=ANY(p.polroles) OR EXISTS(SELECT 1 FROM unnest(p.polroles) role_id WHERE role_id<>0 AND pg_has_role('anon',role_id,'USAGE')))),
 'expected_policy', (SELECT count(*) FROM pg_policy p WHERE p.polrelid=c.oid AND p.polname='local_fake_storage' AND p.polcmd='*' AND p.polpermissive AND p.polroles=ARRAY[r.oid] AND p.polqual IS NOT NULL AND p.polwithcheck IS NOT NULL)
) FROM pg_class c JOIN pg_roles r ON r.rolname='authenticated' WHERE c.oid='storage.objects'::regclass;
ROLLBACK;`));
  for (const result of storageCatalogVerdicts(meta)) emit(result);
  const visible = users.map(id => query(`BEGIN READ ONLY; SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims"='{"sub":"${id}","role":"authenticated"}';
SELECT count(*) FROM storage.objects WHERE bucket_id='privacy-fake-private' AND name='${users[0]}/fake.txt';
ROLLBACK;`));
  emit({ phase: 'storage-direct-rls', verdict: visible[0] === '1' && visible[1] === '0' ? 'OWNER_VISIBLE_OTHER_HIDDEN' : 'DIRECT_RLS_REVIEW_REQUIRED' });
}
