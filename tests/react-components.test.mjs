import { test } from 'node:test';
import assert from 'node:assert/strict';
import { domTest, loadSource, Image } from './helpers/react-dom.mjs';

test('STEP 131 실제 React DOM: Editor 행사 JSONB 표시와 원본 보존', async () => domTest(async ({ render, container }) => {
  const raw = Object.freeze([null, { filename: 7 }, Object.freeze({ filename: 'mock.png', order: 7 })]);
  const { PostList } = loadSource('src/app/editor/components/PostList.tsx', {
    'next/image': { default: Image, __esModule: true },
    '../services/board.service': {}, '../services/order.service': {},
    '../services/storage.service': { getPublicImageUrl: (bucket, name) => `/mock/${bucket}/${name}` },
  });
  await render(PostList, { board: '행사', posts: [{ id: 1, title: '가상 행사', description: null, filenames: raw }], loading: false, reload() {}, setPosts() {} });
  assert.equal(container.querySelector('img').getAttribute('src'), '/mock/card_news/mock.png');
  assert.match(container.textContent, /가상 행사/); assert.equal(raw.length, 3);
}));
