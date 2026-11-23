import { visitorCase, sliderCase } from './helpers/timing-cases.mjs';
import { imageCase, gridCase } from './helpers/image-cases.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fixture, deferred, settle, nodes } from './helpers/hooks-harness.mjs';

// STEP 131: 첫 이미지 지연/이전 URL 유지/늦은 카드 닫기 기대값을 승인된 표시 기준으로 교체한다.
for (const path of ['src/app/editor/components/ImageFromStorage.tsx', 'src/app/events/archive/components/ImageFromStorage.tsx']) {
  test('STEP 131 실제 React DOM: ' + path + ' 즉시 표시와 URL 교체', () => imageCase(path));
  test('STEP 131 실제 React DOM: ' + path + ' 미지원·새 mount', () => imageCase(path, 'remount'));
}
test('STEP 131 실제 React DOM: 페이지 즉시 닫기·이전/다음·동일 페이지 유지', () => gridCase('page'));
test('STEP 131 실제 React DOM: 카드 재클릭·ESC·바깥 클릭·cleanup', () => gridCase('dismiss'));
test('STEP 129 C: E04 공지 mount·등록·삭제·필터 변경·재실행의 재조회 순서', async () => {
  const requests = [], calls = [];
  const noop = () => {};
  const merge = fixture('src/app/editor/utils/noticeOrder.ts', 'mergeNoticeOrder');
  let confirmed = true;
  class MockDate extends Date { constructor() { super('2026-10-31T00:00:00Z'); } }
  const h = fixture('src/app/editor/boards/0_notice/NoticeForm.tsx', 'NoticeForm', {
    '../../services/board.service': {
      fetchPosts: (table) => { assert.equal(table, 'editor_0_noti'); calls.push('fetch'); const request = deferred(); requests.push(request); return request.promise; },
      insertPost: async (table, payload) => { assert.equal(table, 'editor_0_noti'); assert.equal(payload.text, '가상 공지'); assert.equal(payload.is_noti, true); calls.push('insert'); },
      deletePost: async (table, id) => { assert.equal(table, 'editor_0_noti'); assert.equal(id, 7); calls.push('delete'); },
    },
    '../../services/order.service': { persistOrder: () => assert.fail('ID 저장은 기존 830 순열 검사에서 별도 검증') },
    '../../hooks/useDragAndDrop': { useDragAndDrop: () => ({ handleDragStart: noop, handleDragOver: noop, handleDrop: noop, handleDragEnd: noop }) },
    '../../constants': { BOARD_TABLE_MAP: { 공지: 'editor_0_noti' } },
    '../../components/common/FormField': { FormField: 'Field' }, '../../utils/inputformClasses': { textareaBase: '' },
    '../../utils/cx': { cx: noop }, '../../utils/noticeOrder': { mergeNoticeOrder: (...args) => merge.render(...args) },
  }, { confirm: () => confirmed, Date: MockDate, alert: () => assert.fail('정상 흐름은 중단하지 않는다') });
  const rows = [{ id: 7, text: '가상 공지', description: null, is_noti: true }];
  h.render(); assert.equal(h.state(7), true); h.flush(); assert.equal(h.state(7), true);
  requests[0].resolve(rows); await settle(); assert.equal(h.state(7), false);
  h.set(0, '가상 공지');
  const submission = nodes(h.render(), (node) => node.type === 'form')[0].props.onSubmit({ preventDefault() {} });
  await settle();
  assert.deepEqual(calls, ['fetch', 'insert', 'fetch']); assert.equal(h.state(7), true);
  requests[1].resolve(rows); await submission; await settle();
  const remove = nodes(h.render(), (node) => node.type === 'button' && node.props.children === '삭제')[0];
  confirmed = false; await remove.props.onClick(); assert.equal(requests.length, 2);
  confirmed = true; const removal = remove.props.onClick(); await settle(); assert.deepEqual(calls.slice(-2), ['delete', 'fetch']);
  requests[2].resolve(rows); await removal; await settle();
  h.set(8, '홍보'); h.render(); h.flush(); assert.equal(requests.length, 3, '공지/홍보 필터는 서버 요청을 늘리지 않는다');
  // STEP 131: 완료된 상태의 setter 시점 대신 실제 재조회와 effect 재실행의 응답 경합을 검증한다.
  h.set(0, '가상 공지');
  const replayedSubmission = nodes(h.render(), (node) => node.type === 'form')[0].props.onSubmit({ preventDefault() {} });
  await settle();
  h.replay(); assert.equal(requests.length, 5); assert.equal(h.state(7), true);
  requests[3].resolve(rows); await replayedSubmission; await settle(); assert.equal(h.state(7), true, '이전 요청은 최신 로딩을 끄지 않는다');
  requests[4].resolve(rows); await settle(); assert.equal(h.state(7), false); h.unmount();
});
// STEP 131: 중복 POST와 effect의 transition 복원을 강제하던 기대값을 승인된 기준으로 교체한다.
for (const [mode, label] of [['date-before', 'KST 자정 전 hydration'], ['date-after', 'KST 자정 경계 hydration'], ['policy', '기존 GET/POST 정책과 Strict Mode 단일 기록'], ['fallback', 'POST 실패의 GET 대체'], ['unmount', '구독 cleanup·빠른 새 mount의 POST 공유']]) {
  test('STEP 131 실제 React DOM: 방문자 ' + label, () => visitorCase(mode));
}
test('STEP 131 실제 React DOM: 슬라이드 3회 순환·4초/700ms 전환', () => sliderCase('loop'));
test('STEP 131 실제 React DOM: 슬라이드 unmount·timeout cleanup', () => sliderCase('cleanup'));
