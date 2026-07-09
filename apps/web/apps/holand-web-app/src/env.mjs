import { z } from 'zod';
import { createEnv } from '@t3-oss/env-nextjs';

export const env = createEnv({
  /*
   * ServerSide Environment variables, not available on the client.
   */
  server: {
    NODE_ENV: z.enum(['development', 'test', 'production']),
    NEXTAUTH_SECRET:
      process.env.NODE_ENV === 'production'
        ? z.string().min(1)
        : z.string().min(1).optional(),
    NEXTAUTH_URL: z.string().url(),
    NEXTAUTH_URL_INTERNAL: z.string().url().optional(),
    NEXTAUTH_TRUST_HOST: z.enum(['true', 'false']).optional(),

    // Auth API
    AUTH_API_URL: z.string().url().optional(),
    API_GATEWAY_URL: z.string().url().optional(),
    /** Development / explicit LAN beta: see auth-options Credentials + `.env.local.example` */
    AUTH_DEV_BYPASS: z.string().optional(),
    /**
     * When `true`, allows AUTH_DEV_BYPASS even if NODE_ENV=production (e.g. `next start` without gateway).
     * Never enable on public internet — only intranet / demo machines.
     */
    AUTH_DEV_BYPASS_IN_PRODUCTION: z.enum(['true', 'false']).optional(),
    MONGODB_URI: z.string().optional(),
    MONGODB_DB: z.string().optional(),

    // email
    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.string().optional(),
    SMTP_USER: z.string().optional(),
    SMTP_PASSWORD: z.string().optional(),
    SMTP_FROM_EMAIL: z.string().email().optional(),

    GOOGLE_CLIENT_ID: z.string().optional(),
    GOOGLE_CLIENT_SECRET: z.string().optional(),
    FRONTEND_URL: z.string().url().optional(),
    MAP_SERVER_URL: z.string().url().optional(),
    /** Python VoxCPM2 / audio.tts backend (proxied via /api/tts/*) */
    TTS_BACKEND_URL: z.string().url().optional(),
  },
  /*
   * Environment variables available on the client (and server).
   */
  client: {
    NEXT_PUBLIC_APP_NAME: z.string().optional(),
    NEXT_PUBLIC_GOOGLE_MAP_API_KEY: z.string().optional(),
    NEXT_PUBLIC_API_GATEWAY_URL: z.string().url().optional(),
    NEXT_PUBLIC_FRONTEND_URL: z.string().url().optional(),
    NEXT_PUBLIC_MAP_SERVER_URL: z.string().url().optional(),
    /** Geo JSON API base (standalone Next on e.g. :3010). Empty = same-origin /api/geo */
    NEXT_PUBLIC_GEO_BACKEND_ORIGIN: z.string().url().optional(),
    /** Standalone map/geo app root for legacy iframe pages (*-old), e.g. http://192.168.1.62:3010 */
    NEXT_PUBLIC_STANDALONE_MAP_APP_ORIGIN: z.string().url().optional(),
    /** Comma-separated org-internal email domains — sync with backend ALLOWED_INTERNAL_EMAIL_DOMAINS */
    NEXT_PUBLIC_ALLOWED_INTERNAL_EMAIL_DOMAINS: z.string().optional(),
    /** Terms version label — sync with backend REGISTRATION_TERMS_VERSION */
    NEXT_PUBLIC_REGISTRATION_TERMS_VERSION: z.string().optional(),
  },
  runtimeEnv: process.env,
});
