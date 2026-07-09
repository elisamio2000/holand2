'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import type { NativeAiChatSurface } from '@/app/shared/native-ai-chat/native-ai-chat-bridge';
import { chatService } from '@/services/chat.service';
import type { ChatMessage } from '@/types/chat.types';

/**
 * Build stable dock anchor key for (user, surface, page context).
 */
export function buildAnchorKey(
  surface: NativeAiChatSurface,
  ctx: Record<string, unknown>,
  pathname: string
): string {
  const entity =
    ctx.case_id ?? ctx.graph_id ?? ctx.folder_path ?? ctx.conversation_id;
  return entity ? `${surface}:${String(entity)}` : `${surface}:${pathname}`;
}

export interface UseChatDockOptions {
  surface: NativeAiChatSurface;
  pathname: string;
  buildContext: () => Record<string, unknown>;
}

/**
 * Manages dock session lifecycle for floating native AI chat.
 */
export function useChatDock({ surface, pathname, buildContext }: UseChatDockOptions) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const loadingRef = useRef(false);

  const anchorKey = useMemo(
    () => buildAnchorKey(surface, buildContext(), pathname),
    [surface, pathname, buildContext]
  );

  const loadDock = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setIsLoading(true);
    try {
      console.info('[useChatDock] Loading dock:', { surface, anchorKey });
      const existing = await chatService.getDockSession(surface, anchorKey);
      const session =
        existing ?? (await chatService.getOrCreateDockSession(surface, anchorKey));
      setSessionId(session.id);
      const msgs = await chatService.listMessages(session.id, { limit: 100 });
      setMessages(msgs);
    } catch (error: unknown) {
      console.error('[useChatDock] Failed to load dock:', { surface, anchorKey, error });
      setSessionId(null);
      setMessages([]);
    } finally {
      loadingRef.current = false;
      setIsLoading(false);
    }
  }, [surface, anchorKey]);

  const startNewConversation = useCallback(async () => {
    console.info('[useChatDock] New dock conversation:', { surface, anchorKey });
    const session = await chatService.createSession({
      title: 'چت جدید',
      chat_mode: 'surface',
      surface,
      anchor_key: anchorKey,
      is_dock_session: true,
    });
    await chatService.promoteDockSession(session.id);
    setSessionId(session.id);
    setMessages([]);
    return session;
  }, [surface, anchorKey]);

  return {
    sessionId,
    anchorKey,
    messages,
    setMessages,
    isLoading,
    loadDock,
    startNewConversation,
  };
}
