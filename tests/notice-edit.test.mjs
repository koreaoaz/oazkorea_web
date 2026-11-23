import { test } from 'node:test';
import assert from 'node:assert/strict';
import { domTest, loadSource, deferred } from './helpers/react-dom.mjs';

const row = () => ({ id: 17, text: '기존 제목', description: '기존 내용', is_noti: true });
const button = (element, text) => [...element.querySelectorAll('button')].find((item) => item.textContent === text);
const change = (window, input, value) => {
  Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set.call(input, value);
  input.dispatchEvent(new window.Event('input', { bubbles: true }));
};
function component(service) {
  return loadSource('src/app/editor/boards/0_notice/NoticeForm.tsx', {
    '../../services/board.service': { insertPost: async () => {}, deletePost: async () => {}, ...service },
    '../../services/order.service': { persistOrder: () => assert.fail('이 테스트에서 정렬을 저장하면 안 됨') },
  }).NoticeForm;
}

for (const [field, column, expected] of [['text', 1, '기존 제목'], ['description', 2, '기존 내용']]) {
  test(`공지 ${field} 수정 저장 후 서버 목록 재조회`, async () => domTest(async ({ render, container, window, act }) => {
    const rows = [row(), { id: 18, text: '다른 제목', description: '다른 내용', is_noti: true }];
    const calls = [];
    let fetches = 0;
    const NoticeForm = component({
      fetchPosts: async (table) => { assert.equal(table, 'editor_0_noti'); fetches++; return rows.map((item) => ({ ...item })); },
      updatePost: async (table, id, payload) => {
        calls.push({ table, id, payload: { ...payload } });
        Object.assign(rows.find((item) => item.id === id), payload);
      },
    });
    await render(NoticeForm);
    const beforeFetch = fetches;
    const first = container.querySelector('tbody tr');
    const cell = first.querySelectorAll('td')[column];
    await act(async () => cell.dispatchEvent(new window.MouseEvent('dblclick', { bubbles: true })));
    const input = cell.querySelector('textarea');
    assert.equal(input.value, expected);
    assert.equal(first.draggable, false, '편집 중 드래그를 막는다');
    await act(async () => change(window, input, '수정된 값'));
    await act(async () => button(cell, '저장').click());
    assert.deepEqual(calls, [{ table: 'editor_0_noti', id: 17, payload: { [field]: '수정된 값' } }]);
    assert.equal(fetches, beforeFetch + 1, '저장 성공 후 다시 조회한다');
    const updated = container.querySelectorAll('tbody tr');
    assert.match(updated[0].textContent, /수정된 값/);
    assert.match(updated[1].textContent, /다른 제목/);
    assert.equal(updated[0].draggable, false, '편집 후에도 검증되지 않은 정렬 저장은 활성화하지 않는다');
  }));
}

test('공지 수정 취소는 변경을 버리고 저장 요청을 보내지 않는다', async () => domTest(async ({ render, container, window, act }) => {
  let updates = 0;
  await render(component({ fetchPosts: async () => [row()], updatePost: async () => { updates++; } }));
  const cell = container.querySelector('tbody tr').querySelectorAll('td')[1];
  await act(async () => button(cell, '수정').click());
  await act(async () => change(window, cell.querySelector('textarea'), '취소할 값'));
  await act(async () => button(cell, '취소').click());
  assert.equal(updates, 0);
  assert.match(cell.textContent, /기존 제목/);
  assert.equal(cell.querySelector('textarea'), null);
}));

test('저장 실패 시 입력을 유지하고 오류를 표시하며 재시도할 수 있다', async () => domTest(async ({ render, container, window, act }) => {
  let attempts = 0;
  const data = row();
  await render(component({
    fetchPosts: async () => [{ ...data }],
    updatePost: async (_table, _id, payload) => { if (++attempts === 1) throw new Error('mock failure'); Object.assign(data, payload); },
  }));
  const cell = container.querySelector('tbody tr').querySelectorAll('td')[2];
  await act(async () => button(cell, '수정').click());
  await act(async () => change(window, cell.querySelector('textarea'), '유지할 입력'));
  await act(async () => button(cell, '저장').click());
  assert.equal(cell.querySelector('textarea').value, '유지할 입력');
  assert.equal(data.description, '기존 내용');
  assert.match(container.querySelector('[role="alert"]').textContent, /저장하지 못했습니다/);
  await act(async () => button(cell, '저장').click());
  assert.equal(attempts, 2);
  assert.match(container.querySelector('tbody tr').textContent, /유지할 입력/);
  assert.equal(container.querySelector('[role="alert"]'), null);
}));

test('빠른 중복 저장은 한 번만 요청하고 저장 중 취소를 막는다', async () => domTest(async ({ render, container, window, act }) => {
  const pending = deferred();
  const data = row();
  let updates = 0;
  let fetches = 0;
  await render(component({
    fetchPosts: async () => { fetches++; return [{ ...data }]; },
    updatePost: async (_table, _id, payload) => { updates++; await pending.promise; Object.assign(data, payload); },
  }));
  const initialFetches = fetches;
  const cell = container.querySelector('tbody tr').querySelectorAll('td')[1];
  await act(async () => button(cell, '수정').click());
  await act(async () => change(window, cell.querySelector('textarea'), '한 번 저장'));
  await act(async () => { const save = button(cell, '저장'); save.click(); save.click(); });
  assert.equal(updates, 1);
  assert.equal(button(cell, '저장').disabled, true);
  assert.equal(button(cell, '취소').disabled, true);
  assert.equal(fetches, initialFetches);
  await act(async () => pending.resolve());
  assert.equal(fetches, initialFetches + 1);
  assert.match(container.querySelector('tbody tr').textContent, /한 번 저장/);
}));
