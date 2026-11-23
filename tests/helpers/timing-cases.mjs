import assert from 'node:assert/strict';
import { renderToString } from 'react-dom/server';
import { domTest, loadSource, deferred, Image } from './react-dom.mjs';

export async function visitorCase(mode = 'date-after') {
  return domTest(async ({ React, render, hydrate, act, window, container, unmount }) => {
    const clock = { now: '2026-10-31T14:59:59Z' }, requests = [], errors = [];
    class MockDate extends Date { constructor() { super(clock.now); } }
    const { default: Visitor } = loadSource('src/components/home/VisitorBlock.tsx', {}, {
      Date: MockDate,
      fetch: (url, options) => { assert.equal(url, '/api/visitor'); const r = { method: options?.method ?? 'GET', ...deferred() }; requests.push(r); return r.promise; },
    });
    const respond = async (r, count = 7) => act(async () => r.resolve({ ok: true, json: async () => ({ count }) }));
    if (mode.startsWith('date-')) {
      container.innerHTML = renderToString(React.createElement(Visitor));
      assert.equal(requests.length, 0); assert.match(container.textContent, /\.\.\./); assert.doesNotMatch(container.textContent, /2026/);
      if (mode === 'date-after') clock.now = '2026-10-31T15:00:00Z';
      const expected = mode === 'date-after' ? '2026-11-01' : '2026-10-31';
      await hydrate(Visitor, { onRecoverableError: (error) => errors.push(error.message) });
      assert.equal(errors.length, 0); assert.match(container.textContent, new RegExp(expected));
      assert.equal(requests.length, 1, '실제 Strict Mode에서도 POST는 한 번만 실행한다');
      assert.equal(requests[0].method, 'POST'); await respond(requests[0]);
      assert.equal(window.localStorage.getItem('lastVisitDate'), expected);
      assert.match(container.textContent, /7/);
    } else if (mode === 'policy') {
      window.localStorage.setItem('lastVisitDate', '2026-10-31'); await render(Visitor);
      assert.equal(requests[0].method, 'GET'); await respond(requests[0]); await unmount();
      window.localStorage.setItem('lastVisitDate', '2026-10-30'); await render(Visitor);
      assert.equal(requests[1].method, 'POST'); await respond(requests[1]); await unmount();
      await render(Visitor); assert.equal(requests[2].method, 'GET'); await respond(requests[2]);
      assert.equal(requests.length, 3, '실제 새 mount의 GET까지 하루 캐시로 제거하지 않는다');
    } else if (mode === 'fallback') {
      await render(Visitor); assert.equal(requests.length, 1);
      await act(async () => requests[0].reject(new Error('가상 POST 실패')));
      assert.equal(requests[1].method, 'GET'); await respond(requests[1], 9);
      assert.match(container.textContent, /9/); assert.equal(window.localStorage.getItem('lastVisitDate'), null);
    } else if (mode === 'unmount') {
      await render(Visitor); assert.equal(requests.length, 1); await unmount(); await render(Visitor);
      assert.equal(requests.length, 1, '처리 중인 POST는 빠른 새 mount도 공유한다');
      await respond(requests[0]); assert.match(container.textContent, /7/);
      await unmount(); assert.equal(container.textContent, '');
    }
  });
}

function fakeClock() {
  let now = 0, sequence = 0;
  const timers = new Map();
  const schedule = (callback, delay, repeat) => { const id = ++sequence; timers.set(id, { callback, at: now + delay, repeat }); return id; };
  return {
    setTimeout: (callback, delay) => schedule(callback, delay, 0), clearTimeout: (id) => timers.delete(id),
    setInterval: (callback, delay) => schedule(callback, delay, delay), clearInterval: (id) => timers.delete(id),
    get size() { return timers.size; },
    advanceTo(target) {
      while (true) {
        const next = [...timers].filter(([, timer]) => timer.at <= target).sort((a, b) => a[1].at - b[1].at)[0];
        if (!next) break;
        const [id, timer] = next; now = timer.at;
        if (timer.repeat) timer.at += timer.repeat; else timers.delete(id);
        timer.callback();
      }
      now = target;
    },
  };
}
export async function sliderCase(mode = 'loop') {
  return domTest(async ({ render, container, act, unmount }) => {
    const clock = fakeClock();
    const { default: Slider } = loadSource('src/components/home/features/ImageSlider.tsx', { 'next/image': { __esModule: true, default: Image } }, clock);
    await render(Slider); assert.equal(clock.size, 1, 'Strict Mode cleanup 후 interval은 하나');
    const track = () => container.querySelector('[style*="translateX"]');
    const index = () => Number(track().style.transform.match(/-(\d+)/)[1]) / 100;
    for (let step = 1; step <= (mode === 'loop' ? 9 : 3); step++) {
      const time = step * 4000; await act(async () => clock.advanceTo(time - 1)); assert.equal(index(), ((step - 1) % 3) + 1);
      await act(async () => clock.advanceTo(time)); assert.equal(index(), ((step - 1) % 3) + 2);
      assert.ok(track().className.includes('transition-transform'));
      if (step % 3 === 0) {
        await act(async () => clock.advanceTo(time + 699)); assert.equal(index(), 4);
        if (mode === 'cleanup') break;
        await act(async () => clock.advanceTo(time + 700)); assert.equal(index(), 1); assert.ok(!track().className.includes('transition-transform'));
        await act(async () => clock.advanceTo(time + 701)); assert.equal(index(), 1); assert.equal(clock.size, 1);
      }
    }
    await unmount(); assert.equal(clock.size, 0); await act(async () => clock.advanceTo(60000)); assert.equal(container.textContent, '');
  });
}
