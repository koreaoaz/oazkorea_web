import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import React, { act } from 'react';
import { JSDOM } from 'jsdom';

const require = createRequire(import.meta.url);
const base = path.resolve(new URL('../..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const forbidden = () => { throw new Error('테스트의 실제 네트워크 요청 금지'); };
// 실제 React/React DOM을 쓰되 앱 모듈의 Supabase 및 fetch는 명시적 모의 객체만 허용한다.
export function loadSource(file, mocks = {}, globals = {}) {
  const cache = new Map();
  function load(filename) {
    if (cache.has(filename)) return cache.get(filename).exports;
    const loaded = { exports: {} }; cache.set(filename, loaded);
    const source = ts.transpileModule(readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    }).outputText;
    vm.runInNewContext(source, {
      module: loaded, exports: loaded.exports,
      console, window: globalThis.window, document: globalThis.document, localStorage: globalThis.window?.localStorage,
      URLSearchParams, AbortController, setTimeout, clearTimeout, setInterval, clearInterval,
      requestAnimationFrame: (fn) => globalThis.window.requestAnimationFrame(fn),
      cancelAnimationFrame: (id) => globalThis.window.cancelAnimationFrame(id), fetch: forbidden,
      require(name) {
        if (Object.hasOwn(mocks, name)) return mocks[name];
        if (['react', 'react/jsx-runtime', 'clsx', 'date-fns', 'date-fns/locale', 'xlsx'].includes(name)) return require(name);
        if (name.includes('supabaseClient')) throw new Error('Supabase는 모의 객체를 주입해야 한다');
        const resolved = name.startsWith('@/') ? path.join(base, 'src', name.slice(2)) : name.startsWith('.') ? path.resolve(path.dirname(filename), name) : null;
        if (!resolved) throw new Error(`허용하지 않은 모듈: ${name}`);
        const target = ['', '.ts', '.tsx'].map((ext) => resolved + ext).find(existsSync);
        if (!target) throw new Error(`소스 없음: ${name}`);
        return load(target);
      },
      ...globals,
    }, { filename });
    return loaded.exports;
  }
  return load(path.join(base, file));
}
export async function domTest(run) {
  // resources/runScripts를 활성화하지 않아 이미지·스크립트 등 외부 리소스를 로드하지 않는다.
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'https://fixture.invalid', pretendToBeVisual: true });
  const descriptors = new Map();
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true })) {
    descriptors.set(key, Object.getOwnPropertyDescriptor(globalThis, key)); Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
  }
  dom.window.fetch = forbidden; dom.window.XMLHttpRequest.prototype.open = forbidden; dom.window.WebSocket = forbidden;
  // React의 입력 이벤트 지원 감지가 DOM 생성 뒤에 실행되도록 한다.
  const { createRoot, hydrateRoot } = await import('react-dom/client');
  const container = dom.window.document.getElementById('root');
  let root;
  const render = async (Component, props = {}, strict = true) => {
    root ??= createRoot(container);
    await act(async () => root.render(strict ? React.createElement(React.StrictMode, null, React.createElement(Component, props)) : React.createElement(Component, props)));
  };
  try {
    await run({ React, act, window: dom.window, container, render,
      hydrate: async (Component, options = {}) => { await act(async () => { root = hydrateRoot(container, React.createElement(React.StrictMode, null, React.createElement(Component)), options); }); },
      unmount: async () => { if (root) { await act(async () => root.unmount()); root = undefined; } },
    });
  } finally {
    if (root) await act(async () => root.unmount());
    dom.window.close();
    for (const [key, descriptor] of descriptors) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; }
  }
}
export const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
export const Image = (props) => React.createElement('img', { src: props.src, alt: props.alt, className: props.className, width: props.width, height: props.height, onError: props.onError });
