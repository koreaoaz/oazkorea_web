import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fixture, nodes } from './helpers/hooks-harness.mjs';

const parser = fixture('src/app/editor/utils/parsing_first.ts', 'getEventImages');
const first = fixture('src/app/editor/utils/parsing_first.ts', 'getFirstImageFilename');
test('STEP 131: 행사 JSONB의 유효한 객체·비정상 원소·순서·원본 보존', () => {
  const a = Object.freeze({ filename: '가상-a.png', order: 8 });
  const b = Object.freeze({ filename: '가상-b.png', order: -2 });
  const raw = Object.freeze([null, 7, 'bad', {}, { filename: 7, order: 0 }, a, { filename: 'bad.png' }, b]);
  const images = parser.render(raw);
  assert.deepEqual(Array.from(images), [a, b]); assert.equal(first.render(raw), a.filename);
  assert.equal(raw.length, 8); assert.equal(raw[5], a); assert.equal(images[0].order, 8);
  for (const value of [null, 1, true, {}, 'broken', 'null', '{}', '7', '[1,null]']) assert.equal(parser.render(value).length, 0);
  for (const value of [{ filename: '', order: 0 }, { filename: '  ', order: 0 }, { filename: 'x', order: Infinity }, { filename: 'x', order: '0' }]) assert.equal(parser.render([value]).length, 0);
  const parsed = parser.render(JSON.stringify([a, null, b]));
  assert.deepEqual(JSON.parse(JSON.stringify(parsed)), [a, b]);
});
for (const folder of ['6_event', 'event']) {
  test(`STEP 131: ${folder}의 업로드 및 INSERT 이미지 payload는 기존 순서를 유지`, async () => {
    const calls = [];
    const h = fixture(`src/app/editor/boards/${folder}/EventForm.tsx`, 'EventForm', {
      'next/image': { default: 'Image' },
      '../../services/board.service': { insertPost: async (table, payload) => calls.push({ table, payload }) },
      '../../services/storage.service': { uploadImage: async (bucket, file) => { assert.equal(bucket, 'card_news'); return file.path; } },
      '../../hooks/useImageUpload': { useMultiImageUpload: () => ({ files: [{ path: '가상-a.png' }, { path: '가상-b.png' }], previews: [], reset() {} }) },
      '../../constants': { BOARD_TABLE_MAP: { 행사: 'editor_6_events' } },
      '../../components/common/FormField': { FormField: 'Field' }, '../../utils/inputformClasses': { textareaBase: '' },
    });
    h.render(); h.set(0, '가상 행사'); h.set(1, '가상 설명');
    await nodes(h.render(), (node) => node.type === 'form')[0].props.onSubmit({ preventDefault() {} });
    assert.equal(calls.length, 1); assert.equal(calls[0].table, 'editor_6_events');
    assert.deepEqual(JSON.parse(JSON.stringify(calls[0].payload.filenames)), [{ filename: '가상-a.png', order: 0 }, { filename: '가상-b.png', order: 1 }]);
  });
}
test('STEP 131: 행사 상세는 표시 가능한 이미지만 order로 정렬하며 DB 원본 배열은 유지', async () => {
  const raw = Object.freeze([Object.freeze({ filename: 'b.png', order: 7 }), null, Object.freeze({ filename: 'a.png', order: 2 })]);
  const h = fixture('src/app/events/archive/components/EventDetail.tsx', 'default', {
    '@/lib/project-activities': {isNewsActivity:()=>false},
    '@/lib/local-news-editions': {archivedNewsHref:async()=>null},
    '@/lib/news-release': {matchesReleaseNews:async()=>false},
    '@/lib/news-provenance': {verifiedNewsSource:()=>undefined},
    '@/components/NewsGallery': {NewsGallery:'Gallery'},
    '@/lib/image-delivery': {imageURL:()=>''},
    '@/lib/news': {newsSource:()=>undefined,newsDate:value=>value?.slice(0,10)},
    '@/components/NewsSource': {NewsSource:'Source'},
    'next/link': {__esModule:true,default:'a'},
    '@/components/LocaleProvider': {T:'T'},
    '@/lib/supabaseClient': { supabase: { from: () => ({ select: (columns) => { assert.equal(columns,'id,title,description,created_at,filenames');return { eq: () => ({ maybeSingle: async () => ({ data: { id:0,title: '가상', filenames: raw }, error: null }) }) } } }) } },
    'next/navigation': { notFound: () => assert.fail('가상 게시글이 존재한다') },
    '@/app/events/archive/components/ImageFromStorage': { ImageFromStorage: 'Image' },
    '@/components/TranslatedContent': { TranslatedContent: 'Content' },
    '@/app/editor/utils/parsing_first': { getEventImages: (value) => parser.render(value) },
  });
  const output = await h.render({ params: Promise.resolve({ id: '0' }) });
  assert.deepEqual(nodes(output, (node) => node.type === 'Image').map((node) => node.props.filename), ['a.png', 'b.png']);
  assert.equal(raw[0].filename, 'b.png'); assert.equal(raw[1], null);
});
