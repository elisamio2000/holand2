'use client';

import { useCallback, useState } from 'react';
import { chatService } from '@/services/chat.service';

export type ChatApiEndpointStatus = 'unknown' | 'available' | 'unavailable';

export interface ChatApiHealth {
  memory: ChatApiEndpointStatus;
  tools: ChatApiEndpointStatus;
  feedback: ChatApiEndpointStatus;
  isProbing: boolean;
}

const INITIAL_HEALTH: ChatApiHealth = {
  memory: 'unknown',
  tools: 'unknown',
  feedback: 'unknown',
  isProbing: false,
};

/**
 * Probes optional gateway routes once on mount (via `probe()` from AiChat).
 */
export function useChatApiHealth() {
  const [health, setHealth] = useState<ChatApiHealth>(INITIAL_HEALTH);

  const probe = useCallback(async () => {
    setHealth((prev) => ({ ...prev, isProbing: true }));
    try {
      const result = await chatService.probeApiHealth();
      setHealth({
        memory: result.memory,
        tools: result.tools,
        feedback: result.feedback,
        isProbing: false,
      });
    } catch (error: unknown) {
      console.error('[useChatApiHealth] Probe failed:', error);
      setHealth((prev) => ({
        memory: prev.memory === 'unknown' ? 'unavailable' : prev.memory,
        tools: prev.tools === 'unknown' ? 'unavailable' : prev.tools,
        feedback: prev.feedback === 'unknown' ? 'unavailable' : prev.feedback,
        isProbing: false,
      }));
    }
  }, []);

  return { health, probe };
}
