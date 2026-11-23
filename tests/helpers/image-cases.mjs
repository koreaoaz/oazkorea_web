import assert from 'node:assert/strict';
import { renderToString } from 'react-dom/server';
import { domTest, loadSource, deferred, Image } from './react-dom.mjs';

export async function imageCase(path, mode = 'immediate') {
  return domTest(async ({ React, render, container, act, window, unmount }) => {
    const { ImageFromStorage } = loadSource(path, {
      'next/image': { __esModule: true, default: Image },
      '../services/storage.service': { getPublicImageUrl: (bucket, name) => `/mock/${bucket}/${name}` },
    });
    const props = { board: '프로젝트', filename: 'a.png', className: 'w-16 h-16' };
    const html = renderToString(React.createElement(ImageFromStorage, props));
    assert.match(html, /\/mock\/project_img\/a.png/, '정상 이미지는 첫 렌더부터 표시한다');
    await render(ImageFromStorage, props);
    assert.equal(container.querySelector('img').getAttribute('src'), '/mock/project_img/a.png');
    await render(ImageFromStorage, { ...props, board: '행사', filename: 'b.png' });
    assert.equal(container.querySelector('img').getAttribute('src'), '/mock/card_news/b.png');
    await render(ImageFromStorage, { ...props, filename: '' }); assert.equal(container.querySelector('img'), null); assert.match(container.textContent, /없음/);
    await render(ImageFromStorage, { ...props, board: '미지원' }); assert.equal(container.querySelector('img'), null);
    await render(ImageFromStorage, { ...props, board: '스터디' }); assert.equal(container.querySelector('img').getAttribute('src'), '/mock/study-images/a.png');
    assert.equal(container.querySelector('img').getAttribute('width'), '64'); assert.equal(container.querySelector('img').getAttribute('height'), '64');
    await act(async () => container.querySelector('img').dispatchEvent(new window.Event('error')));
    assert.equal(container.querySelector('img'), null, '404 등 표시 실패는 대체 표시한다');
    await render(ImageFromStorage, { ...props, filename: 'recovered.png' });
    assert.equal(container.querySelector('img').getAttribute('src'), '/mock/project_img/recovered.png', '다른 이미지로 바뀌면 이전 실패 상태가 새 이미지를 가리지 않는다');
    if (mode === 'remount') { await unmount(); await render(ImageFromStorage, { ...props, board: '미지원' }); assert.equal(container.querySelector('img'), null); }
  });
}
export async function gridCase(mode = 'page') {
  return domTest(async ({ render, container, act, window, unmount }) => {
    const requests = [];
    const { default: Grid } = loadSource('src/components/home/features/StudyArchiveGrid.tsx', {
      'next/image': { __esModule: true, default: Image },
      '@/lib/supabaseClient': { supabase: { from: () => ({ select: () => ({ order: () => { const r = deferred(); requests.push(r); return {abortSignal:()=>r.promise}; } }) }) } },
    },{AbortSignal});
    await render(Grid); assert.equal(requests.length, 2);
    const rows = Array.from({ length: 13 }, (_, id) => ({ id, filename: null, study_name: `가상 ${id}`, year: 2026, semester: 2 }));
    await act(async () => requests[1].resolve({ data: rows, error: null }));
    const cards = () => [...container.querySelectorAll('[data-study-card]')];
    window.HTMLDialogElement.prototype.showModal=function(){this.open=true};
    window.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new window.Event('close'))};
    const expanded = () => container.querySelector('dialog[open]') ?? undefined;
    await act(async () => cards()[0].click()); assert.ok(expanded());
    if (mode === 'page') {
      assert.equal(container.querySelector('[aria-label="Previous page"]').disabled, true);
      await act(async () => container.querySelector('[aria-label="Next page"]').click()); assert.equal(expanded(), undefined, '페이지 전환과 같은 상태 갱신에서 즉시 닫는다');
      await act(async () => container.querySelector('[aria-label="Previous page"]').click()); assert.equal(expanded(), undefined, '이전 페이지로 돌아와도 선택이 부활하지 않는다');
      await act(async () => cards()[0].click());
      await act(async () => requests[0].resolve({ data: rows, error: null })); assert.ok(expanded(), '이전 요청이나 같은 페이지 때문에 카드를 닫지 않는다');
      await act(async () => container.querySelector('[aria-label="Next page"]').click());
      await act(async () => container.querySelector('[aria-label="Next page"]').click());
      assert.equal(container.querySelector('[aria-label="Next page"]').disabled, true); await act(async () => cards()[0].click()); assert.ok(expanded());
    } else {
      await act(async () => expanded().dispatchEvent(new window.MouseEvent('mousedown', { bubbles: true }))); assert.ok(expanded(), '카드 안쪽 클릭은 유지');
      await act(async () => expanded().close()); assert.equal(expanded(), undefined);
      await act(async () => cards()[0].click()); await act(async () => expanded().dispatchEvent(new window.MouseEvent('click', { clientX:-1,clientY:-1,bubbles:true }))); assert.equal(expanded(), undefined);
      await act(async () => cards()[0].click()); await act(async () => expanded().querySelector('button').click()); assert.equal(expanded(), undefined);
    }
    await unmount();
    await act(async () => window.document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
  });
}
