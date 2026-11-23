import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadSource, deferred } from './helpers/react-dom.mjs';

test('STEP 131: 방문자 외부 상태의 snapshot 안정성·구독 해제·진행 중 POST 공유', async () => {
  const { createVisitorResource, EMPTY_VISITOR, getServerVisitorSnapshot } = loadSource('src/lib/visitorResource.ts');
  const requests = [], stored = new Map();
  const options = { today: () => '2026-10-31', read: () => stored.get('date') ?? null, write: (date) => stored.set('date', date), request: (method) => { const r = { method, ...deferred() }; requests.push(r); return r.promise; } };
  const a = createVisitorResource(options), b = createVisitorResource(options);
  assert.equal(a.getSnapshot(), EMPTY_VISITOR); assert.equal(getServerVisitorSnapshot(), EMPTY_VISITOR); assert.equal(requests.length, 0);
  let changes = 0; const off = a.subscribe(() => changes++); const offB = b.subscribe(() => {});
  assert.equal(requests.length, 1); assert.equal(requests[0].method, 'POST');
  const before = a.getSnapshot(); assert.equal(a.getSnapshot(), before); off(); const stopped = changes;
  requests[0].resolve({ count: 0 }); await new Promise(setImmediate);
  assert.equal(changes, stopped); assert.equal(a.getSnapshot().count, 0); assert.equal(b.getSnapshot().count, 0); offB();
  assert.equal(stored.get('date'), '2026-10-31');
  const c = createVisitorResource(options); const offC = c.subscribe(() => {}); assert.equal(requests[1].method, 'GET'); requests[1].resolve({ visitor: 5 }); await new Promise(setImmediate); offC();
});
for (const invalid of [null, 7, '7', { count: '7' }, { count: Infinity }, { arbitrary: true }]) {
  test(`STEP 131: 비정상 방문자 POST 응답 ${JSON.stringify(invalid)}는 GET으로만 대체`, async () => {
    const { createVisitorResource } = loadSource('src/lib/visitorResource.ts');
    const calls = [];
    const resource = createVisitorResource({ today: () => '2026-10-31', read: () => null, write: () => assert.fail('잘못된 POST는 날짜를 저장하지 않는다'), request: async (method) => { calls.push(method); return method === 'POST' ? invalid : { visitor: 9 }; } });
    const off = resource.subscribe(() => {}); await new Promise(setImmediate);
    assert.deepEqual(calls, ['POST', 'GET']); assert.equal(resource.getSnapshot().count, 9); off();
  });
}
test('STEP 131: localStorage 차단은 성공한 POST를 재전송하지 않고 최종 GET 실패는 0 표시', async () => {
  const { createVisitorResource } = loadSource('src/lib/visitorResource.ts');
  const methods = [];
  const resource = createVisitorResource({ today: () => '2026-10-31', read() { throw new Error('차단'); }, write() { throw new Error('차단'); }, request: async (method) => { methods.push(method); return { count: 7 }; } });
  const off = resource.subscribe(() => {}); await new Promise(setImmediate);
  assert.deepEqual(methods, ['POST']); assert.equal(resource.getSnapshot().count, 7); off();
  const failed = createVisitorResource({ today: () => '2026-11-01', read: () => null, request: async () => { throw new Error('가상 실패'); } });
  const stop = failed.subscribe(() => {}); await new Promise(setImmediate); assert.equal(failed.getSnapshot().count, 0); stop();
});
