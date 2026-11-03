import { pathToFileURL } from 'node:url';
import nextEnv from '@next/env';
import { checkPreviewEnvironment } from '../src/lib/privacy/preview-environment.mjs';
export { checkPreviewEnvironment } from '../src/lib/privacy/preview-environment.mjs';

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    // Match Next's dotenv precedence, without echoing filenames or values.
    nextEnv.loadEnvConfig(process.cwd(), false, { info() {}, error() {} });
    console.log(checkPreviewEnvironment(process.env));
  } catch (error) {
    console.error(error instanceof Error && /^PREVIEW_STOP:[A-Z_]+$/.test(error.message) ? error.message : 'PREVIEW_STOP:INVALID_CONFIGURATION');
    process.exitCode = 1;
  }
}
