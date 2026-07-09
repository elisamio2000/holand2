'use client';

import { useCallback, useState } from 'react';
import { messagesService } from '@/services/messages.service';
import type { MessagesApiHealthEndpointStatus } from '@/app/shared/messages/config/messages-api-requirements';

export type { MessagesApiHealthEndpointStatus };

export interface MessagesApiHealth {
  mailList: MessagesApiHealthEndpointStatus;
  chatConversations: MessagesApiHealthEndpointStatus;
  wsInfo: MessagesApiHealthEndpointStatus;
  isProbing: boolean;
}

const INITIAL_HEALTH: MessagesApiHealth = {
  mailList: 'unknown',
  chatConversations: 'unknown',
  wsInfo: 'unknown',
  isProbing: false,
};

/** Probes mail + user_chat gateway routes for the dev requirements panel. */
export function useMessagesApiHealth() {
  const [health, setHealth] = useState<MessagesApiHealth>(INITIAL_HEALTH);

  const probe = useCallback(async () => {
    setHealth((prev) => ({ ...prev, isProbing: true }));
    try {
      const result = await messagesService.probeApiHealth();
      setHealth({
        mailList: result.mailList,
        chatConversations: result.chatConversations,
        wsInfo: result.wsInfo,
        isProbing: false,
      });
    } catch (error: unknown) {
      console.error('[useMessagesApiHealth] Probe failed:', error);
      setHealth((prev) => ({
        mailList: prev.mailList === 'unknown' ? 'unavailable' : prev.mailList,
        chatConversations:
          prev.chatConversations === 'unknown' ? 'unavailable' : prev.chatConversations,
        wsInfo: prev.wsInfo === 'unknown' ? 'unavailable' : prev.wsInfo,
        isProbing: false,
      }));
    }
  }, []);

  return { health, probe };
}
