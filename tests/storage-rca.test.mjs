import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { API } from '../scripts/local-supabase.mjs';
import { localFetch, requireStorageDenial } from '../scripts/test-local-supabase.mjs';
import { storageFailureDiagnostic, storageDownloadProbe, storageSessionVerdict, storageCatalogVerdicts, recordStorageCatalog } from '../scripts/storage-rca.mjs';

const hidden = { statusCode: '404', code: 'NoSuchKey', message: 'Object not found' };
const bucket = { statusCode: '404', code: 'NoSuchBucket', message: 'Bucket not found' };
const denied = { statusCode: '403', code: 'AccessDenied', message: 'Access denied' };
const invalid = { statusCode: '401', code: 'InvalidJWT', message: 'fake private authentication detail' };
const cases = [
  ['403 AccessDenied', 403, denied, false, 'ACCESS_DENIED_CODE'],
  ['400 AccessDenied', 400, denied, false, 'ACCESS_DENIED_CODE'],
  ['404 NoSuchKey', 404, hidden, true, 'HIDDEN_OBJECT_WITH_CODE'],
  ['404 NoSuchBucket', 404, bucket, true, 'HIDDEN_BUCKET_WITH_CODE'],
  ['400 hidden NoSuchKey', 400, hidden, true, 'HIDDEN_OBJECT_WITH_CODE'],
  // Official v1.28.2 GET 4xx schema only declares statusCode/error/message.
  // Reproduce the existing false-negative without changing its pass predicate.
  ['400 legacy hidden object without code', 400, { statusCode: '404', error: 'not_found', message: 'Object not found' }, false, 'LEGACY_HIDDEN_OBJECT_NO_CODE'],
  ['404 legacy hidden bucket without code', 404, { statusCode: '404', error: 'Bucket not found', message: 'Bucket not found' }, false, 'LEGACY_HIDDEN_BUCKET_NO_CODE'],
  ['200 file content', 200, 'synthetic fixture', false, 'HTTP_SUCCESS_FIXTURE_CONTENT'],
  ['200 unexpected content', 200, 'fake unrelated content', false, 'HTTP_SUCCESS'],
  ['401 authentication failure', 401, invalid, false, 'AUTHENTICATION_ERROR'],
  ['400 InvalidJWT', 400, { ...invalid, statusCode: '400' }, false, 'AUTHENTICATION_ERROR'],
  ['503 service failure', 503, { statusCode: '503', code: 'InternalError', message: 'fake private failure detail' }, false, 'SERVER_ERROR'],
  ['500 misleading hidden object body', 500, hidden, false, 'SERVER_ERROR'],
  ['404 non-JSON response', 404, 'fake private invalid JSON', false, 'NON_JSON_ERROR_RESPONSE'],
  ['network failure', null, null, false, 'NO_HTTP_RESPONSE'],
];

for (const [name, status, body, acceptedByExistingGuard, verdict] of cases) {
  test(`Storage RCA with installed SDK: ${name}`, async () => {
    const output = [];
    let requests = 0;
    const probe = storageDownloadProbe(async (url, options) => {
      requests++;
      assert.equal(new URL(url).origin, API);
      assert.equal(options.redirect, 'error');
      if (status === null) throw new TypeError('fake private network detail');
      return typeof body === 'string' ? new Response(body, { status }) : Response.json(body, { status });
    }, value => output.push(value));
    const client = createClient(API, 'fake-local-only', { global: { fetch: localFetch(probe.fetch) }, auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
    const result = await probe.download('other-user', client, 'fake-private', 'fake.txt', 'fake-local-only');
    assert.equal(requests, 1);
    assert.equal(output[0].verdict, 'EXPECTED_SESSION_TOKEN');
    const evidence = output[1];
    assert.equal(evidence.verdict, verdict);
    assert.equal(evidence.httpStatus, status);
    assert.equal(evidence.responseOk, status === null ? null : status === 200);
    assert.equal(evidence.dataPresent, status === 200);
    assert.equal(evidence.sdkErrorClass, status === 200 ? 'none' : 'StorageUnknownError');
    assert.equal(evidence.responseWrapper, status === 200 ? 'none' : status === null ? 'TypeError' : 'Response');
    assert.equal(evidence.storageCode, body?.code ?? 'absent');
    if (acceptedByExistingGuard) await assert.doesNotReject(requireStorageDenial(result));
    else await assert.rejects(requireStorageDenial(result), /LOCAL_STORAGE_DENIAL_REQUIRED/);
    assert.equal(output.length, 2);
    assert.doesNotMatch(JSON.stringify(output), /fake private|fake-private|synthetic fixture|fake-local-only|Authorization|Bearer/);
  });
}

test('RCA output has exactly the approved fixed fields and rejects arbitrary nested values', () => {
  const privateValue = 'fake-private-never-emit';
  const evidence = storageFailureDiagnostic({ name: privateValue, originalError: { secret: privateValue } },
    { code: privateValue, message: privateValue, error: privateValue, headers: privateValue },
    { request: privateValue, phase: privateValue, verdict: privateValue, httpStatus: privateValue, responseOk: privateValue, dataPresent: privateValue, secret: privateValue });
  assert.deepEqual(Object.keys(evidence).sort(), ['request', 'httpStatus', 'sdkErrorClass', 'storageCode', 'responseWrapper', 'responseOk', 'dataPresent', 'phase', 'verdict'].sort());
  assert.ok(!JSON.stringify(evidence).includes(privateValue));
  assert.equal(evidence.httpStatus, null);
  assert.equal(evidence.dataPresent, false);
  assert.equal(evidence.responseOk, null);
});

test('Probe reports wrong wire identity without changing the request or converting its failure to success', async () => {
  const output = [];
  const probe = storageDownloadProbe(async (_url, options) => {
    assert.equal(new Headers(options.headers).get('Authorization'), 'Bearer fake-local-only');
    return Response.json(denied, { status: 403 });
  }, value => output.push(value));
  const client = createClient(API, 'fake-local-only', { global: { fetch: localFetch(probe.fetch) }, auth: { persistSession: false, autoRefreshToken: false } });
  const result = await probe.download('other-user', client, 'fake-private', 'fake.txt', 'fake-different-token');
  assert.equal(output[0].verdict, 'UNEXPECTED_SESSION_TOKEN');
  await assert.rejects(requireStorageDenial(result));
  assert.ok(!JSON.stringify(output).includes('fake-different-token'));
});

test('Session evidence verifies distinct subjects, signatures, role and expiry in RAM only', () => {
  const sign = claims => {
    const unsigned = Buffer.from(JSON.stringify({ alg: 'HS256' })).toString('base64url') + '.' + Buffer.from(JSON.stringify(claims)).toString('base64url');
    return unsigned + '.' + createHmac('sha256', 'fake-signing-only').update(unsigned).digest('base64url');
  };
  const users = ['fake-owner', 'fake-other'];
  const tokens = users.map(sub => sign({ sub, role: 'authenticated', exp: 200 }));
  assert.equal(storageSessionVerdict(tokens, users, 'fake-signing-only', 100), 'DISTINCT_VALID_AUTHENTICATED_SESSIONS');
  for (const pair of [[tokens[0], tokens[0]], [tokens[1], tokens[0]], [tokens[0], sign({ sub: users[1], role: 'service_role', exp: 200 })], [tokens[0], sign({ sub: users[1], role: 'authenticated', exp: 99 })]]) {
    assert.equal(storageSessionVerdict(pair, users, 'fake-signing-only', 100), 'SESSION_IDENTITY_MISMATCH');
  }
  assert.equal(storageSessionVerdict(tokens, users, 'wrong-secret', 100), 'SESSION_IDENTITY_MISMATCH');
  assert.equal(storageSessionVerdict([undefined, undefined], users, 'fake-signing-only', 100), 'SESSION_IDENTITY_MISMATCH');
});

const expectedCatalog = { private_bucket: true, rls: true, no_bypass: true, auth_select: true, anon_select: true, auth_policies: 1, anon_policies: 0, expected_policy: 1 };
test('Policy diagnostics include inherited/public SELECT and ALL policies, never raw metadata', () => {
  assert.equal(storageCatalogVerdicts(expectedCatalog)[1].verdict, 'SINGLE_PERMISSIVE_OWNER_POLICY_RLS_NO_BYPASS');
  for (const change of [{ rls: false }, { no_bypass: false }, { auth_policies: 2 }, { expected_policy: 0 }, { anon_policies: 1 }]) {
    assert.equal(storageCatalogVerdicts({ ...expectedCatalog, ...change })[1].verdict, 'POLICY_REVIEW_REQUIRED');
  }
  const queries = [], output = [];
  const users = ['00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002'];
  recordStorageCatalog(query => {
    queries.push(query);
    return queries.length === 1 ? JSON.stringify({ ...expectedCatalog, privateDetail: 'fake-private' }) : queries.length === 2 ? '1' : '0';
  }, users, value => output.push(value));
  assert.equal(output.at(-1).verdict, 'OWNER_VISIBLE_OTHER_HIDDEN');
  assert.equal(queries.length, 3);
  for (const query of queries) {
    assert.match(query, /^BEGIN READ ONLY;/);
    assert.match(query, /ROLLBACK;$/);
    assert.doesNotMatch(query, /\b(CREATE|ALTER|DELETE|UPDATE|INSERT|GRANT|REVOKE)\b/);
  }
  assert.match(queries[0], /p\.polcmd IN \('r','\*'\)/);
  assert.match(queries[0], /0=ANY\(p\.polroles\)/);
  assert.match(queries[0], /pg_has_role\('authenticated',role_id,'USAGE'\)/);
  assert.doesNotMatch(JSON.stringify(output), /00000000|fake-private|privateDetail/);
  assert.throws(() => recordStorageCatalog(() => assert.fail('unsafe SQL'), ["';--", users[1]]));
});
