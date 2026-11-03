import { existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

export function localExecutable(command) {
  if (process.platform !== 'win32') return command;
  if (command === 'supabase') {
    const binary = fileURLToPath(new URL('../build/tools/supabase-2.54.11/supabase.exe', import.meta.url));
    if (existsSync(binary)) {
      // Official v2.54.11 release archive SHA 0dc069ca...cb7c6; no system install.
      if (createHash('sha256').update(readFileSync(binary)).digest('hex') !== 'e0216601cb495fab7f583dd1dd53a4954c40d73726ffcb35f7b5429eda795bf6') throw Error('LOCAL_CLI_BINARY_CHANGED');
      return binary;
    }
  }
  if (command === 'docker') {
    const candidates = ['C:/Program Files/Docker/Docker/resources/bin/docker.exe',
      `${process.env.LOCALAPPDATA}/Programs/DockerDesktop/resources/bin/docker.exe`];
    return candidates.find(existsSync) ?? command;
  }
  return command;
}
