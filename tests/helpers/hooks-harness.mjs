import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

// 상태와 effect 사이의 경계를 수동으로 진행한다. React DOM/paint/브라우저 스케줄러의 대체가 아니다.
export const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
export const settle = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
export function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
export function sourceFunction(path, name) {
  const root = ts.createSourceFile(path, read(path), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const declaration = root.statements.find((node) => ts.isFunctionDeclaration(node) && node.name?.text === name);
  assert.ok(declaration);
  return declaration.getText(root);
}
export function nodes(node, predicate) {
  if (Array.isArray(node)) return node.flatMap((child) => nodes(child, predicate));
  if (!node || typeof node !== 'object' || !node.props) return [];
  return [...(predicate(node) ? [node] : []), ...nodes(node.props.children, predicate)];
}
export function fixture(path, exportName, mocks = {}, globals = {}) {
  const slots = [], pending = new Map(), effects = new Map();
  let cursor = 0;
  const same = (a, b) => a && b && a.length === b.length && a.every((value, i) => Object.is(value, b[i]));
  const hooks = {
    useState(initial) {
      const i = cursor++;
      if (!slots[i]) {
        slots[i] = { value: typeof initial === 'function' ? initial() : initial };
        slots[i].set = (update) => { slots[i].value = typeof update === 'function' ? update(slots[i].value) : update; };
      }
      return [slots[i].value, slots[i].set];
    },
    useRef(initial) { const i = cursor++; return slots[i] ??= { current: initial }; },
    useCallback(callback, deps) {
      const i = cursor++;
      if (!slots[i] || !same(slots[i].deps, deps)) slots[i] = { callback, deps };
      return slots[i].callback;
    },
    useEffect(callback, deps) {
      const i = cursor++;
      if (!slots[i] || !same(slots[i].deps, deps)) { slots[i] = { deps }; pending.set(i, callback); }
    },
  };
  const exports = {};
  const jsx = (type, props) => ({ type, props });
  const source = ts.transpileModule(read(path), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(source, {
    exports,
    console: { error() {}, warn() {}, debug() {}, log() {} },
    fetch: () => assert.fail('실제 네트워크 요청 금지'),
    require(name) {
      if (name === '@/components/AdminSessionLoading') return {AdminSessionLoading: () => null};
      if (name === 'react') return hooks;
      if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx, Fragment: 'Fragment' };
      if (Object.hasOwn(mocks, name)) return mocks[name];
      // Legacy payload fixtures isolate the form boundary; actual DOM submission is tested separately.
      if (name.endsWith('/EditorForm')) return { EditorForm: 'form' };
      assert.fail(`허용하지 않은 import: ${name}`);
    },
    ...globals,
  });
  return {
    render(...args) { cursor = 0; return exports[exportName](...args); },
    flush() {
      for (const [i, callback] of pending) { effects.get(i)?.cleanup?.(); effects.set(i, { callback, cleanup: callback() }); }
      pending.clear();
    },
    replay() { for (const effect of effects.values()) { effect.cleanup?.(); effect.cleanup = effect.callback(); } },
    unmount() { for (const effect of effects.values()) effect.cleanup?.(); },
    state: (i) => slots[i].value,
    set: (i, value) => slots[i].set(value),
  };
}
