// Additional LOCAL transport checks against our reviewed synthetic fixture.
// This does not reproduce or certify Production bucket policies.
import assert from 'node:assert/strict';
import { randomBytes, createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { localStatus, API, sql, reviewedSql, reviewedOAuthFixture } from './local-supabase.mjs';
import { localFetch, requireStorageDenial } from './test-local-supabase.mjs';

let checks = 0;
let phase = 'prerequisites';
let admin;
const users = [];
const clients = [];
const ownedObjects = new Set();
const bucket = 'privacy-fake-private';
const publicBucket = 'privacy-fake-public-' + randomBytes(6).toString('hex');
let publicCreated = false;
let cleanupFailed = false;
let initialCounts;
const ok = condition => { assert.ok(condition); checks++; };
try {
  ok(reviewedOAuthFixture(JSON.parse(readFileSync(new URL('../build/oauth/fixture-provenance.json', import.meta.url), 'utf8'))));
  const status = localStatus();
  ok(sql(reviewedSql('010-postcheck.sql')).includes('P0_V3_POSTCHECK_PASS_METADATA_ONLY'));
  const counts = () => sql("SELECT json_build_array((SELECT count(*) FROM auth.users),(SELECT count(*) FROM storage.buckets),(SELECT count(*) FROM storage.objects));");
  initialCounts = counts();
  let lastUpload;
  const fetcher = localFetch(async (input, options) => {
    const response = await fetch(input, options);
    if (options.method === 'POST' && new URL(input).pathname.startsWith('/storage/v1/object/')) {
      lastUpload = { status: response.status, body: await response.clone().json() };
    }
    return response;
  });
  function uploadDenied(result, expected) {
    // This installed SDK returns upload error JSON directly, unlike download's
    // StorageUnknownError wrapper. Require both actual HTTP and backend status.
    const accepted = result.data === null && !!result.error && String(result.error.statusCode) === String(expected) &&
      [400, expected].includes(lastUpload?.status) && String(lastUpload?.body?.statusCode) === String(expected);
    if (!accepted) console.error('LOCAL_UPLOAD_CONTRACT_DIAGNOSTIC ' + JSON.stringify({
      expected, httpStatus: lastUpload?.status ?? null,
      backendStatus: /^\d{3}$/.test(String(lastUpload?.body?.statusCode)) ? String(lastUpload.body.statusCode) : 'absent',
      sdkStatus: /^\d{3}$/.test(String(result.error?.statusCode)) ? String(result.error.statusCode) : 'absent',
      dataPresent: result.data != null, invalidMime: lastUpload?.body?.error === 'invalid_mime_type',
      sizeLimit: lastUpload?.body?.error === 'Payload too large',
    }));
    ok(accepted);
  }
  function signedUrlDenied(result) {
    const body = lastUpload?.body;
    ok(result.data === null && result.error?.name === 'StorageApiError' &&
      [400, 404].includes(result.error.status) && [400, 404].includes(lastUpload?.status) &&
      String(body?.statusCode) === '404' && body.message === 'Object not found' &&
      ['not_found', 'NoSuchKey'].includes(body.error));
  }
  const client = key => createClient(API, key, { global: { fetch: fetcher },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  admin = client(status.SERVICE_ROLE_KEY);
  const anon = client(status.ANON_KEY);
  const password = randomBytes(32).toString('base64url');
  phase = 'independent-auth';
  for (let i = 0; i < 2; i++) {
    const email = `storage-${randomBytes(8).toString('hex')}@example.invalid`;
    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    ok(!created.error && !!created.data.user?.id);
    users.push(created.data.user.id);
    const c = client(status.ANON_KEY);
    ok(!(await c.auth.signInWithPassword({ email, password })).error);
    clients.push(c);
  }
  const [owner, other] = clients;
  const object = `${users[0]}/boundary.txt`;
  ownedObjects.add(object);
  const content = new Blob(['synthetic storage boundary'], { type: 'text/plain' });
  phase = 'private-mutations';
  ok(!(await owner.storage.from(bucket).upload(object, content)).error);
  const forbiddenObject = `${users[0]}/forbidden.txt`;
  ownedObjects.add(forbiddenObject);
  const deniedUpload = await other.storage.from(bucket).upload(forbiddenObject, content);
  uploadDenied(deniedUpload, 403);
  ok(deniedUpload.error.message === 'new row violates row-level security policy');
  await requireStorageDenial(await owner.storage.from(bucket).download(forbiddenObject)); checks++;
  const removedOther = await other.storage.from(bucket).remove([object]);
  ok(!removedOther.error && Array.isArray(removedOther.data) && removedOther.data.length === 0);
  const retained = await owner.storage.from(bucket).download(object);
  ok(!retained.error && await retained.data.text() === 'synthetic storage boundary');
  await requireStorageDenial(await other.storage.from(bucket).download(object)); checks++;
  await requireStorageDenial(await anon.storage.from(bucket).download(object)); checks++;
  phase = 'signed-url';
  const signed = await owner.storage.from(bucket).createSignedUrl(object, 60);
  ok(!signed.error && new URL(signed.data.signedUrl).origin === API);
  // A signed URL is a bearer capability: no user Authorization header required.
  const signedDownload = await fetcher(signed.data.signedUrl);
  ok(signedDownload.status === 200 && await signedDownload.text() === 'synthetic storage boundary');
  const otherSigned = await other.storage.from(bucket).createSignedUrl(object, 60);
  signedUrlDenied(otherSigned);
  const anonymousSigned = await anon.storage.from(bucket).createSignedUrl(object, 60);
  signedUrlDenied(anonymousSigned);
  const tampered = new URL(signed.data.signedUrl);
  const token = tampered.searchParams.get('token');
  tampered.searchParams.set('token', token.slice(0, -5) + (token.endsWith('abcde') ? 'fghij' : 'abcde'));
  const badSigned = await fetcher(tampered);
  const badSignedBody = await badSigned.json();
  ok(badSigned.status === 400 && ['400', '403'].includes(String(badSignedBody.statusCode)) &&
    ['Unauthorized', 'InvalidJWT'].includes(badSignedBody.error) && badSignedBody.message === 'signature verification failed');
  phase = 'signed-url-expiry';
  const expiring = await owner.storage.from(bucket).createSignedUrl(object, 1);
  ok(!expiring.error && new URL(expiring.data.signedUrl).origin === API);
  let expiredSigned = false;
  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    const response = await fetcher(expiring.data.signedUrl);
    if (response.status === 200) {
      await response.body?.cancel();
      await new Promise(resolve => setTimeout(resolve, 250));
      continue;
    }
    const body = await response.json();
    expiredSigned = response.status === 400 && ['400', '403'].includes(String(body.statusCode)) &&
      ['Unauthorized', 'InvalidJWT'].includes(body.error) && body.message === '"exp" claim timestamp check failed';
    break;
  }
  ok(expiredSigned);
  const afterExpiry = await owner.storage.from(bucket).download(object);
  ok(!afterExpiry.error && await afterExpiry.data.text() === 'synthetic storage boundary');
  phase = 'invalid-session-and-path';
  for (const path of ['/rest/v1/rpc/oaz_member_self_v3', `/storage/v1/object/authenticated/${bucket}/${object}`]) {
    const response = await fetcher(API + path, { headers: { apikey: status.ANON_KEY, Authorization: 'Bearer deliberately-invalid-jwt' } });
    if (path.startsWith('/rest/')) { ok(response.status === 401); await response.body?.cancel(); }
    else {
      const body = await response.json();
      // Pinned Storage1.28.2 wraps jose's malformed-token error in AccessDenied;
      // its legacy GET handler uses HTTP400 with backend status403. This is an
      // authentication failure, and is never counted as successful RLS denial.
      ok(response.status === 400 && String(body.statusCode) === '403' && body.error === 'Unauthorized' && body.message === 'Invalid Compact JWS');
    }
  }
  const invalidPath = await owner.storage.from(bucket).upload(`${users[0]}/../outside.txt`, content);
  uploadDenied(invalidPath, 403);
  if (invalidPath.error.message !== 'new row violates row-level security policy') throw Error('LOCAL_STORAGE_PATH_DENIAL_REQUIRED');
  const session = (await owner.auth.getSession()).data.session;
  const [header, payload, signature] = session.access_token.split('.');
  ok(JSON.parse(Buffer.from(header, 'base64url')).alg === 'HS256' && !!status.JWT_SECRET);
  ok(createHmac('sha256', status.JWT_SECRET).update(`${header}.${payload}`).digest('base64url') === signature);
  const expiredPayload = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(payload, 'base64url')), iat: 1, exp: 2 })).toString('base64url');
  const unsigned = `${header}.${expiredPayload}`;
  const expiredToken = `${unsigned}.${createHmac('sha256', status.JWT_SECRET).update(unsigned).digest('base64url')}`;
  const expiredResponse = await fetcher(`${API}/storage/v1/object/authenticated/${bucket}/${object}`, {
    headers: { apikey: status.ANON_KEY, Authorization: `Bearer ${expiredToken}` },
  });
  const expiredBody = await expiredResponse.json();
  ok(expiredResponse.status === 400 && String(expiredBody.statusCode) === '403' &&
    expiredBody.error === 'Unauthorized' && expiredBody.message === '"exp" claim timestamp check failed');
  phase = 'public-and-mime-fixture';
  const created = await admin.storage.createBucket(publicBucket, { public: true, fileSizeLimit: 1024, allowedMimeTypes: ['text/plain'] });
  ok(!created.error); publicCreated = true;
  ok(!(await admin.storage.from(publicBucket).upload('public.txt', content)).error);
  const publicUrl = admin.storage.from(publicBucket).getPublicUrl('public.txt').data.publicUrl;
  const publicDownload = await fetcher(publicUrl);
  ok(publicDownload.status === 200 && await publicDownload.text() === 'synthetic storage boundary');
  const mimeDenied = await admin.storage.from(publicBucket).upload('bad.png', Buffer.from('fake image'), { contentType: 'image/png' });
  uploadDenied(mimeDenied, 415);
  const multipartMimeDenied = await admin.storage.from(publicBucket).upload('bad-multipart.png', new Blob(['fake image'], { type: 'image/png' }));
  uploadDenied(multipartMimeDenied, 400);
  ok(multipartMimeDenied.error.message === 'mime type image/png is not supported');
  const sizeDenied = await admin.storage.from(publicBucket).upload('large.txt', new Blob([Buffer.alloc(2048)], { type: 'text/plain' }));
  uploadDenied(sizeDenied, 413);
  // MIME restrictions do not enforce an extension allowlist. Record the actual
  // behavior without claiming that the application's extension policy is safe.
  ok(!(await admin.storage.from(publicBucket).upload('extension.exe', content)).error);
  phase = 'owner-delete';
  const removed = await owner.storage.from(bucket).remove([object]);
  ok(!removed.error && removed.data.length === 1);
  await requireStorageDenial(await owner.storage.from(bucket).download(object)); checks++;
  console.log(`LOCAL_STORAGE_BOUNDARIES_PASS checks=${checks} productionPolicy=NOT_VERIFIED extensionAllowlist=NOT_ENFORCED_BY_MIME`);
} catch {
  console.error(`LOCAL_STORAGE_BOUNDARIES_STOP phase=${phase} checks=${checks}`);
  process.exitCode = 1;
} finally {
  // Only this invocation's exact synthetic objects, bucket, users and sessions.
  for (const c of clients) if ((await c.auth.signOut()).error) cleanupFailed = true;
  if (admin) {
    if (ownedObjects.size && (await admin.storage.from(bucket).remove([...ownedObjects])).error) cleanupFailed = true;
    if (publicCreated) {
      if ((await admin.storage.emptyBucket(publicBucket)).error) cleanupFailed = true;
      if ((await admin.storage.deleteBucket(publicBucket)).error) cleanupFailed = true;
    }
    for (const id of users) if ((await admin.auth.admin.deleteUser(id)).error) cleanupFailed = true;
  }
  if (initialCounts) {
    try {
      if (sql("SELECT json_build_array((SELECT count(*) FROM auth.users),(SELECT count(*) FROM storage.buckets),(SELECT count(*) FROM storage.objects));") !== initialCounts) cleanupFailed = true;
    } catch { cleanupFailed = true; }
  }
  console.log(cleanupFailed ? 'LOCAL_STORAGE_BOUNDARIES_CLEANUP_FAILED' : 'LOCAL_STORAGE_BOUNDARIES_CLEANUP_PASS');
  if (cleanupFailed) process.exitCode = 1;
}
