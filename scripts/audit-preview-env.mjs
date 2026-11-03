import nextEnv from '@next/env';
import { checkPreviewEnvironment, previewVariableInventory } from '../src/lib/privacy/preview-environment.mjs';

// Uses only existing local/process configuration; never fetches or saves secrets.
try {
  nextEnv.loadEnvConfig(process.cwd(), false, { info() {}, error() {} });
  if (process.env.VERCEL_ENV !== 'preview') throw Error('PREVIEW_STOP:PREVIEW_CONTEXT_REQUIRED');
  const status = checkPreviewEnvironment(process.env);
  console.log(JSON.stringify({ status, variables: previewVariableInventory(process.env),
    values_disclosed: false, remote_sources_verified: false, remote_data_isolation_verified: false,
    publishable_key_project_verified: false }));
} catch (error) {
  const reason = error instanceof Error && /^PREVIEW_STOP:[A-Z_]+$/.test(error.message) ? error.message : 'PREVIEW_STOP:INVALID_CONFIGURATION';
  console.error(JSON.stringify({ status: 'BLOCKED', reason, variables: previewVariableInventory(process.env), values_disclosed: false }));
  process.exitCode = 1;
}
