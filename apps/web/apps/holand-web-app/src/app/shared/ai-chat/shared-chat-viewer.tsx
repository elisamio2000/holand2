'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PiLockKey, PiShareNetwork, PiWarning } from 'react-icons/pi';
import cn from '@core/utils/class-names';
import { chatService } from '@/services/chat.service';
import MarkdownRenderer from '@/app/shared/ai-chat/markdown-renderer';
import { ContentLoadingState } from '@/app/shared/loading';
import type { PublicShareMessage, PublicShareResolveResponse } from '@/types/chat.types';

type ViewerState = 'loading' | 'ready' | 'expired' | 'error';

interface SharedChatViewerProps {
  token: string;
}

export default function SharedChatViewer({ token }: SharedChatViewerProps) {
  const { t } = useTranslation();
  const [state, setState] = useState<ViewerState>('loading');
  const [meta, setMeta] = useState<PublicShareResolveResponse | null>(null);
  const [messages, setMessages] = useState<PublicShareMessage[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setState('loading');
      try {
        const resolved = await chatService.resolvePublicShare(token);
        const msgs = await chatService.getPublicShareMessages(token);
        if (cancelled) return;
        setMeta(resolved);
        setMessages(msgs);
        setState('ready');
      } catch (error: unknown) {
        if (cancelled) return;
        const status = (error as { response?: { status?: number } })?.response?.status;
        if (status === 410 || status === 404) {
          setState('expired');
        } else {
          setState('error');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (state === 'loading') {
    return (
      <ContentLoadingState
        variant="page"
        label={t('chatPage.sharedViewer.loading')}
      />
    );
  }

  if (state === 'expired') {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center gap-3 px-4 py-16 text-center">
        <PiWarning className="h-10 w-10 text-amber-500" />
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {t('chatPage.sharedViewer.expired')}
        </p>
      </div>
    );
  }

  if (state === 'error' || !meta) {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center gap-3 px-4 py-16 text-center">
        <PiWarning className="h-10 w-10 text-red-400" />
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {t('chatPage.sharedViewer.error')}
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-full min-h-0 max-w-3xl flex-col px-4 py-6">
      <div className="mb-4 flex items-start gap-3 border-b border-muted pb-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
          <PiShareNetwork className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold text-gray-900 dark:text-gray-100">
            {meta.title || t('chatPage.sharedViewer.title')}
          </h1>
          {meta.owner_display_name && (
            <p className="text-xs text-gray-500">
              {t('chatSidebar.sharedBy', { name: meta.owner_display_name })}
            </p>
          )}
          {meta.message_count != null && (
            <p className="text-xs text-gray-400">
              {t('chatPage.sharedViewer.messageCount', { count: meta.message_count })}
            </p>
          )}
        </div>
      </div>

      <div className="mb-4 flex items-center gap-2 rounded-lg border border-muted bg-gray-50 px-3 py-2 text-xs text-gray-600 dark:bg-gray-100/50 dark:text-gray-400">
        <PiLockKey className="h-4 w-4 shrink-0" />
        {t('chatPage.sharedViewer.readOnlyBanner')}
      </div>

      <div className="custom-scrollbar min-h-0 flex-1 space-y-4 overflow-y-auto pb-8">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={cn(
              'rounded-xl px-4 py-3 text-sm',
              msg.role === 'user'
                ? 'ms-8 bg-primary/10 text-gray-900 dark:text-gray-100'
                : 'me-8 border border-muted bg-gray-0 dark:bg-gray-50'
            )}
          >
            {msg.role === 'assistant' ? (
              <MarkdownRenderer content={msg.content} />
            ) : (
              <p className="whitespace-pre-wrap" dir="auto">
                {msg.content}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
