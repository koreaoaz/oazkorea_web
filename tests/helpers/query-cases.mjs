import assert from 'node:assert/strict';
import { domTest, loadSource, deferred, Image } from './react-dom.mjs';

export async function publicQueryCase(kind, outcome, remount = false) {
  return domTest(async ({ React, act, render, container, unmount }) => {
    const requests = [], calls = [];
    const project = kind === 'project';
    const supabase = { rpc:async()=>({data:null,error:{code:'PGRST202'}}), from(table) {
      if(project&&table==='editor_6_events')return {select:()=>({order:async()=>({data:[],error:null})})};
      if(!project&&table==='editor_2_studies')return {select:columns=>{assert.equal(columns,'id,study_name,leader,outline,year,semester');return Promise.resolve({data:[],error:null})}};
      calls.push(table); assert.equal(table, project ? 'editor_1_projects' : 'editor_3_study_timetable');
      return { select: () => ({ order: (column) => { assert.equal(column, project ? 'created_at' : 'start_time'); const r = deferred(); requests.push(r); return r.promise; } }) };
    } };
    const mocks = {
      'next/navigation': { useSearchParams: () => new URLSearchParams() },
      '@/lib/supabaseClient': { supabase },
      '../../../components/projects/ProjectGrid': { __esModule: true, default: ({ Projects, isLoading }) => React.createElement('div', { 'data-loading': String(isLoading) }, Projects.map((p) => p.title).join(',')) },
      '../../../components/projects/ProjectModal': { __esModule: true, default: () => null },
      'lucide-react': { Loader2: () => null, AlertCircle: () => null },
    };
    const loaded = loadSource(project ? 'src/app/projects/archives/page.tsx' : 'src/components/home/features/Timetable.tsx', mocks);
    const Component = project ? loaded.default : loaded.TimetableDemo;
    await render(Component); assert.equal(requests.length, 2, '실제 Strict Mode의 setup/cleanup/setup');
    if (project) assert.equal(container.querySelector('[data-loading]').dataset.loading, 'true'); else assert.match(container.textContent, /\uC2DC\uAC04\uD45C\uB97C \uBD88\uB7EC\uC624\uB294 \uC911/);
    const row = project ? { id: 1, project_name: '가상 프로젝트', year: 2026, semester: 2, tech_stack: ['TS'], filename: null, image_url: null } : { id: 1, study_name: '가상 스터디', leader: null, color: null, start_time: '월요일 11:00', end_time: '월요일 12:00' };
    await act(async () => requests[1].resolve({ data: outcome === 'success' ? [row] : outcome === 'empty' ? [] : null, error: outcome === 'error' ? { message: '가상 오류' } : null }));
    if (outcome === 'error') assert.match(container.textContent, /불러오지 못했습니다/);
    else if (outcome === 'success') assert.match(container.textContent, /가상/);
    else if (!project) assert.match(container.textContent, /\uC544\uC9C1 \uB4F1\uB85D\uB41C \uC2A4\uD130\uB514/);
    if (project) assert.equal(container.querySelector('[data-loading]').dataset.loading, 'false');
    await act(async () => requests[0].resolve({ data: [], error: null }));
    if (outcome === 'success') assert.match(container.textContent, /가상/, '이전 응답이 최신 결과를 지우지 않는다');
    await unmount();
    if (remount) { await render(Component); assert.equal(requests.length, 4); if (project) assert.equal(container.querySelector('[data-loading]').dataset.loading, 'true'); else assert.match(container.textContent, /\uC2DC\uAC04\uD45C\uB97C \uBD88\uB7EC\uC624\uB294 \uC911/); }
  });
}

export async function boardQueryCase(mode = 'race') {
  return domTest(async ({ React, act, render, unmount }) => {
    const requests = [];
    const { useBoardPosts } = loadSource('src/app/editor/hooks/useBoardPosts.ts', {
      '../services/board.service': { fetchPosts: (table) => { const r = { table, ...deferred() }; requests.push(r); return r.promise; } },
    });
    let state;
    function Probe({ board }) { state = useBoardPosts(board); return React.createElement('div', null, state.loading ? '로딩' : state.error ?? JSON.stringify(state.posts)); }
    await render(Probe, { board: '공지' }); assert.equal(requests.length, 2); assert.equal(state.loading, true);
    const old = requests[1];
    const oldSetPosts = state.setPosts;
    if (mode === 'race') {
      await render(Probe, { board: '프로젝트' }); assert.equal(state.loading, true); assert.equal(state.posts.length, 0);
      await act(async () => requests.at(-1).resolve([{ id: 3 }]));
      await act(async () => old.resolve([{ id: 1 }])); assert.equal(state.posts[0].id, 3);
      await act(async () => requests[0].reject(new Error('가상 오래된 실패'))); assert.equal(state.posts[0].id, 3); assert.equal(state.error, null);
      await act(async () => oldSetPosts([{ id: 77 }])); assert.equal(state.posts[0].id, 3); assert.equal(state.loading, false, '이전 보드의 등록 callback도 새 보드를 덮어쓰지 않는다');
      await render(Probe, { board: '공지' }); assert.equal(state.loading, true, '빠른 A→B→A도 재조회한다');
    } else {
      await act(async () => old.resolve([{ id: 1 }]));
      const stable = state.reload; await render(Probe, { board: '공지' }); assert.equal(state.reload, stable); assert.equal(requests.length, 2);
      await act(async () => state.reload()); assert.equal(state.loading, true); assert.equal(requests.length, 3);
      if (mode === 'error') await act(async () => requests[2].reject(new Error('가상 조회 실패')));
      else await act(async () => requests[2].resolve([]));
      assert.equal(state.loading, false); assert.equal(Boolean(state.error), mode === 'error');
      await act(async () => state.setPosts((previous) => [{ id: 5 }, ...previous])); assert.equal(state.posts[0].id, 5);
    }
    await unmount();
    await act(async () => requests.at(-1).resolve([]));
  });
}

export async function blogQueryCase(mode = 'search') {
  return domTest(async ({ React, act, render, container, window, unmount }) => {
    const requests = [];
    const { default: Blog } = loadSource('src/app/blog/members-tech-blog/page.tsx', {
      'next/image': { __esModule: true, default: Image },
      'next/link': { __esModule: true, default: (props) => React.createElement('a', { href: props.href }, props.children) },
    }, { fetch: (url, options) => { const r = { url, options, ...deferred() }; requests.push(r); return r.promise; } });
    const respond = async (r, title = '가상 최신') => act(async () => r.resolve({ ok: true, text: async () => JSON.stringify({ total: 30, items: [{ id: title, title, description: '', author: '가상', date: '', link: '/mock' }] }) }));
    await render(Blog); assert.equal(requests.length, 2); assert.equal(requests[0].options.signal.aborted, true);
    if (mode === 'race') {
      await respond(requests[1]);
      const next = [...container.querySelectorAll('button')].find((button) => button.textContent === '다음');
      await act(async () => next.click()); const newest = requests.at(-1); await respond(newest);
      await act(async () => requests[0].reject(new Error('가상 오래된 오류')));
      assert.match(container.textContent, /가상 최신/); assert.doesNotMatch(container.textContent, /불러오지 못했습니다/);
    } else if (mode === 'abort') {
      await act(async () => requests[0].reject({ name: 'AbortError' }));
      await respond(requests[1]); assert.match(container.textContent, /가상 최신/);
    } else if (mode === 'empty') {
      await act(async () => requests[1].resolve({ ok: true, text: async () => JSON.stringify({ total: 0, items: [] }) }));
      assert.match(container.textContent, /피드가 존재하지 않습니다/);
    } else if (mode === 'error') {
      await act(async () => requests[1].reject(new Error('가상 실패'))); assert.match(container.textContent, /불러오지 못했습니다/);
    } else {
      await respond(requests[1]);
      await act(async () => [...container.querySelectorAll('button')].find((button) => button.textContent === '다음').click()); await respond(requests.at(-1));
      const input = container.querySelector('input');
      await act(async () => { Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(input, '가상 검색'); input.dispatchEvent(new window.Event('input', { bubbles: true })); });
      const count = requests.length; assert.equal(count, 3, '입력만으로 추가 요청하지 않는다');
      await act(async () => input.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true })));
      assert.equal(requests.length, count + 1); assert.equal(new URL(requests.at(-1).url, 'https://fixture.invalid').searchParams.get('page'), '0');
      assert.equal(new URL(requests.at(-1).url, 'https://fixture.invalid').searchParams.get('q'), '가상 검색');
      await respond(requests.at(-1)); assert.equal(requests.length, count + 1, '검색 후 page=0 추가 중복 요청을 만들지 않는다');
      await act(async () => [...container.querySelectorAll('button')].find((button) => button.textContent === '다음').click());
      assert.equal(new URL(requests.at(-1).url, 'https://fixture.invalid').searchParams.get('q'), '가상 검색', '페이지 이동은 제출된 검색 조건을 쓴다');
    }
    await unmount(); assert.equal(requests.at(-1).options.signal.aborted, true);
  });
}
