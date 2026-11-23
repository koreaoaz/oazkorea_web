// Assembly build gate only. Never connects, mints tokens, or applies migrations.
import {pathToFileURL} from 'node:url';
export function verifyProduction(env) {
  const fail = code => { throw Error('PRODUCTION_ASSEMBLY:'+code); };
  if(env.VERCEL!=='1'||env.VERCEL_ENV!=='production') fail('TARGET');
  for(const key of ['OAZ_PREVIEW_MODE','OAZ_PREVIEW_ISOLATED_REF','OAZ_E2E_RUN_ID','NEXT_PUBLIC_OAZ_DESKTOP_INTEGRATION','OAZ_SYNTHETIC_RECOVERY_EMAIL'])if(env[key])fail('TEST_CONTEXT');
  for(const key of ['OAZ_DESKTOP_DEV','OAZ_LOCAL_ADMIN_DEV','OAZ_FINAL_INTEGRATION','OAZ_FINAL_ACCEPTANCE','OAZ_ADMIN_VERIFY_STACK'])if(env[key]==='true')fail('LOCAL_CONTEXT');
  const exact={OAZ_MAIN_RUNTIME_RELEASE:'reviewed-v1',OAZ_ACCOUNTS_RELEASE:'reviewed-v1',OAZ_ENROLLMENT_RELEASE:'reviewed-v1',NEXT_PUBLIC_OAZ_MAIN_RELEASE:'reviewed-v1',OAZ_SECURITY_BRIDGE:'true',OAZ_ADMIN_ENABLED:'true',OAZ_ADMIN_SCHEMA_VERSION:'2',OAZ_ADMIN_AUTH_POLICY:'role-password-v1',NEXT_PUBLIC_OAZ_ADMIN_AUTH_POLICY:'role-password-v1',OAZ_SUPABASE_PROJECT_REF:'maoefmwpdcnugyenyiea',NEXT_PUBLIC_SUPABASE_URL:'https://maoefmwpdcnugyenyiea.supabase.co',OAZ_ADMIN_ORIGIN:'https://www.oazkorea.co.kr',OAZ_RUNTIME_CONTEXT:'production-reviewed'};
  for(const [key,value] of Object.entries(exact))if(env[key]!==value)fail(key);
  if(env.OAZ_GATEWAY_TRANSPORT!=='data-api-v1')fail('GATEWAY_TRANSPORT');
  for(const name of ['OAZ_GATEWAY_JWT_POLICY','OAZ_PUBLIC_READER_JWT','OAZ_IMAGE_READER_JWT','OAZ_MEDIA_UPLOADER_JWT'])if(env[name])fail('LEGACY_GATEWAY_CONFIG');
  if(!env.SUPABASE_SECRET_KEY&&!env.SUPABASE_SERVICE_ROLE_KEY)fail('MISSING_SERVICE_API_KEY');
  const service=env.SUPABASE_SECRET_KEY??env.SUPABASE_SERVICE_ROLE_KEY;
  if(!/^sb_publishable_[A-Za-z0-9_-]+$/.test(env.NEXT_PUBLIC_SUPABASE_KEY??''))fail('PUBLISHABLE_API_KEY_FORMAT');
  if(!/^sb_secret_[A-Za-z0-9_-]+$/.test(service??'')&&!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(service??''))fail('SERVICE_API_KEY_FORMAT');
  for(const key of ['NEXT_PUBLIC_SUPABASE_KEY','OAZ_PDF_VALIDATOR_KEY'])if(!env[key])fail('MISSING_'+key);
  if(!/^[a-f0-9]{64}$/.test(env.OAZ_ACCOUNTS_GATE_KEY??''))fail('GATE_KEY');
  for(const [key,path] of [['OAZ_ACCOUNTS_PRIVATE_GATEWAY','/acceptance-rpc/v1/rpc/'],['OAZ_PDF_VALIDATOR_URL','/v1/normalize']]){
    let u;try{u=new URL(env[key]);}catch{fail('URL');}
    if(u.origin!=='https://www.oazkorea.co.kr'||u.pathname!==path||u.username||u.password||u.search||u.hash)fail(key);
  }
  for(const key of ['OAZ_ACCOUNTS_RECOVERY_DELIVERY','OAZ_SUPERADMIN_RECOVERY_DELIVERY'])if(env[key]!=='smtp-tokenhash-v1')fail(key);
  // Detailed public-secret, TLS and JWT validation also runs in existing web/runtime guards.
  return 'PRODUCTION_CONFIGURATION_PRESENT_NOT_CONNECTIVITY_APPROVAL';
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)console.log(verifyProduction(process.env));
