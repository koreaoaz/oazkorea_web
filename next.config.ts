import { checkPreviewEnvironment } from './src/lib/privacy/preview-environment.mjs';

// Also protects builds that call `next build` directly instead of npm run build.
checkPreviewEnvironment(process.env);

/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_OAZ_VERCEL: process.env.VERCEL ?? '',
    NEXT_PUBLIC_OAZ_DEPLOYMENT_ENV: process.env.VERCEL_ENV ?? 'development',
    NEXT_PUBLIC_OAZ_DEPLOYMENT_BRANCH: process.env.VERCEL_GIT_COMMIT_REF ?? '',
    NEXT_PUBLIC_OAZ_PREVIEW_BRANCH_HOST: process.env.VERCEL_BRANCH_URL ?? '',
    NEXT_PUBLIC_OAZ_PREVIEW_DEPLOYMENT_HOST: process.env.VERCEL_URL ?? '',
    NEXT_PUBLIC_OAZ_PREVIEW_ISOLATED_REF: process.env.VERCEL_ENV === 'preview' ? process.env.OAZ_PREVIEW_ISOLATED_REF ?? '' : '',
  },
  typescript: {
    ignoreBuildErrors: true,
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
