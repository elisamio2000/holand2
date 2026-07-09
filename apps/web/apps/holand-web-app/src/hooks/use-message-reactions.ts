'use client';

import { useCallback, useEffect, useState } from 'react';
import type { MessageReaction } from '@/app/shared/messages/components/message-reactions';
import { isMockMessagesActive } from '@/app/shared/messages/mock/messages-mock-bridge';
import { userChatService } from '@/services/user-chat.service';

const REACTIONS_KEY = 'messages-reactions';

type ReactionStore = Record<string, MessageReaction[]>;

function aggregateReactions(
  rows: Array<{ emoji: string; user_id?: string; reactedByMe?: boolean }>,
  currentUserId?: string
): MessageReaction[] {
  const map = new Map<string, MessageReaction>();
  for (const row of rows) {
    const emoji = row.emoji;
    const reactedByMe =
      row.reactedByMe ?? (currentUserId ? row.user_id === currentUserId : false);
    const existing = map.get(emoji);
    if (existing) {
      map.set(emoji, {
        emoji,
        count: existing.count + 1,
        reactedByMe: existing.reactedByMe || reactedByMe,
      });
    } else {
      map.set(emoji, { emoji, count: 1, reactedByMe });
    }
  }
  return Array.from(map.values());
}

/**
 * Chat message reactions — API when live, localStorage fallback in mock mode.
 */
export function useMessageReactions(currentUserId?: string) {
  const [store, setStore] = useState<ReactionStore>({});

  useEffect(() => {
    if (!isMockMessagesActive()) return;
    try {
      const raw = localStorage.getItem(REACTIONS_KEY);
      if (raw) setStore(JSON.parse(raw) as ReactionStore);
    } catch {
      /* ignore */
    }
  }, []);

  const persistLocal = useCallback((next: ReactionStore) => {
    setStore(next);
    try {
      localStorage.setItem(REACTIONS_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }, []);

  const getReactions = useCallback(
    (messageId: string): MessageReaction[] => store[messageId] ?? [],
    [store]
  );

  const setReactionsFromApi = useCallback(
    (messageId: string, rows: Array<{ emoji: string; user_id?: string }>) => {
      const nextList = aggregateReactions(rows, currentUserId);
      setStore((prev) => ({ ...prev, [messageId]: nextList }));
    },
    [currentUserId]
  );

  const toggleReaction = useCallback(
    async (messageId: string, emoji: string) => {
      if (isMockMessagesActive()) {
        const current = store[messageId] ?? [];
        const existing = current.find((r) => r.emoji === emoji);
        const myPreviousReaction = current.find((r) => r.reactedByMe);

        let nextList: MessageReaction[];

        if (existing?.reactedByMe) {
          const newCount = existing.count - 1;
          nextList =
            newCount <= 0
              ? current.filter((r) => r.emoji !== emoji)
              : current.map((r) =>
                  r.emoji === emoji ? { ...r, count: newCount, reactedByMe: false } : r
                );
        } else {
          let intermediate = current;
          if (myPreviousReaction) {
            const prevCount = myPreviousReaction.count - 1;
            intermediate =
              prevCount <= 0
                ? current.filter((r) => r.emoji !== myPreviousReaction.emoji)
                : current.map((r) =>
                    r.emoji === myPreviousReaction.emoji
                      ? { ...r, count: prevCount, reactedByMe: false }
                      : r
                  );
          }

          const existingInIntermediate = intermediate.find((r) => r.emoji === emoji);
          nextList = existingInIntermediate
            ? intermediate.map((r) =>
                r.emoji === emoji ? { ...r, count: r.count + 1, reactedByMe: true } : r
              )
            : [...intermediate, { emoji, count: 1, reactedByMe: true }];
        }

        persistLocal({ ...store, [messageId]: nextList });
        return;
      }

      const current = store[messageId] ?? [];
      const existing = current.find((r) => r.emoji === emoji);
      const shouldRemove = existing?.reactedByMe;

      try {
        const result = shouldRemove
          ? await userChatService.removeReaction(messageId, emoji)
          : await userChatService.addReaction(messageId, emoji);
        const data = (result.data ?? {}) as Record<string, unknown>;
        const reactionsRaw = Array.isArray(data.reactions) ? data.reactions : [];
        const rows = reactionsRaw.map((row) => {
          const item = row as Record<string, unknown>;
          return {
            emoji: String(item.emoji ?? ''),
            user_id: item.user_id ? String(item.user_id) : undefined,
          };
        });
        setReactionsFromApi(messageId, rows);
      } catch (error) {
        console.warn('[useMessageReactions] API toggle failed — local optimistic update.', error);
        const optimistic = existing?.reactedByMe
          ? current.filter((r) => r.emoji !== emoji || r.count > 1).map((r) =>
              r.emoji === emoji ? { ...r, count: r.count - 1, reactedByMe: false } : r
            )
          : [...current.filter((r) => !r.reactedByMe), { emoji, count: 1, reactedByMe: true }];
        setStore((prev) => ({ ...prev, [messageId]: optimistic }));
      }
    },
    [currentUserId, persistLocal, setReactionsFromApi, store]
  );

  return { getReactions, toggleReaction, setReactionsFromApi };
}
