// ============================================
// TTS Service — calls Next.js /api/tts/* (same origin)
// ============================================

import axios from 'axios';
import type { TtsRunArgs, TtsRunResponse, TtsHealthResponse } from '@/types/tts.types';

const ttsApi = axios.create({
  baseURL: '',
  timeout: 300_000,
});

export const ttsService = {
  async run(args: TtsRunArgs): Promise<TtsRunResponse> {
    const res = await ttsApi.post<TtsRunResponse>('/api/tts/run', { args });
    return res.data;
  },

  async health(): Promise<TtsHealthResponse> {
    const res = await ttsApi.get<TtsHealthResponse>('/api/tts/health');
    return res.data;
  },
};
