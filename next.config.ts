import {assertDeploymentEnvironment} from './src/lib/deployment-guard'
import {removeOfflinePreviewTelemetry} from './src/lib/offline-preview'
removeOfflinePreviewTelemetry(process.env)
assertDeploymentEnvironment(process.env)

/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {NEXT_PUBLIC_OAZ_DEPLOYMENT_ENV:process.env.VERCEL_ENV??'',NEXT_PUBLIC_OAZ_PREVIEW_MODE:process.env.OAZ_PREVIEW_MODE??'',NEXT_PUBLIC_OAZ_PREVIEW_ISOLATED_REF:process.env.VERCEL_ENV==='preview'?process.env.OAZ_PREVIEW_ISOLATED_REF??'':''},
  ...(process.env.OAZ_DESKTOP_DEV === 'true'||process.env.OAZ_PREVIEW_MODE==='offline-v1' ? { experimental: { cpus: 2 } } : {}),
  // 로컬 관리자 개발 산출물은 기존 .next와 분리한다.
  distDir: process.env.OAZ_E2E_RUN_ID ? 'build/e2e/'+process.env.OAZ_E2E_RUN_ID+'/next' : process.env.OAZ_DESKTOP_DEV === 'true' ? (process.env.OAZ_DESKTOP_BUILD_ONLY === 'true' ? 'build/desktop-integration-build' : 'build/desktop-next') : process.env.OAZ_ENROLLMENT_BUILD_ONLY === 'true' ? 'build/enrollment16-next' : process.env.OAZ_FINAL_ACCEPTANCE === 'true' ? 'build/final-acceptance-next' : process.env.OAZ_SECURITY_BRIDGE === 'true' ? 'build/security-conflict-next' : process.env.OAZ_LOCAL_ADMIN_DEV === 'true' ? (process.env.OAZ_FINAL_INTEGRATION === 'true' ? 'build/final-integration-next' : process.env.OAZ_ADMIN_BUILD_ONLY === 'true' ? 'build/admin-offline' : process.env.OAZ_ADMIN_VERIFY_STACK === 'true' ? 'build/admin-verification-next' : 'build/admin-next') : '.next',
  // A release may include approved English artifacts. Models and worker caches stay off-server.
  outputFileTracingIncludes: {
    '/api/public/content': ['./server-data/public-english/**/*.json'],
    '/api/public/about': ['./server-data/public-english/**/about/*.json'],
    '/api/public/data/*': ['./server-data/public-english/**/*.json'],
  },
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        port: '',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
}

export default nextConfig
