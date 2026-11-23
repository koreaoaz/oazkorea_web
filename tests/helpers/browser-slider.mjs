import { readFileSync, writeFileSync, mkdtempSync, existsSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import ts from 'typescript';

const require = createRequire(import.meta.url);
export const browserPath = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
function bundleSlider() {
  const modules = [], ids = new Map();
  function add(file) {
    if (ids.has(file)) return ids.get(file);
    const id = modules.length; ids.set(file, id); modules.push(null);
    const raw = file === 'fixture-image' ? 'module.exports={__esModule:true,default:()=>require("react").createElement("div",{style:{height:"169px",background:"#375b84"}})}' : readFileSync(file, 'utf8');
    const code = file.endsWith('.json')?'module.exports='+raw:/\.tsx?$/.test(file) ? ts.transpileModule(raw, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText : raw;
    const deps = {};
    for (const match of code.matchAll(/require\(["']([^"']+)["']\)/g)) {
      const name = match[1];
      const local=name.startsWith('@/')?path.resolve('src',name.slice(2)):name.startsWith('.')&&/\.tsx?$/.test(file)?path.resolve(path.dirname(file),name):null;
      const resolved=local?['','.ts','.tsx','.json'].map(ext=>local+ext).find(existsSync):null;
      deps[name] = add(name === 'next/image' ? 'fixture-image' : resolved??require.resolve(name, { paths: [file === 'fixture-image' ? process.cwd() : path.dirname(file)] }));
    }
    modules[id] = `[function(module,exports,require){${code}\n},${JSON.stringify(deps)}]`;
    return id;
  }
  const react = add(require.resolve('react')), dom = add(require.resolve('react-dom/client'));
  const slider = add(fileURLToPath(new URL('../../src/components/home/features/ImageSlider.tsx', import.meta.url)));
  return `const process={env:{NODE_ENV:"production"}};const modules=[${modules.join(',')}],cache={};function load(id){if(cache[id])return cache[id].exports;const item=cache[id]={exports:{}};const [fn,deps]=modules[id];fn(item,item.exports,name=>load(deps[name]));return item.exports;}const React=load(${react});load(${dom}).createRoot(document.getElementById('root')).render(React.createElement(load(${slider}).default));`;
}
export async function runBrowserSlider() {
  const directory = mkdtempSync(path.join(tmpdir(), 'oaz-slider-'));
  const filename = path.join(directory, 'fixture.html');
  writeFileSync(filename, `<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-oaz131'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'"><style>#root{width:300px}.relative{position:relative}.w-full{width:100%}.aspect-video{aspect-ratio:16/9}.overflow-hidden{overflow:hidden}.flex{display:flex}.flex-shrink-0{flex-shrink:0}.transition-transform{transition-property:transform}.duration-700{transition-duration:700ms}.ease-in-out{transition-timing-function:ease-in-out}</style></head><body><div id="root"></div><script nonce="oaz131">${bundleSlider()}
  window.__OAZ_RESULT={forward:0,midpoint:false,jump:false,restarted:false,errors:[]};
  window.addEventListener('error',e=>window.__OAZ_RESULT.errors.push(e.message));
  let listening=false;
  function sample(){const track=document.querySelector('[style*="translateX"]');if(track){const s=getComputedStyle(track),x=new DOMMatrixReadOnly(s.transform).m41,r=window.__OAZ_RESULT;
    if(!listening){track.addEventListener('transitionend',()=>r.forward++);listening=true;}
    if(x < -310 && x > -590)r.midpoint=true;
    if(track.style.transform==='translateX(-100%)'&&!track.className.includes('transition-transform')&&Math.abs(x+300)<1)r.jump=true;
    if(r.jump&&track.className.includes('transition-transform')&&x < -310&&x > -590)r.restarted=true;
  }requestAnimationFrame(sample)}requestAnimationFrame(sample);
  </script></body></html>`);
  const child = spawn(browserPath, ['--headless=new', '--disable-gpu', '--disable-background-networking', '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--disable-component-update', '--host-resolver-rules=MAP * ~NOTFOUND', '--remote-debugging-port=0', `--user-data-dir=${path.join(directory, 'profile')}`, 'about:blank'], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
  let socket;
  const startupStarted = Date.now();
  let startupMilliseconds;
  try {
    const endpoint = await new Promise((resolve, reject) => {
      let output = ''; const timer = setTimeout(() => reject(new Error(`격리 브라우저 시작 시간 초과: ${Date.now() - startupStarted}ms, 종료 코드 ${child.exitCode}`)), 40000);
      child.once('error', (error) => { clearTimeout(timer); reject(error); });
      child.once('exit', (code) => { clearTimeout(timer); reject(new Error(`격리 브라우저가 시작 전에 종료됨: ${code}`)); });
      child.stderr.on('data', (data) => { output += data; const match = output.match(/DevTools listening on (ws:\/\/127\.0\.0\.1:[^\s]+)/); if (match && startupMilliseconds === undefined) { clearTimeout(timer); startupMilliseconds = Date.now() - startupStarted; resolve(match[1]); } });
    });
    socket = new WebSocket(endpoint); await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
    let sequence = 0; const pending = new Map();
    socket.addEventListener('message', ({ data }) => { const message = JSON.parse(data); if (message.id) { const item = pending.get(message.id); if (item) { pending.delete(message.id); if (message.error) item.reject(new Error(message.error.message)); else item.resolve(message.result); } } });
    const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => { const id = ++sequence; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params, sessionId })); });
    const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
    await send('Network.enable', {}, sessionId); await send('Network.setBlockedURLs', { urls: ['http://*', 'https://*', 'ws://*', 'wss://*'] }, sessionId);
    await send('Page.navigate', { url: pathToFileURL(filename).href }, sessionId);
    const result = await send('Runtime.evaluate', { expression: 'new Promise(resolve=>setTimeout(()=>resolve(window.__OAZ_RESULT),19000))', awaitPromise: true, returnByValue: true }, sessionId);
    if (result.exceptionDetails) throw new Error('브라우저 fixture 실행 실패');
    return { ...result.result.value, startupMilliseconds };
  } finally {
    socket?.close(); child.kill();
    await new Promise((resolve) => { if (child.exitCode !== null) resolve(); else { child.once('exit', resolve); setTimeout(resolve, 3000).unref(); } });
    // 직접 만든 임시 경로만 정리한다. 기존 브라우저 프로필과 프로젝트는 대상에 포함하지 않는다.
    const resolved = path.resolve(directory), parent = path.resolve(tmpdir()) + path.sep;
    if (resolved.startsWith(parent) && path.basename(resolved).startsWith('oaz-slider-')) {
      try { rmSync(resolved, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }); } catch { /* 잠긴 테스트 프로필은 임시 폴더에 남긴다. */ }
    }
  }
}
