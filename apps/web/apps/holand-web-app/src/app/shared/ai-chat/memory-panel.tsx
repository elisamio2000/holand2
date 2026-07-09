// ============================================
// MemoryPanel — AI Memory management display
// Shows and manages user/session memories from Orchestrator
// ============================================

'use client';

import { Tooltip } from '@/components/tooltip';
import { useCallback, useEffect, useState } from 'react';
import {
  PiBrain,
  PiTrash,
  PiMagnifyingGlass,
  PiX,
  PiInfo,
  PiWarningCircle,
  PiClock,
  PiTag,
  PiCaretLeft,
} from 'react-icons/pi';
import { useTranslation } from 'react-i18next';
import cn from '@core/utils/class-names';
import { Loader } from 'rizzui';
import toast from 'react-hot-toast';
import { chatService } from '@/services/chat.service';
import type { MemoryEntry } from '@/types/chat.types';
import { isHttpStatusError } from '@/app/shared/ai-chat/utils/http-error';
import BackendUnavailableBanner from '@/app/shared/ai-chat/components/backend-unavailable-banner';
import type { ChatApiEndpointStatus } from '@/hooks/use-chat-api-health';

/** `overlay` = fixed slide-over (mobile). `inline` = docked inside AiChat right rail (desktop). */
export type MemoryPanelLayout = 'overlay' | 'inline';

interface MemoryPanelProps {
  /** Whether the panel is visible */
  isOpen: boolean;
  /** Close the panel */
  onClose: () => void;
  /** Current user ID for API calls */
  userId: string;
  /** Currently active session ID (optional) */
  activeSessionId?: string | null;
  /** Presentation: slide-over vs docked column */
  layout?: MemoryPanelLayout;
  /** Probed memory API availability */
  memoryApiStatus?: ChatApiEndpointStatus;
  /** Opens dev requirements panel (dev only) */
  onOpenDevPanel?: () => void;
}

/**
 * MemoryPanel — Manages AI memory entries for the current user.
 *
 * Features:
 * - View session-specific memories
 * - View all user-wide memories
 * - Search across memories
 * - Clear session memories
 * - Clear all user memories
 *
 * Connects to Orchestrator endpoints:
 * - GET /memory/session/{id} — session memories
 * - GET /memory/user/{id} — user memories
 * - POST /memory/search — search
 * - DELETE /memory/session/{id} — clear session
 * - DELETE /memory/user/{id} — clear all
 *
 * @requires chatService — for memory API calls
 *
 * @example
 * ```tsx
 * <MemoryPanel
 *   isOpen={showMemory}
 *   onClose={() => setShowMemory(false)}
 *   userId={currentUserId}
 *   activeSessionId={activeSessionId}
 * />
 * ```
 */
export default function MemoryPanel({
  isOpen,
  onClose,
  userId,
  activeSessionId,
  layout = 'overlay',
  memoryApiStatus = 'unknown',
  onOpenDevPanel,
}: MemoryPanelProps) {
  const [memories, setMemories] = useState<MemoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'session' | 'all'>('session');
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const { t } = useTranslation();

  const apiUnavailable = memoryApiStatus === 'unavailable';

  /**
   * Load memories based on active tab.
   */
  const loadMemories = useCallback(async () => {
    if (!userId || apiUnavailable) {
      setMemories([]);
      setError(null);
      return;
    }

    console.info('[MemoryPanel] Loading memories:', { tab: activeTab, userId, activeSessionId });
    setIsLoading(true);
    setError(null);

    try {
      let data: MemoryEntry[];
      if (activeTab === 'session' && activeSessionId) {
        data = await chatService.getSessionMemories(activeSessionId, userId);
      } else {
        data = await chatService.getUserMemories(userId);
      }
      setMemories(data);
      console.info('[MemoryPanel] Memories loaded:', { count: data.length });
    } catch (err: unknown) {
      console.error('[MemoryPanel] Failed to load memories:', err);
      setError(
        isHttpStatusError(err, 404)
          ? t('chatPage.memory.backendUnavailable')
          : t('memoryPanel.errorLoad')
      );
    } finally {
      setIsLoading(false);
    }
  }, [userId, activeTab, activeSessionId, t, apiUnavailable]);

  /**
   * Search memories with query text.
   */
  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim() || !userId || apiUnavailable) return;

    console.info('[MemoryPanel] Searching memories:', { query: searchQuery });
    setIsLoading(true);
    setError(null);

    try {
      const data = await chatService.searchMemories(
        searchQuery,
        userId,
        activeTab === 'session' ? activeSessionId ?? undefined : undefined,
        activeTab === 'session' ? 'session' : 'user'
      );
      setMemories(data);
      console.info('[MemoryPanel] Search results:', { count: data.length });
    } catch (err: unknown) {
      console.error('[MemoryPanel] Memory search failed:', err);
      setError(t('memoryPanel.errorSearch'));
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, userId, activeTab, activeSessionId, t, apiUnavailable]);

  /**
   * Clear memories (session or all).
   */
  const handleClearMemories = useCallback(async () => {
    if (!userId || apiUnavailable) return;

    console.info('[MemoryPanel] Clearing memories:', { tab: activeTab, activeSessionId });
    try {
      if (activeTab === 'session' && activeSessionId) {
        await chatService.clearSessionMemories(activeSessionId, userId);
        toast.success(t('memoryPanel.clearedSession'));
      } else {
        await chatService.clearUserMemories(userId);
        toast.success(t('memoryPanel.clearedAll'));
      }
      setMemories([]);
      setShowClearConfirm(false);
    } catch (err: unknown) {
      console.error('[MemoryPanel] Failed to clear memories:', err);
      toast.error(t('memoryPanel.errorClear'));
    }
  }, [userId, activeTab, activeSessionId, t, apiUnavailable]);

  // Load memories when panel opens or tab changes
  useEffect(() => {
    if (isOpen) {
      if (apiUnavailable) {
        setMemories([]);
        setError(null);
        return;
      }
      if (searchQuery.trim()) {
        handleSearch();
      } else {
        loadMemories();
      }
    }
  }, [isOpen, loadMemories, apiUnavailable]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!isOpen) return null;

  return (
    <div
      className={cn(
        'relative z-[999] flex min-h-0 flex-col overflow-hidden bg-gray-0 dark:bg-gray-50',
        layout === 'overlay' &&
          'fixed end-0 bottom-0 top-[70px] w-80 border-s border-muted shadow-xl sm:w-96 lg:top-[72px]',
        layout === 'inline' && 'h-full w-full'
      )}
    >
      {/* Title row — overlay only; docked rail uses AiChat tab row (same pattern as ChatSidebar). */}
      {layout === 'overlay' && (
        <div className="flex flex-shrink-0 items-center justify-between border-b border-muted px-4 py-3">
          <div className="flex items-center gap-2">
            <PiBrain className="h-5 w-5 text-primary" />
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-700">
              {t('memoryPanel.title')}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-200/20"
            aria-label={t('memoryPanel.close')}
          >
            <PiCaretLeft className="h-4 w-4 rotate-180" />
          </button>
        </div>
      )}

      {/* Tabs — Session vs All */}
      <div className="flex flex-shrink-0 border-b border-muted">
        <button
          onClick={() => {
            setActiveTab('session');
            setSearchQuery('');
          }}
          className={cn(
            'flex-1 px-4 py-2 text-sm font-medium transition-colors',
            activeTab === 'session'
              ? 'border-b-2 border-primary text-primary'
              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
          )}
          disabled={!activeSessionId || apiUnavailable}
        >
          {t('memoryPanel.tabSession')}
        </button>
        <button
          onClick={() => {
            setActiveTab('all');
            setSearchQuery('');
          }}
          className={cn(
            'flex-1 px-4 py-2 text-sm font-medium transition-colors',
            activeTab === 'all'
              ? 'border-b-2 border-primary text-primary'
              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
          )}
          disabled={apiUnavailable}
        >
          {t('memoryPanel.tabAll')}
        </button>
      </div>

      {/* Search */}
      <div className="flex-shrink-0 border-b border-muted px-4 py-2">
        <div className="relative">
          <PiMagnifyingGlass className="absolute start-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSearch();
            }}
            placeholder={t('memoryPanel.searchPlaceholder')}
            disabled={apiUnavailable}
            className="w-full rounded-md border border-muted bg-gray-0 py-1.5 ps-8 pe-8 text-sm text-gray-700 outline-none placeholder:text-gray-400 focus:border-primary/40 disabled:opacity-50 dark:bg-gray-50 dark:text-gray-300"
            dir="auto"
          />
          {searchQuery && !apiUnavailable && (
            <button
              onClick={() => {
                setSearchQuery('');
                loadMemories();
              }}
              className="absolute end-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <PiX className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="custom-scrollbar scrollbar-no-auto-hide min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
        {apiUnavailable && (
          <div className="p-4">
            <BackendUnavailableBanner
              message={t('chatPage.memory.backendUnavailable')}
              onOpenDevPanel={onOpenDevPanel}
            />
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader variant="spinner" size="md" />
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mx-4 mt-4 flex items-center gap-2 rounded-lg border border-orange-300 bg-orange-50 px-3 py-2 text-xs text-orange-600 dark:border-orange-800 dark:bg-orange-950/30 dark:text-orange-400">
            <PiWarningCircle className="h-4 w-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Empty state */}
        {!isLoading && !error && memories.length === 0 && (
          <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
            <PiBrain className="mb-2 h-10 w-10 text-gray-200 dark:text-gray-600" />
            <p className="text-xs text-gray-400 dark:text-gray-500">
              {apiUnavailable
                ? t('chatPage.memory.backendUnavailable')
                : activeTab === 'session' && !activeSessionId
                  ? t('memoryPanel.emptySelectSession')
                  : searchQuery
                    ? t('memoryPanel.emptySearch')
                    : t('memoryPanel.emptyNone')}
            </p>
            {!apiUnavailable && (
              <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                {t('memoryPanel.emptyHint')}
              </p>
            )}
          </div>
        )}

        {/* Memory entries list */}
        {!isLoading && memories.length > 0 && (
          <div className="space-y-2 p-4">
            {memories.map((memory, idx) => (
              <div
                key={memory.id ?? idx}
                className="rounded-lg border border-muted p-3 transition-colors hover:bg-gray-50 dark:hover:bg-gray-200/10"
              >
                <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-300" dir="auto">
                  {memory.content}
                </p>
                <div className="mt-2 flex items-center gap-3 text-xs text-gray-400 dark:text-gray-500">
                  {memory.category && (
                    <span className="flex items-center gap-0.5">
                      <PiTag className="h-2.5 w-2.5" />
                      {memory.category}
                    </span>
                  )}
                  {memory.is_long_term && (
                    <Tooltip content={t('memoryPanel.longTermTooltip')} placement="top">
                      <span className="flex items-center gap-0.5 text-primary">
                        <PiInfo className="h-2.5 w-2.5" />
                        {t('memoryPanel.longTerm')}
                      </span>
                    </Tooltip>
                  )}
                  {memory.created_at && (
                    <span className="flex items-center gap-0.5">
                      <PiClock className="h-2.5 w-2.5" />
                      {new Date(memory.created_at).toLocaleDateString()}
                    </span>
                  )}
                  {memory.score != null && (
                    <span title={t('memoryPanel.relevanceScore')}>
                      {(memory.score * 100).toFixed(0)}{t('memoryPanel.relevanceSuffix')}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer — clear action */}
      <div className="flex-shrink-0 border-t border-muted bg-gray-0 px-4 py-3 dark:bg-gray-50">
        {showClearConfirm ? (
          <div className="flex items-center justify-between">
            <span className="text-xs text-red-500">
              {activeTab === 'session' ? t('memoryPanel.clearSessionConfirm') : t('memoryPanel.clearAllConfirm')}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="rounded px-2 py-1 text-xs font-medium text-gray-500 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-200/20"
              >
                {t('memoryPanel.cancel')}
              </button>
              <button
                onClick={handleClearMemories}
                className="rounded bg-red-500 px-2 py-1 text-xs font-medium text-white transition-colors hover:bg-red-600"
              >
                {t('memoryPanel.confirm')}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">
              {memories.length} {memories.length === 1 ? t('memoryPanel.memorySingular') : t('memoryPanel.memoryPlural')}
            </span>
            <button
              onClick={() => setShowClearConfirm(true)}
              disabled={memories.length === 0 || apiUnavailable}
              className={cn(
                'flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition-colors',
                memories.length > 0 && !apiUnavailable
                  ? 'text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20'
                  : 'cursor-not-allowed text-gray-300'
              )}
            >
              <PiTrash className="h-3 w-3" />
              {activeTab === 'session' ? t('memoryPanel.clearSession') : t('memoryPanel.clearAll')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
