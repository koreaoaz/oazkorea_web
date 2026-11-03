import { assertPublicCredential } from './privacy/public-key';
import { publicDeploymentEnvironment } from './privacy/deployment-environment';
import { checkPreviewEnvironment, assertRuntimeEnvironment } from './privacy/preview-environment.mjs';
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_KEY!;

if (!url || !key) {
  throw new Error("Supabase 환경 변수가 설정되지 않았습니다.");
}

assertPublicCredential(key);
const deployment = publicDeploymentEnvironment();
checkPreviewEnvironment(deployment);
if (typeof window === 'undefined') {
  const runtime = process.env;
  assertRuntimeEnvironment(deployment, runtime);
}

export const supabase = createClient(url, key);
