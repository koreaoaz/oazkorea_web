/* eslint-disable @typescript-eslint/no-require-imports -- Node preloads this synchronous CommonJS guard. */
// Used only by the opt-in offline build command; inherited by Next worker processes.
const fail = () => { throw new Error('Offline build: network request blocked'); };
globalThis.fetch = async () => { throw new Error('Offline build: fetch blocked'); };
for (const moduleName of ['node:http', 'node:https']) {
  const api = require(moduleName);
  api.request = fail;
  api.get = fail;
}
const net = require('node:net');
const originalConnect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function (...args) {
  const options = args[0];
  // Next uses local IPC/loopback. All external hosts and implicit default hosts are denied.
  const host = typeof options === 'object' ? options?.host : args[1];
  const ipc = typeof options === 'string' && (options.startsWith('\\\\.\\pipe\\') || options.startsWith('/'));
  if (!ipc && !['127.0.0.1', '::1', 'localhost'].includes(host)) return fail();
  return originalConnect.apply(this, args);
};
require('node:tls').connect = fail;
require('node:dgram').createSocket = fail;
