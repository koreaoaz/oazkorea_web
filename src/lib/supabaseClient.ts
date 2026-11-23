import {rolePasswordClient} from './admin/role-password-policy';
import { createClient } from '@supabase/supabase-js';
import { publicDataFetch } from './public-data-fetch';
import {assertPublicConfiguration} from './deployment-guard';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_KEY!;

if (!url || !key) {
  throw new Error("Supabase 환경 변수가 설정되지 않았습니다.");
}

assertPublicConfiguration(url,key);

export const supabase = createClient(url, key, {
  ...(rolePasswordClient?{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}}:process.env.NEXT_PUBLIC_OAZ_DESKTOP_INTEGRATION==='owned-v1'?{auth:{storageKey:process.env.NEXT_PUBLIC_OAZ_E2E_RUN_ID?'oaz-e2e-'+process.env.NEXT_PUBLIC_OAZ_E2E_RUN_ID:'oaz-desktop-integrated-auth-v1'}}:{}),
  global:{fetch:publicDataFetch(url)},
});
