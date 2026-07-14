// ============================================
// Holand API Client — direct client for the FastAPI backend (apps/api)
// Used for endpoints that do not require the NextAuth gateway session
// (analytics event ingestion, expert-lab draft/review/publish workflow).
// ============================================

import axios, { AxiosInstance } from 'axios';

function resolveHolandApiUrl(): string {
  const configured =
    process.env.NEXT_PUBLIC_HOLAND_API_URL?.trim() ||
    process.env.NEXT_PUBLIC_API_GATEWAY_URL?.trim() ||
    '';

  // Browser calls should prefer same-origin proxy to avoid CORS on direct :8000/:8001 targets.
  if (typeof window !== 'undefined') {
    if (!configured) {
      return '/api/gateway';
    }
    try {
      const parsed = new URL(configured, window.location.origin);
      if (parsed.origin !== window.location.origin) {
        return '/api/gateway';
      }
    } catch {
      return '/api/gateway';
    }
    return configured;
  }

  return configured || 'http://localhost:8000';
}

export const holandApiClient: AxiosInstance = axios.create({
  baseURL: resolveHolandApiUrl(),
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

export default holandApiClient;
