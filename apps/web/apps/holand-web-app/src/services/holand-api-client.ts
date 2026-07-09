// ============================================
// Holand API Client — direct client for the FastAPI backend (apps/api)
// Used for endpoints that do not require the NextAuth gateway session
// (analytics event ingestion, expert-lab draft/review/publish workflow).
// ============================================

import axios, { AxiosInstance } from 'axios';

function resolveHolandApiUrl(): string {
  return (
    process.env.NEXT_PUBLIC_HOLAND_API_URL?.trim() ||
    process.env.NEXT_PUBLIC_API_GATEWAY_URL?.trim() ||
    'http://localhost:8000'
  );
}

export const holandApiClient: AxiosInstance = axios.create({
  baseURL: resolveHolandApiUrl(),
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

export default holandApiClient;
