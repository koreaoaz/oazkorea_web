import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, unlinkSync, rmdirSync, lstatSync, existsSync } from 'node:fs';

const baseHash = '2c7a7a34593e5cfed813d5c6cd661ef52018d71c099c9063e4dfad89b3420830';
const hash = value => createHash('sha256').update(value).digest('hex');
export const OAUTH_ORIGIN = 'http://127.0.0.1:3000';
export const OAUTH_CALLBACK = 'http://127.0.0.1:56321/auth/v1/callback';
export function validateOAuthCredentials(env) {
  if (!/^[A-Za-z0-9]{10,64}$/.test(env.GITHUB_TEST_CLIENT_ID ?? '') ||
      !/^[A-Za-z0-9_-]{20,128}$/.test(env.GITHUB_TEST_CLIENT_SECRET ?? '')) throw Error('LOCAL_OAUTH_CREDENTIAL_FORMAT');
}
export function renderOAuthConfig(original) {
  const text = original.toString('utf8').replaceAll('\r\n', '\n');
  if (hash(text) !== baseHash) throw Error('LOCAL_OAUTH_BASE_CONFIG_CHANGED');
  return text + `\n# Temporary independent test App; values remain in process memory only.\n[auth.external.github]\nenabled = true\nclient_id = "env(GITHUB_TEST_CLIENT_ID)"\nsecret = "env(GITHUB_TEST_CLIENT_SECRET)"\nredirect_uri = "${OAUTH_CALLBACK}"\n`;
}
function paths(root) {
  return { config: `${root}/supabase/config.toml`, dir: `${root}/supabase/.oauth-local`,
    backup: `${root}/supabase/.oauth-local/config.original`, state: `${root}/supabase/.oauth-local/session.json` };
}
export function openOAuthConfig(root) {
  const p = paths(root);
  if (lstatSync(`${root}/supabase`).isSymbolicLink() || lstatSync(p.config).isSymbolicLink()) throw Error('LOCAL_OAUTH_REDIRECTED_PATH');
  const original = readFileSync(p.config);
  const temporary = renderOAuthConfig(original);
  mkdirSync(p.dir); // Exclusive session lock. Never overwrite an old recovery session.
  writeFileSync(p.backup, original, { flag: 'wx', mode: 0o600 });
  writeFileSync(p.state, JSON.stringify({ ownerPid: process.pid, ready: false }), { flag: 'wx', mode: 0o600 });
  writeFileSync(p.config, temporary);
}
export function restoreOAuthConfig(root, close = false) {
  const p = paths(root);
  if (!existsSync(p.dir)) return;
  for (const path of [p.dir, p.config, p.backup, p.state]) if (lstatSync(path).isSymbolicLink()) throw Error('LOCAL_OAUTH_REDIRECTED_PATH');
  const original = readFileSync(p.backup);
  const temporary = renderOAuthConfig(original);
  const current = readFileSync(p.config);
  if (!current.equals(original) && !current.equals(Buffer.from(temporary))) throw Error('LOCAL_OAUTH_CONFIG_CONCURRENT_CHANGE');
  writeFileSync(p.config, original);
  if (close) {
    unlinkSync(p.backup); unlinkSync(p.state); rmdirSync(p.dir);
  }
}
export function oauthSession(root, ready) {
  const p = paths(root);
  if (lstatSync(p.dir).isSymbolicLink() || lstatSync(p.state).isSymbolicLink()) throw Error('LOCAL_OAUTH_REDIRECTED_PATH');
  const state = JSON.parse(readFileSync(p.state, 'utf8'));
  if (!Number.isSafeInteger(state.ownerPid) || state.ownerPid <= 0 || typeof state.ready !== 'boolean' ||
      Object.keys(state).some(key => !['ownerPid', 'ready', 'ui', 'containers'].includes(key))) throw Error('LOCAL_OAUTH_SESSION_REQUIRED');
  if (ready !== undefined) {
    if (state.ownerPid !== process.pid) throw Error('LOCAL_OAUTH_SESSION_OWNER');
    state.ready = ready === true;
    writeFileSync(p.state, JSON.stringify(state));
  }
  return state;
}
export function validUiIdentity(value) {
  return !!value && Object.keys(value).length === 3 && Number.isSafeInteger(value.pid) && value.pid > 0 &&
    /^[1-9][0-9]{10,20}$/.test(value.startedTicks ?? '') && /^[a-f0-9]{64}$/.test(value.commandSha256 ?? '');
}
export function recordOAuthUi(root, identity) {
  if (!validUiIdentity(identity)) throw Error('LOCAL_OAUTH_UI_IDENTITY_REQUIRED');
  const state = oauthSession(root);
  if (state.ownerPid !== process.pid) throw Error('LOCAL_OAUTH_SESSION_OWNER');
  writeFileSync(paths(root).state, JSON.stringify({ ...state, ui: identity }));
}
export function recordOAuthContainers(root, ids) {
  if (!Array.isArray(ids) || !ids.length || ids.some(id => !/^[a-f0-9]{64}$/.test(id)) || new Set(ids).size !== ids.length) throw Error('LOCAL_OAUTH_CONTAINER_ID');
  const state = oauthSession(root);
  if (state.ownerPid !== process.pid) throw Error('LOCAL_OAUTH_SESSION_OWNER');
  writeFileSync(paths(root).state, JSON.stringify({ ...state, containers: [...ids] }));
}
export function clearOAuthCredentials(env) {
  delete env.GITHUB_TEST_CLIENT_ID; delete env.GITHUB_TEST_CLIENT_SECRET;
}
export async function oauthLifecycle(root, adapters, env) {
  let ui;
  let opened = false;
  try {
    validateOAuthCredentials(env);
    openOAuthConfig(root);
    opened = true;
    await adapters.start(() => restoreOAuthConfig(root));
    restoreOAuthConfig(root);
    clearOAuthCredentials(env); // Subsequent commands/UI never inherit the provider secret.
    await adapters.initialize();
    oauthSession(root, true);
    ui = await adapters.serve();
    await adapters.wait(ui);
  } finally {
    clearOAuthCredentials(env);
    if (opened) {
      let uiClosed = false;
      try { await adapters.closeUi(ui); uiClosed = true; }
      finally {
        try { restoreOAuthConfig(root); }
        finally {
          let stopped = false;
          try { await adapters.stop(); stopped = true; }
          finally { restoreOAuthConfig(root, stopped && uiClosed); } // Retain ownership evidence if shutdown failed.
        }
      }
    }
  }
}
