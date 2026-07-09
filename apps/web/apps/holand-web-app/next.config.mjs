import './src/env.mjs';
/** @type {import('next').NextConfig} */

const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'randomuser.me',
        pathname: '/api/portraits/**',
      },
      {
        protocol: 'https',
        hostname: 'cloudflare-ipfs.com',
        pathname: '/ipfs/**',
      },
      {
        protocol: 'https',
        hostname: 'avatars.githubusercontent.com',
        pathname: '/u/**',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
      },
      {
        protocol: 'https',
        hostname: 'flagcdn.com',
      },
      {
        protocol: 'https',
        hostname: 'utfs.io',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 's3.amazonaws.com',
        pathname: '/redqteam.com/holand-platform/public/**',
      },
      {
        protocol: 'https',
        hostname: 'holand-platform.s3.amazonaws.com',
      },
      {
        protocol: 'https',
        hostname: 'holand-platform.vercel.app',
      },
    ],
  },
  reactStrictMode: true,
  transpilePackages: ['core'],

  // Temporarily ignore ESLint during build for development
  // TODO: Remove this and fix all ESLint warnings
  eslint: {
    ignoreDuringBuilds: true,
  },

  // ---- Backend API Proxy ----
  // All backend communication goes through the API Gateway (port 8000)
  // via a single proxy route at /api/gateway/*.
  // See: src/app/api/gateway/[...path]/route.ts
  //
  // NOTE: /api/auth-svc/* is deprecated (returns 410 Gone).
  // NOTE: Rewrites were removed because they don't forward headers properly.
};

export default nextConfig;
