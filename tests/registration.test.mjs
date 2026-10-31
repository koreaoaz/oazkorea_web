import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

// 실제 가입 함수만 로드한다. Supabase 클라이언트/환경변수/네트워크는 로드하지 않는다.
const source = readFileSync(new URL('../src/lib/registration.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const exports = {};
vm.runInNewContext(compiled, { exports });
const { completeRegistration, parseRegistrationProfile } = exports;
const profile = { name: '테스트', department: '시험학과', studentId: '0000', generation: '0', phone_number: '000' };
const user = { id: 'test-user', email: 'verified@example.invalid', email_confirmed_at: '2026-01-01', identities: [{ provider: 'github' }] };

function fixture(options = {}) {
  const writes = [];
  let reads = 0;
  let persisted = false;
  const client = {
    auth: { getUser: async () => ({ data: { user: options.user === undefined ? user : options.user }, error: options.authError }) },
    from(table) {
      assert.equal(table, 'registered_member');
      return {
        select(columns) {
          assert.equal(columns, 'uuid');
          return { eq(column, value) {
            assert.equal(column, 'uuid');
            assert.equal(value, (options.user ?? user).id);
            return { async maybeSingle() {
              reads++;
              return { data: options.existing || persisted || (options.race && reads > 1) ? { uuid: value } : null, error: options.readError };
            } };
          } };
        },
        async insert(payload) {
          writes.push(payload);
          if (options.persist && !options.insertError) persisted = true;
          return { error: options.insertError };
        },
      };
    },
  };
  return { client, writes, get reads() { return reads; } };
}

test('기존 UUID 회원은 이메일 불일치·프로필 누락이어도 INSERT하지 않는다', async () => {
  const f = fixture({ existing: true, user: { id: user.id, email: 'different@example.invalid' } });
  const result = await completeRegistration(f.client, () => { throw new Error('읽지 않아야 함'); });
  assert.equal(result.status, 'existing');
  assert.equal(f.writes.length, 0);
});

test('조작한 localStorage UUID·이메일·is_manager를 무시한다', async () => {
  const f = fixture();
  const result = await completeRegistration(f.client, () => JSON.stringify({ ...profile, uuid: 'other', email: 'stolen@example.invalid', is_manager: true }));
  assert.equal(result.status, 'registered');
  assert.equal(f.writes.length, 1);
  assert.equal(f.writes[0].uuid, user.id);
  assert.equal(f.writes[0].email, user.email);
  assert.equal(f.writes[0].is_manager, false);
});

for (const [name, options] of [
  ['인증 실패', { authError: { message: '비공개 오류' } }],
  ['사용자 없음', { user: null }],
  ['회원 조회 실패', { readError: { code: '42501' } }],
  ['미확인 이메일', { user: { ...user, email_confirmed_at: null } }],
  ['GitHub identity 없음', { user: { ...user, identities: [] } }],
  ['이메일 없음', { user: { ...user, email: undefined } }],
]) {
  test(`${name}이면 신규 가입을 쓰지 않는다`, async () => {
    const f = fixture(options);
    assert.equal((await completeRegistration(f.client, () => JSON.stringify(profile))).status, 'error');
    assert.equal(f.writes.length, 0);
  });
}

test('프로필 파싱은 잘못된 JSON·누락·과도한 길이를 거부한다', async () => {
  for (const raw of [null, '{', '[]', '{}', JSON.stringify({ ...profile, name: ' '.repeat(501) })]) {
    assert.equal(parseRegistrationProfile(raw), null);
    const f = fixture();
    assert.equal((await completeRegistration(f.client, () => raw)).status, 'error');
    assert.equal(f.writes.length, 0);
  }
});

test('저장소 접근 오류도 개인정보 없는 안내를 반환한다', async () => {
  const f = fixture();
  const result = await completeRegistration(f.client, () => { throw new Error('비공개 값'); });
  assert.equal(result.status, 'error');
  assert.equal(result.message.includes('비공개 값'), false);
  assert.equal(f.writes.length, 0);
});

test('RLS 거부를 성공으로 처리하거나 원문 오류를 노출하지 않는다', async () => {
  const f = fixture({ insertError: { code: '42501', message: '비공개 값' } });
  const result = await completeRegistration(f.client, () => JSON.stringify(profile));
  assert.equal(result.status, 'error');
  assert.match(result.message, /승인/);
  assert.equal(result.message.includes('비공개 값'), false);
});

test('동시 가입의 unique 충돌은 같은 UUID가 재조회될 때만 기존 회원으로 처리한다', async () => {
  for (const race of [true, false]) {
    const f = fixture({ insertError: { code: '23505' }, race });
    const result = await completeRegistration(f.client, () => JSON.stringify(profile));
    assert.equal(result.status, race ? 'existing' : 'error');
    assert.equal(f.writes.length, 1);
    assert.equal(f.reads, 2);
  }
});

test('그 밖의 DB 오류는 재시도나 덮어쓰기 없이 실패한다', async () => {
  const f = fixture({ insertError: { code: '23502', message: '비공개 값' } });
  const result = await completeRegistration(f.client, () => JSON.stringify(profile));
  assert.equal(result.status, 'error');
  assert.equal(result.message.includes('비공개 값'), false);
  assert.equal(f.writes.length, 1);
});

test('완료된 콜백을 재방문해도 중복 INSERT나 정보 덮어쓰기가 없다', async () => {
  const f = fixture({ persist: true });
  assert.equal((await completeRegistration(f.client, () => JSON.stringify(profile))).status, 'registered');
  assert.equal((await completeRegistration(f.client, () => null)).status, 'existing');
  assert.equal(f.writes.length, 1);
});
