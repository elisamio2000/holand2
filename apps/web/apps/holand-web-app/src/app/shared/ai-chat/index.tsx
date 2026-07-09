// ============================================
// AiChat — Main AI Chat layout component
// Composes sidebar, chat area, and canvas panel
// ============================================

'use client';

import { Tooltip } from '@/components/tooltip';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useTranslation } from 'react-i18next';
import {
  PiList,
  PiPlus,
  PiSparkle,
  PiLightning,
  PiCode,
  PiMagnifyingGlass,
  PiChartBar,
  PiCaretUp,
  PiFileText,
  PiTranslate,
  PiBrain,
  PiFolder,
  PiArrowDown,
  PiArrowUp,
  PiShareNetwork,
  PiCaretLeft,
} from 'react-icons/pi';
import cn from '@core/utils/class-names';

import { useModal } from '@/app/shared/modal-views/use-modal';
import { useMedia } from '@core/hooks/use-media';
import { useChat } from '@/hooks/use-chat';
import { useChatApiHealth } from '@/hooks/use-chat-api-health';
import { useChatFeatureHealth } from '@/app/shared/ai-chat/hooks/use-chat-feature-health';
import { useSharedWithMeSessions } from '@/hooks/use-shared-with-me-sessions';
import { getModelDisplayLabel } from '@/utils/chat-models-resolve';
import { routes } from '@/config/routes';
import { CHAT_EXPAND_MODAL_CUSTOM_SIZE } from '@/app/shared/ai-chat/chat-expand-modal-size';
import type { CanvasContent } from '@/types/chat.types';
import ChatSidebar from './chat-sidebar';
import ChatInput, { type ChatInputHandle } from './chat-input';
import MessageBubble from './message-bubble';
import CanvasPanel from './canvas-panel';
import CanvasContentModalView from './canvas-content-modal-view';
import MemoryPanel from './memory-panel';
import ArtifactsPanel from './artifacts-panel';
import ShareSessionModal from './share-session-modal';
import ExportMenu from './export/export-menu';
import ArcNavigator from './arc-navigator/arc-navigator';
import ChatDevRequirementsPanel, {
  type ChatDevRequirementsPanelHandle,
} from './components/chat-dev-requirements-panel';
import WorkspaceScopeBanner from '@/app/shared/workspace/components/workspace-scope-banner';
import { ColorEyedropperProvider } from '@/app/shared/color-picker';
import ChatContentWidthControl from './components/chat-content-width-control';
import ChatModelPicker from './components/chat-model-picker';
import SelectionQuoteToolbar from './components/selection-quote-toolbar';
import BulkBackupModal from './export/bulk-backup-modal';
import ChatSearchExpandedModal from './components/chat-search-expanded-modal';
import { useChatSearch, type ChatSearchTab } from './hooks/use-chat-search';
import { useChatKeyboardShortcuts } from './hooks/use-chat-keyboard-shortcuts';
import { useChatContentWidth } from './hooks/use-chat-content-width';
import {
  SearchHighlightProvider,
  useSearchHighlight,
  useInThreadFind,
  InThreadFindBar,
  useSearchFilters,
} from './search';
import { useSessionFolders } from './organization/hooks/use-session-folders';
import { useChatProjects } from './organization/hooks/use-chat-projects';
import SessionProjectsSection from './organization/components/session-projects-section';
import MobileChatToolbar from './mobile/components/mobile-chat-toolbar';
import type { ChatSession } from '@/types/chat.types';
import { ContentLoadingState } from '@/app/shared/loading';
import { arcMessageAnchorId } from './arc-navigator/arc-navigator-utils';
import { useFilePreview } from '@/app/shared/file-preview';
import { chatService } from '@/services/chat.service';
import type { ArtifactInput } from '@/types/chat.types';

/**
 * AiChat — Main AI chat page component.
 *
 * Layout: Sidebar (left) + Chat Area (center) + Canvas Panel (right, conditional)
 *
 * Features:
 * - Full conversation management via sidebar
 * - Streaming messages with thinking display
 * - Auto-scroll to latest message
 * - Empty state with quick actions
 * - Canvas panel for code/table viewing
 * - Responsive design with collapsible sidebar
 *
 * @requires useChat — main chat hook for state & actions
 * @requires ChatSidebar — session management
 * @requires ChatInput — message composition
 * @requires MessageBubble — message rendering
 * @requires CanvasPanel — content viewer
 *
 * @param initialSessionId - Optional session ID from URL for deep-linking
 *
 * @example
 * ```tsx
 * <AiChat />
 * <AiChat initialSessionId="550e8400-e29b-41d4-a716-446655440000" />
 * ```
 */
/**
 * Quick action cards for empty state.
 * Icons and prompts are static; title/description are translated inside the component.
 */
const QUICK_ACTION_DATA = [
  { key: 'writeCode', icon: <PiCode className="h-5 w-5" /> },
  { key: 'brainstorm', icon: <PiLightning className="h-5 w-5" /> },
  { key: 'analyze', icon: <PiMagnifyingGlass className="h-5 w-5" /> },
  { key: 'createTable', icon: <PiChartBar className="h-5 w-5" /> },
  { key: 'summarize', icon: <PiFileText className="h-5 w-5" /> },
  { key: 'translate', icon: <PiTranslate className="h-5 w-5" /> },
] as const;

/**
 * Get a time-aware greeting key for i18n.
 */
function getGreetingKey(): 'chatPage.greeting.morning' | 'chatPage.greeting.afternoon' | 'chatPage.greeting.evening' {
  const hour = new Date().getHours();
  if (hour < 12) return 'chatPage.greeting.morning';
  if (hour < 17) return 'chatPage.greeting.afternoon';
  return 'chatPage.greeting.evening';
}

interface AiChatProps {
  /** Session ID from URL for deep-linking and page refresh persistence */
  initialSessionId?: string;
}

export default function AiChat({ initialSessionId }: AiChatProps) {
  return (
    <ColorEyedropperProvider>
      <SearchHighlightProvider>
        <AiChatInner initialSessionId={initialSessionId} />
      </SearchHighlightProvider>
    </ColorEyedropperProvider>
  );
}

function AiChatInner({ initialSessionId }: AiChatProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: authSession } = useSession();
  const { t } = useTranslation();
  const userId = authSession?.user?.id ?? '';
  const isLgUp = useMedia('(min-width: 1024px)', false);
  const { openModal } = useModal();

  const {
    // State
    activeSessionId,
    sessions,
    pinnedSessions,
    regularSessions,
    archivedSessions,
    messages,
    isStreaming,
    isLoadingSessions,
    isLoadingMessages,
    isSidebarOpen,
    canvasContent,
    selectedModel,
    searchQuery,
    showArchived,

    // Session actions
    loadSessions,
    setSessionListFilters,
    createNewSession,
    selectSession,
    renameSession,
    deleteSession,
    deleteSessionsBulk,
    toggleArchiveSession,
    archiveSessionsBulk,
    togglePinSession,

    // Message actions
    sendMessage,
    stopStreaming,
    cancelUpload,
    resendLastMessage,
    editMessage,
    forkSessionFromMessage,
    setMessageFeedback,
    toggleThinking,
    isTraceEnriching,
    clearSessionMessages,

    // Canvas actions
    openCanvas,
    closeCanvas,

    // Upload state
    uploadProgress,
    isUploading,

    // UI actions
    setIsSidebarOpen,
    setSearchQuery,
    setShowArchived,
    availableModels,
    setSelectedModel,
  } = useChat();

  const { health, probe } = useChatApiHealth();
  const { features: featureHealth, probe: probeFeatures, isProbing: isFeatureProbing } =
    useChatFeatureHealth();
  const { setHighlight, flashMessageId, activeHighlight } = useSearchHighlight();
  const {
    sessions: sharedWithMeSessions,
    isLoading: isLoadingSharedWithMe,
    refresh: refreshSharedWithMe,
  } = useSharedWithMeSessions(Boolean(userId));
  const sharedReadOnlySessionIds = useMemo(
    () => new Set(sharedWithMeSessions.map((s) => s.session_id)),
    [sharedWithMeSessions]
  );
  const devPanelRef = useRef<ChatDevRequirementsPanelHandle>(null);
  const chatInputRef = useRef<ChatInputHandle>(null);
  const { preset: contentWidthPreset, setPreset: setContentWidthPreset, maxWidth: contentMaxWidth } =
    useChatContentWidth();
  const isActiveSessionReadOnly = Boolean(
    activeSessionId && sharedReadOnlySessionIds.has(activeSessionId)
  );
  const [isBulkBackupOpen, setIsBulkBackupOpen] = useState(false);
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [searchActiveTab, setSearchActiveTab] = useState<ChatSearchTab>('sessions');
  const [bulkBackupSessionIds, setBulkBackupSessionIds] = useState<string[] | undefined>(
    undefined
  );
  const sidebarSearchRef = useRef<HTMLInputElement>(null);
  const pendingScrollMessageIdRef = useRef<string | null>(null);
  const pendingFilePreviewRef = useRef<{
    artifactId?: string;
    fileName?: string;
    mimeType?: string;
    messageId?: string;
  } | null>(null);
  const { openFilePreview } = useFilePreview();

  const folderState = useSessionFolders(featureHealth);
  const projectState = useChatProjects(featureHealth);

  useEffect(() => {
    setSessionListFilters({ folder_id: folderState.activeFolderId });
    void loadSessions();
  }, [folderState.activeFolderId, setSessionListFilters, loadSessions]);

  const {
    filters: searchFilters,
    setFilters: setSearchFilters,
    reset: resetSearchFilters,
    backendScope,
  } = useSearchFilters();
  const inThreadFind = useInThreadFind(messages);

  const filterSessionsByOrg = useCallback(
    (list: ChatSession[]) =>
      list.filter((s) => {
        const folderId = folderState.getSessionFolderId(s.id, s.folder_id);
        const projectId = projectState.getSessionProjectId(s.id, s.project_id);
        if (folderState.activeFolderId && folderId !== folderState.activeFolderId) return false;
        if (projectState.activeProjectId && projectId !== projectState.activeProjectId) return false;
        return true;
      }),
    [folderState, projectState]
  );

  const filteredPinnedSessions = useMemo(
    () => filterSessionsByOrg(pinnedSessions),
    [filterSessionsByOrg, pinnedSessions]
  );
  const filteredRegularSessions = useMemo(
    () => filterSessionsByOrg(regularSessions),
    [filterSessionsByOrg, regularSessions]
  );
  const filteredArchivedSessions = useMemo(
    () => filterSessionsByOrg(archivedSessions),
    [filterSessionsByOrg, archivedSessions]
  );

  const {
    sessionResults,
    messageResults: rawMessageResults,
    fileResults: rawFileResults,
    isSearching,
  } = useChatSearch(sessions, messages, activeSessionId, searchQuery, {
    featureHealth,
    backendScope,
  });

  const messageResults = useMemo(() => {
    if (searchFilters.role === 'all' && !searchFilters.hasAttachment) return rawMessageResults;
    return rawMessageResults.filter((r) => {
      if (searchFilters.hasAttachment) return false;
      return true;
    });
  }, [rawMessageResults, searchFilters]);

  const fileResults = useMemo(() => {
    if (!searchFilters.hasAttachment && searchFilters.role === 'all') return rawFileResults;
    if (searchFilters.hasAttachment) return rawFileResults;
    return searchFilters.role === 'all' ? rawFileResults : [];
  }, [rawFileResults, searchFilters]);

  const clearSearch = useCallback(() => {
    setSearchQuery('');
    setIsSearchExpanded(false);
    sidebarSearchRef.current?.blur();
  }, [setSearchQuery]);

  const focusSidebarSearch = useCallback(() => {
    setIsSidebarOpen(true);
    requestAnimationFrame(() => {
      const input = sidebarSearchRef.current;
      input?.focus();
      input?.select();
    });
  }, [setIsSidebarOpen]);

  const handleOpenDevPanel = useCallback(() => {
    devPanelRef.current?.open();
  }, []);

  const handleReProbe = useCallback(() => {
    void probe();
    void probeFeatures();
  }, [probe, probeFeatures]);

  useEffect(() => {
    void probe();
    void probeFeatures();
  }, [probe, probeFeatures]);

  const handleOpenCanvas = useCallback(
    (content: CanvasContent) => {
      openCanvas(content);
      if (isLgUp) {
        openModal({
          view: (
            <CanvasContentModalView content={content} onAfterClose={closeCanvas} />
          ),
          customSize: CHAT_EXPAND_MODAL_CUSTOM_SIZE,
        });
      }
    },
    [openCanvas, closeCanvas, isLgUp, openModal]
  );

  // ==========================================
  // URL Synchronization — deep-linking & shareable URLs
  // Keeps activeSessionId in sync with the browser URL
  // ==========================================

  /** Prevents URL update from re-triggering selectSession */
  const isNavigatingRef = useRef(false);

  /**
   * On mount (or when initialSessionId changes due to Next.js navigation):
   * auto-select that session so the conversation loads immediately.
   * This enables deep-linking and page refresh persistence.
   *
   * NOTE: initialSessionId comes from server page props.
   * In Next.js App Router, when navigating between /ai-chat/[id] routes,
   * the page component re-renders with new params, so this effect re-fires.
   */
  useEffect(() => {
    if (!initialSessionId) {
      if (activeSessionId) {
        console.info('[AiChat] URL has no session, clearing active session');
      }
      return;
    }
    const hasOptimisticMessages = messages.some(
      (m) => m.id.startsWith('temp-') || m.isStreaming
    );
    if (
      initialSessionId === activeSessionId &&
      (isStreaming || hasOptimisticMessages)
    ) {
      console.info('[AiChat] Skipping URL selectSession — stream in progress');
      return;
    }
    console.info('[AiChat] Loading session from URL:', { initialSessionId });
    selectSession(initialSessionId).finally(() => {
      isNavigatingRef.current = false;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSessionId]);

  /**
   * Sync URL when activeSessionId changes programmatically
   * (e.g., auto-created session via sendMessage quick actions).
   * Uses router.replace to not add a history entry for auto-creations.
   * Skips update when the change was triggered by URL navigation.
   */
  useEffect(() => {
    if (isNavigatingRef.current) return;

    const targetPath = activeSessionId
      ? routes.aiChat.session(activeSessionId)
      : routes.aiChat.root;

    // Only update if the path actually changed — avoids unnecessary re-renders
    if (pathname !== targetPath) {
      console.info('[AiChat] Syncing URL to active session:', {
        activeSessionId,
        targetPath,
      });
      router.replace(targetPath);
    }
  }, [activeSessionId, pathname, router]);

  /**
   * Wrap selectSession to update URL when user clicks a session in the sidebar.
   * Calls router.push for a history entry (enables back/forward navigation),
   * then loads messages via selectSession. The URL sync effect is blocked
   * during navigation to prevent double-updates.
   */
  const handleSelectSession = useCallback(
    (sessionId: string) => {
      if (sessionId === activeSessionId) return;
      console.info('[AiChat] Sidebar session click:', { sessionId });
      isNavigatingRef.current = true;
      router.push(routes.aiChat.session(sessionId));
    },
    [router, activeSessionId]
  );

  /**
   * Wrap createNewSession to navigate to the new session's URL.
   */
  const handleCreateNewSession = useCallback(async () => {
    const session = await createNewSession();
    if (session) {
      router.push(routes.aiChat.session(session.id));
    }
  }, [createNewSession, router]);

  const scrollToMessage = useCallback((messageId: string, attempt = 0) => {
    const el = document.getElementById(arcMessageAnchorId(messageId));
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    if (attempt < 5) {
      window.setTimeout(() => scrollToMessage(messageId, attempt + 1), 100);
    }
  }, []);

  const findMessageIdForArtifact = useCallback(
    (artifactId: string, sourceMessages = messages): string | undefined => {
      for (const msg of sourceMessages) {
        const artifacts = (msg.artifacts ?? []) as ArtifactInput[];
        if (artifacts.some((a) => a.id === artifactId)) return msg.id;
      }
      return undefined;
    },
    [messages]
  );

  const openPendingFilePreview = useCallback(
    (file: NonNullable<typeof pendingFilePreviewRef.current>) => {
      if (!file.artifactId) return;
      void openFilePreview({
        src: chatService.getArtifactUrl(file.artifactId),
        name: file.fileName,
        mimeType: file.mimeType ?? null,
        artifactId: file.artifactId,
      });
    },
    [openFilePreview]
  );

  const handleSearchSelectSession = useCallback(
    async (sessionId: string) => {
      pendingFilePreviewRef.current = null;
      if (sessionId !== activeSessionId) {
        isNavigatingRef.current = true;
        router.push(routes.aiChat.session(sessionId));
        await selectSession(sessionId);
        isNavigatingRef.current = false;
      }
      clearSearch();
    },
    [activeSessionId, router, selectSession, clearSearch]
  );

  const handleSearchSelectMessage = useCallback(
    async (sessionId: string, messageId: string) => {
      pendingScrollMessageIdRef.current = messageId;
      pendingFilePreviewRef.current = null;
      setHighlight(messageId, searchQuery.trim());
      if (sessionId !== activeSessionId) {
        isNavigatingRef.current = true;
        router.push(routes.aiChat.session(sessionId));
        await selectSession(sessionId);
        isNavigatingRef.current = false;
      } else {
        scrollToMessage(messageId);
        pendingScrollMessageIdRef.current = null;
      }
      clearSearch();
    },
    [activeSessionId, router, scrollToMessage, selectSession, clearSearch, setHighlight, searchQuery]
  );

  const handleSearchSelectFile = useCallback(
    async (
      sessionId: string,
      artifactId: string | undefined,
      fileName: string | undefined,
      mimeType: string | undefined,
      messageId?: string
    ) => {
      const resolvedMessageId =
        messageId ?? (artifactId ? findMessageIdForArtifact(artifactId) : undefined);

      if (resolvedMessageId) {
        pendingScrollMessageIdRef.current = resolvedMessageId;
      }

      pendingFilePreviewRef.current = artifactId
        ? { artifactId, fileName, mimeType, messageId: resolvedMessageId }
        : null;

      if (sessionId !== activeSessionId) {
        isNavigatingRef.current = true;
        router.push(routes.aiChat.session(sessionId));
        await selectSession(sessionId);
        isNavigatingRef.current = false;
      } else {
        if (resolvedMessageId) {
          scrollToMessage(resolvedMessageId);
          pendingScrollMessageIdRef.current = null;
        }
        if (pendingFilePreviewRef.current) {
          openPendingFilePreview(pendingFilePreviewRef.current);
          pendingFilePreviewRef.current = null;
        }
      }
      clearSearch();
    },
    [
      activeSessionId,
      router,
      selectSession,
      findMessageIdForArtifact,
      scrollToMessage,
      openPendingFilePreview,
      clearSearch,
    ]
  );

  const openBulkBackup = useCallback((sessionIds?: string[]) => {
    setBulkBackupSessionIds(sessionIds);
    setIsBulkBackupOpen(true);
  }, []);

  useChatKeyboardShortcuts({
    onOpenSearch: focusSidebarSearch,
    onNewChat: () => void handleCreateNewSession(),
    onFocusSidebarSearch: focusSidebarSearch,
    onOpenInThreadFind: () => {
      if (activeSessionId && messages.length > 0) inThreadFind.open();
    },
    onEscape: () => {
      if (inThreadFind.isOpen) {
        inThreadFind.close();
        return;
      }
      if (isSearchExpanded) {
        setIsSearchExpanded(false);
        return;
      }
      clearSearch();
      setIsBulkBackupOpen(false);
      setIsShareModalOpen(false);
    },
  });

  useEffect(() => {
    if (!inThreadFind.isOpen || !inThreadFind.activeMatch) return;
    scrollToMessage(inThreadFind.activeMatch.messageId);
  }, [inThreadFind.isOpen, inThreadFind.activeMatch, scrollToMessage]);

  useEffect(() => {
    const messageId = pendingScrollMessageIdRef.current;
    if (!messageId || isLoadingMessages || messages.length === 0) return;
    pendingScrollMessageIdRef.current = null;
    scrollToMessage(messageId);

    const pendingFile = pendingFilePreviewRef.current;
    if (pendingFile) {
      openPendingFilePreview(pendingFile);
      pendingFilePreviewRef.current = null;
    }
  }, [messages, isLoadingMessages, scrollToMessage, openPendingFilePreview]);

  /**
   * Wrap deleteSession to navigate away if the deleted session was active.
   */
  const handleDeleteSession = useCallback(
    async (sessionId: string) => {
      await deleteSession(sessionId);
      // If we deleted the active session, navigate back to base chat URL
      if (activeSessionId === sessionId) {
        router.replace(routes.aiChat.root);
      }
    },
    [deleteSession, activeSessionId, router]
  );

  const handleBulkDeleteSessions = useCallback(
    async (sessionIds: string[]) => {
      const hit = Boolean(activeSessionId && sessionIds.includes(activeSessionId));
      await deleteSessionsBulk(sessionIds);
      if (hit) router.replace(routes.aiChat.root);
    },
    [activeSessionId, deleteSessionsBulk, router]
  );

  const handleBulkArchiveSessions = useCallback(
    async (sessionIds: string[], archive: boolean) => {
      await archiveSessionsBulk(sessionIds, archive);
    },
    [archiveSessionsBulk]
  );

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // ==========================================
  // Smart Scroll — auto-scroll + manual override + floating button
  // ==========================================

  /** Whether user is near the bottom of the scroll container (within 150px) */
  const [isNearBottom, setIsNearBottom] = useState(true);
  /** Whether auto-scroll is active (disabled when user scrolls up manually) */
  const [autoScrollEnabled, setAutoScrollEnabled] = useState(true);
  /** Whether user is near the top (for direction toggle on the scroll button) */
  const [isNearTop, setIsNearTop] = useState(true);
  /** Tracks if the user triggered a manual scroll (vs programmatic) */
  const isUserScrollRef = useRef(true);
  /** Previous scroll position for detecting manual scroll direction */
  const lastScrollTopRef = useRef(0);

  /**
   * Check if the scroll container is within `threshold` px of the bottom.
   * Used to decide whether auto-scroll should engage.
   */
  const checkNearBottom = useCallback((threshold = 150): boolean => {
    const container = scrollContainerRef.current;
    if (!container) return true;
    const { scrollTop, scrollHeight, clientHeight } = container;
    return scrollHeight - scrollTop - clientHeight < threshold;
  }, []);

  /**
   * Scroll to the absolute bottom of the messages container.
   * Used by auto-scroll and the manual scroll-to-bottom button.
   */
  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    isUserScrollRef.current = false;
    const container = scrollContainerRef.current;
    if (container) {
      container.scrollTo({
        top: container.scrollHeight,
        behavior,
      });
    }
    // Re-enable user scroll detection after programmatic scroll completes
    requestAnimationFrame(() => {
      isUserScrollRef.current = true;
    });
  }, []);

  /**
   * Scroll to the absolute top of the messages container.
   */
  const scrollToTop = useCallback((behavior: ScrollBehavior = 'smooth') => {
    isUserScrollRef.current = false;
    const container = scrollContainerRef.current;
    if (container) {
      container.scrollTo({ top: 0, behavior });
    }
    requestAnimationFrame(() => {
      isUserScrollRef.current = true;
    });
  }, []);

  // Handle scroll events — detect manual scroll and update state
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const nearBottom = scrollHeight - scrollTop - clientHeight < 150;
      const nearTop = scrollTop < 150;

      setIsNearBottom(nearBottom);
      setIsNearTop(nearTop);

      // If user manually scrolled UP (away from bottom), disable auto-scroll
      if (isUserScrollRef.current) {
        const scrolledUp = scrollTop < lastScrollTopRef.current;
        if (scrolledUp && !nearBottom) {
          setAutoScrollEnabled(false);
        }
        // If user scrolled back to bottom, re-enable auto-scroll
        if (nearBottom) {
          setAutoScrollEnabled(true);
        }
      }

      lastScrollTopRef.current = scrollTop;
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  // Auto-scroll to bottom on new messages / streaming updates
  // Only when auto-scroll is enabled (user hasn't scrolled up)
  useEffect(() => {
    if (!autoScrollEnabled) return;
    const timer = setTimeout(() => {
      scrollToBottom('smooth');
    }, 50);
    return () => clearTimeout(timer);
  }, [messages, isStreaming, autoScrollEnabled, scrollToBottom]);

  // When a new session is selected, scroll to TOP (not bottom).
  // Scrolling to bottom on session switch causes old messages to visually
  // "fall down" before clearing — scrolling to top shows skeleton at top.
  // Auto-scroll will take over once new messages load.
  useEffect(() => {
    setAutoScrollEnabled(true);
    scrollToTop('instant');
  }, [activeSessionId, scrollToTop]);

  const handleSuggestionClick = useCallback(
    (text: string) => {
      sendMessage(text);
    },
    [sendMessage]
  );

  // Quick actions for empty state — translated based on current language
  const quickActions = QUICK_ACTION_DATA.map((a) => ({
    icon: a.icon,
    prompt: t(`chatPage.quickActions.${a.key}.prompt`),
    title: t(`chatPage.quickActions.${a.key}.title`),
    description: t(`chatPage.quickActions.${a.key}.description`),
  }));

  const [isMemoryPanelOpen, setIsMemoryPanelOpen] = useState(false);
  const [isArtifactsPanelOpen, setIsArtifactsPanelOpen] = useState(false);
  /** Desktop (lg+): docked right rail with Files / Memory tabs (closed by default — open from toolbar, mirrors left sidebar). */
  const [rightRailOpen, setRightRailOpen] = useState(false);
  const [rightRailTab, setRightRailTab] = useState<'files' | 'memory'>('files');
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  const filesToolbarActive = isLgUp
    ? rightRailOpen && rightRailTab === 'files'
    : isArtifactsPanelOpen;
  const memoryToolbarActive = isLgUp
    ? rightRailOpen && rightRailTab === 'memory'
    : isMemoryPanelOpen;

  const toggleFilesPanel = useCallback(() => {
    if (isLgUp) {
      if (rightRailOpen && rightRailTab === 'files') {
        setRightRailOpen(false);
      } else {
        setRightRailOpen(true);
        setRightRailTab('files');
      }
      return;
    }
    setIsArtifactsPanelOpen((prev) => !prev);
  }, [isLgUp, rightRailOpen, rightRailTab]);

  const toggleMemoryPanel = useCallback(() => {
    if (isLgUp) {
      if (rightRailOpen && rightRailTab === 'memory') {
        setRightRailOpen(false);
      } else {
        setRightRailOpen(true);
        setRightRailTab('memory');
      }
      return;
    }
    setIsMemoryPanelOpen((prev) => !prev);
  }, [isLgUp, rightRailOpen, rightRailTab]);

  return (
    <div className="flex h-full min-h-0 flex-1 w-full items-stretch gap-0 overflow-hidden @container lg:gap-2.5">
      {/* Sidebar */}
      <ChatSidebar
        sessions={sessions}
        pinnedSessions={filteredPinnedSessions}
        regularSessions={filteredRegularSessions}
        archivedSessions={filteredArchivedSessions}
        activeSessionId={activeSessionId}
        isLoading={isLoadingSessions}
        searchQuery={searchQuery}
        showArchived={showArchived}
        isOpen={isSidebarOpen}
        onCreateNew={handleCreateNewSession}
        onSelect={handleSelectSession}
        onRename={renameSession}
        onDelete={handleDeleteSession}
        onToggleArchive={toggleArchiveSession}
        onTogglePin={togglePinSession}
        onSearchChange={setSearchQuery}
        onShowArchivedChange={setShowArchived}
        onClose={() => setIsSidebarOpen(false)}
        onClearMessages={clearSessionMessages}
        onShare={async (sessionId) => {
          if (sessionId !== activeSessionId) {
            await handleSelectSession(sessionId);
          }
          setIsShareModalOpen(true);
        }}
        onBulkDelete={handleBulkDeleteSessions}
        onBulkArchive={handleBulkArchiveSessions}
        sharedWithMeSessions={sharedWithMeSessions}
        isLoadingSharedWithMe={isLoadingSharedWithMe}
        sharedReadOnlySessionIds={sharedReadOnlySessionIds}
        isLoadingMessages={isLoadingMessages}
        onBackupAll={() => openBulkBackup()}
        onBulkBackup={(ids) => openBulkBackup(ids)}
        searchInputRef={sidebarSearchRef}
        sessionSearchResults={sessionResults}
        messageSearchResults={messageResults}
        fileSearchResults={fileResults}
        isSearchingMessages={isSearching}
        searchActiveTab={searchActiveTab}
        onSearchTabChange={setSearchActiveTab}
        onSearchSelectSession={handleSearchSelectSession}
        onSearchSelectMessage={handleSearchSelectMessage}
        onSearchSelectFile={handleSearchSelectFile}
        onSearchExpand={() => setIsSearchExpanded(true)}
        onOpenDevPanel={handleOpenDevPanel}
        folders={folderState.folders}
        activeFolderId={folderState.activeFolderId}
        onActiveFolderChange={folderState.setActiveFolderId}
        foldersAvailable={folderState.isAvailable}
        foldersLoading={folderState.isLoading}
        onCreateFolder={folderState.createFolder}
        onUpdateFolder={folderState.updateFolder}
        onDeleteFolder={folderState.deleteFolder}
        onMoveSessionToFolder={folderState.moveSessionToFolder}
        projectsSection={
          <SessionProjectsSection
            projects={projectState.projects}
            activeProjectId={projectState.activeProjectId}
            onActiveProjectChange={projectState.setActiveProjectId}
            isAvailable={projectState.isAvailable}
            isLoading={projectState.isLoading}
            onCreateProject={projectState.createProject}
            onUpdateProject={projectState.updateProject}
            onDeleteProject={projectState.deleteProject}
          />
        }
        onBackupFolder={
          folderState.activeFolderId
            ? () =>
                openBulkBackup(
                  sessions
                    .filter(
                      (s) =>
                        folderState.getSessionFolderId(s.id, s.folder_id) ===
                        folderState.activeFolderId
                    )
                    .map((s) => s.id)
                )
            : undefined
        }
        onBackupProject={
          projectState.activeProjectId
            ? () =>
                openBulkBackup(
                  sessions
                    .filter(
                      (s) =>
                        projectState.getSessionProjectId(s.id, s.project_id) ===
                        projectState.activeProjectId
                    )
                    .map((s) => s.id)
                )
            : undefined
        }
      />

      {/* Main chat area — desktop canvas opens via global modal (same pattern as file expand). */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden lg:rounded-lg lg:border lg:border-muted lg:shadow-sm">
        <WorkspaceScopeBanner className="mx-4 mt-2 shrink-0" />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {/* Top bar — toolbar strip below app header (border ties it to the template content box) */}
        <div className="flex flex-shrink-0 items-center justify-between border-b border-muted px-4 py-2">
          <div className="flex items-center gap-2">
            {!isSidebarOpen && (
              <>
                <button
                  onClick={() => setIsSidebarOpen(true)}
                  className="rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-200/20 dark:hover:text-gray-300"
                  aria-label={t('chatPage.showSidebar')}
                  title={t('chatPage.showSidebar')}
                >
                  <PiList className="h-5 w-5" />
                </button>
                <button
                  onClick={handleCreateNewSession}
                  className="rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-200/20 dark:hover:text-gray-300"
                  aria-label={t('chatPage.newChat')}
                  title={t('chatPage.newChat')}
                >
                  <PiPlus className="h-5 w-5" />
                </button>
                <div className="mx-2 h-5 w-px bg-muted" />
              </>
            )}
            <ChatModelPicker
              models={availableModels}
              selectedModel={selectedModel}
              onSelectModel={setSelectedModel}
            />
            <ChatContentWidthControl
              preset={contentWidthPreset}
              onChange={setContentWidthPreset}
            />
          </div>
          <div className="flex items-center gap-2">
            <MobileChatToolbar
              onExport={
                activeSessionId ? () => openBulkBackup([activeSessionId]) : undefined
              }
              onShare={activeSessionId ? () => setIsShareModalOpen(true) : undefined}
              onFiles={activeSessionId ? toggleFilesPanel : undefined}
              onMemory={activeSessionId ? toggleMemoryPanel : undefined}
              onWidth={() =>
                setContentWidthPreset(contentWidthPreset === 'wide' ? 'default' : 'wide')
              }
            />
            {activeSessionId && (
              <span className="hidden items-center gap-2 text-sm text-gray-500 lg:flex">
                {isLoadingMessages && (
                  <ContentLoadingState
                    variant="inline"
                    size="sm"
                    showLabel={false}
                    label={t('chatPage.loadingConversation')}
                  />
                )}
                <span className="truncate max-w-[12rem] sm:max-w-[16rem]">
                  {sessions.find((s) => s.id === activeSessionId)?.title || ''}
                </span>
              </span>
            )}
            {/* Export conversation — desktop toolbar */}
            {activeSessionId && (
              <ExportMenu
                className="hidden lg:inline-flex"
                sessionId={activeSessionId}
                sessionTitle={sessions.find((s) => s.id === activeSessionId)?.title}
                messages={messages}
              />
            )}
            {/* Share conversation link */}
            {activeSessionId && (
              <Tooltip content={t('chatPage.shareConversation')} placement="bottom">
                <button
                  onClick={() => setIsShareModalOpen(true)}
                  className="hidden rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-200/20 dark:hover:text-gray-300 lg:inline-flex"
                  aria-label={t('chatPage.shareConversation')}
                >
                  <PiShareNetwork className="h-5 w-5" />
                </button>
              </Tooltip>
            )}
            {/* Session files + memory: on desktop, only when right rail is closed (rail tabs replace these when open — same idea as left sidebar). */}
            {(!isLgUp || !rightRailOpen) && activeSessionId && (
              <Tooltip content={t('chatPage.sessionFiles')} placement="bottom">
                <button
                  onClick={toggleFilesPanel}
                  className={cn(
                    'hidden rounded-lg p-1.5 transition-colors lg:inline-flex',
                    filesToolbarActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-200/20 dark:hover:text-gray-300'
                  )}
                  aria-label={t('ariaLabels.toggleArtifactsPanel')}
                >
                  <PiFolder className="h-5 w-5" />
                </button>
              </Tooltip>
            )}
            {(!isLgUp || !rightRailOpen) && (
              <Tooltip content={t('chatPage.aiMemory')} placement="bottom">
                <button
                  onClick={toggleMemoryPanel}
                  className={cn(
                    'rounded-lg p-1.5 transition-colors',
                    memoryToolbarActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-200/20 dark:hover:text-gray-300'
                  )}
                  aria-label={t('ariaLabels.toggleMemoryPanel')}
                >
                  <PiBrain className="h-5 w-5" />
                </button>
              </Tooltip>
            )}
          </div>
        </div>

        {/* Messages area — stable height container, never resizes
            Loading state uses absolute overlay to prevent layout shifts */}
        <div className="relative min-h-0 flex-1 overflow-hidden overscroll-y-contain lg:pe-14">
          {/* Arc Navigator — message index (right edge); hidden when files rail is open */}
          <ArcNavigator
            messages={messages}
            scrollContainerRef={scrollContainerRef}
          />
          {/* Scroll container — always rendered to keep layout stable.
              Contains empty state and messages; never shows loading skeleton
              (that's an absolute overlay below to avoid reflow). */}
          <div
            className="custom-scrollbar scrollbar-no-auto-hide h-full min-h-0 overflow-y-auto"
            ref={scrollContainerRef}
            id="chat-messages-region"
          >
            {inThreadFind.isOpen && (
              <InThreadFindBar
                query={inThreadFind.query}
                onQueryChange={inThreadFind.setQuery}
                matchIndex={inThreadFind.activeMatchIndex}
                total={inThreadFind.total}
                onNext={() => inThreadFind.next()}
                onPrev={() => inThreadFind.prev()}
                onClose={inThreadFind.close}
              />
            )}
            {/* Empty state — no active session and no in-flight load */}
            {!activeSessionId && messages.length === 0 && !isLoadingMessages && (
              <div className="flex h-full flex-col items-center justify-center px-4">
                <div className="animate-chat-float mb-6 flex h-16 w-16 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-primary/10">
                  <PiSparkle className="h-8 w-8 text-primary" />
                </div>
                <h2 className="mb-1 text-xl font-semibold text-gray-900 dark:text-gray-700">
                  {t(getGreetingKey())} 👋
                </h2>
                <p className="mb-2 text-base text-gray-700">
                  {t('chatPage.emptyTitle')}
                </p>
                <p className="mb-8 max-w-md text-center text-sm text-gray-500">
                  {t('chatPage.emptySubtitle')}
                </p>

                {/* Quick action cards — 3-column grid */}
                <div className="grid w-full max-w-2xl grid-cols-2 gap-3 sm:grid-cols-3">
                  {quickActions.map((action, idx) => (
                    <button
                      key={idx}
                      onClick={() => sendMessage(action.prompt)}
                      className="animate-chat-scale-in flex flex-col items-start gap-2 rounded-xl border border-muted bg-gray-0 p-4 text-start transition-all hover:border-primary/30 hover:shadow-sm hover:-translate-y-0.5 active:scale-[0.98] dark:bg-gray-50 dark:hover:border-primary/30"
                      style={{ animationDelay: `${idx * 80 + 200}ms` }}
                    >
                      <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-500 dark:bg-gray-200/30">
                        {action.icon}
                      </span>
                      <div>
                        <span className="block text-sm font-medium text-gray-700">
                          {action.title}
                        </span>
                        <span className="block text-xs text-gray-400 dark:text-gray-500">
                          {action.description}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Messages list */}
            {messages.length > 0 && (
              <div
                className="mx-auto w-full space-y-6 px-4 pb-24 pt-6"
                style={{ maxWidth: contentMaxWidth }}
              >
                {messages.map((message, idx) => (
                  <div
                    key={message.id}
                    id={arcMessageAnchorId(message.id)}
                    className="animate-chat-message-in group/msg scroll-mt-6"
                    style={{ animationDelay: `${Math.min(idx * 50, 300)}ms` }}
                  >
                    <MessageBubble
                      message={message}
                      onFeedback={setMessageFeedback}
                      onToggleThinking={toggleThinking}
                      isLoadingTrace={isTraceEnriching(message.id)}
                      onOpenCanvas={handleOpenCanvas}
                      onEditMessage={editMessage}
                      onFork={
                        !isActiveSessionReadOnly ? forkSessionFromMessage : undefined
                      }
                      highlightQuery={
                        activeHighlight?.messageId === message.id
                          ? activeHighlight.query
                          : undefined
                      }
                      isFlashHighlight={flashMessageId === message.id}
                      onResend={
                        idx === messages.length - 1 &&
                        message.role === 'assistant' &&
                        !message.isStreaming
                          ? resendLastMessage
                          : undefined
                      }
                      onSuggestionClick={handleSuggestionClick}
                    />
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Loading overlay — ABSOLUTE so it covers the scroll container without
              touching document flow. The old content (or empty state) remains laid
              out underneath; only the visual is covered. This is why there is no
              height reflow / jump when switching sessions or loading on first visit. */}
          {isLoadingMessages && (
            <ContentLoadingState
              variant="overlay"
              label={t('chatPage.loadingConversation')}
              skeleton="chat-messages"
            />
          )}

          {/* Floating scroll button — shows when user is away from bottom/top */}
          {messages.length > 0 && (!isNearBottom || !isNearTop) && (
            <div className="absolute bottom-4 left-1/2 z-20 -translate-x-1/2">
              <Tooltip
                content={
                  isNearBottom
                    ? t('chatPage.scrollToTop')
                    : autoScrollEnabled
                      ? t('chatPage.scrollToBottom')
                      : t('chatPage.autoScrollPaused')
                }
                placement="top"
              >
                <button
                  onClick={() => {
                    if (isNearBottom) {
                      scrollToTop();
                    } else {
                      setAutoScrollEnabled(true);
                      scrollToBottom();
                    }
                  }}
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-full shadow-lg transition-all',
                    'border border-muted bg-gray-0 text-gray-600 hover:bg-gray-50 dark:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-200/30',
                    !autoScrollEnabled && !isNearBottom && 'ring-2 ring-primary/30'
                  )}
                  aria-label={isNearBottom ? t('chatPage.scrollToTop') : t('chatPage.scrollToBottom')}
                >
                  {isNearBottom ? (
                    <PiArrowUp className="h-4 w-4" />
                  ) : (
                    <PiArrowDown className="h-4 w-4" />
                  )}
                </button>
              </Tooltip>
            </div>
          )}
        </div>

        <SelectionQuoteToolbar
          containerId="chat-messages-region"
          onQuote={(text) => chatInputRef.current?.prependQuote(text)}
        />

        {isActiveSessionReadOnly && (
          <p className="border-t border-muted bg-amber-50/50 px-4 py-2 text-center text-xs text-amber-800 dark:bg-amber-950/20 dark:text-amber-300">
            {t('chatSidebar.sharedReadOnly')} — {t('chatPage.sharedViewer.readOnlyHint')}
          </p>
        )}

        {/* Input area */}
        <ChatInput
          ref={chatInputRef}
          onSend={sendMessage}
          isStreaming={isStreaming}
          isLoadingMessages={isLoadingMessages}
          isUploading={isUploading}
          uploadProgress={uploadProgress}
          onStop={stopStreaming}
          onCancelUpload={cancelUpload}
          toolsApiStatus={health.tools}
          onOpenDevPanel={handleOpenDevPanel}
          contentMaxWidth={contentMaxWidth}
          disabled={isActiveSessionReadOnly}
        />
        <ChatDevRequirementsPanel
          ref={devPanelRef}
          liveHealth={health}
          onReProbe={handleReProbe}
          isProbing={health.isProbing || isFeatureProbing}
        />

        <ChatSearchExpandedModal
          isOpen={isSearchExpanded}
          onClose={() => setIsSearchExpanded(false)}
          query={searchQuery}
          onQueryChange={setSearchQuery}
          activeTab={searchActiveTab}
          onTabChange={setSearchActiveTab}
          sessionResults={sessionResults}
          messageResults={messageResults}
          fileResults={fileResults}
          isSearching={isSearching}
          onSelectSession={handleSearchSelectSession}
          onSelectMessage={handleSearchSelectMessage}
          onSelectFile={handleSearchSelectFile}
          onClear={clearSearch}
          searchFilters={searchFilters}
          onSearchFiltersChange={(patch) => setSearchFilters((f) => ({ ...f, ...patch }))}
          onSearchFiltersReset={resetSearchFilters}
        />

        <BulkBackupModal
          isOpen={isBulkBackupOpen}
          onClose={() => {
            setIsBulkBackupOpen(false);
            setBulkBackupSessionIds(undefined);
          }}
          sessionIds={bulkBackupSessionIds}
          featureHealth={featureHealth}
          onImportComplete={() => void loadSessions()}
        />
        </div>
      </div>

      {/* Desktop: right rail — fixed width + bounded height + internal scroll (mirrors ChatSidebar shell). */}
      {isLgUp && rightRailOpen && (
        <div className="flex h-full min-h-0 w-[270px] shrink-0 flex-col overflow-hidden rounded-lg border border-muted bg-gray-0 shadow-sm dark:bg-gray-50 2xl:w-72">
          <div className="flex flex-shrink-0 items-stretch gap-0.5 border-b border-muted p-1">
            <button
              type="button"
              onClick={() => setRightRailTab('files')}
              className={cn(
                'flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-2 text-xs font-medium transition-colors',
                rightRailTab === 'files'
                  ? 'bg-primary/10 text-primary'
                  : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-200/20'
              )}
            >
              <PiFolder className="h-4 w-4 shrink-0" />
              <span className="truncate">{t('chatPage.sessionFiles')}</span>
            </button>
            <button
              type="button"
              onClick={() => setRightRailTab('memory')}
              className={cn(
                'flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-2 text-xs font-medium transition-colors',
                rightRailTab === 'memory'
                  ? 'bg-primary/10 text-primary'
                  : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-200/20'
              )}
            >
              <PiBrain className="h-4 w-4 shrink-0" />
              <span className="truncate">{t('chatPage.aiMemory')}</span>
            </button>
            <Tooltip content={t('chatPage.collapseRightRail')} placement="bottom">
              <button
                type="button"
                onClick={() => setRightRailOpen(false)}
                className="flex w-9 shrink-0 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800 dark:hover:bg-gray-200/20 dark:hover:text-gray-200"
                aria-label={t('chatPage.collapseRightRail')}
              >
                <PiCaretLeft className="h-4 w-4 rtl:rotate-180" />
              </button>
            </Tooltip>
          </div>
          <div className="min-h-0 flex-1 overflow-hidden">
            {rightRailTab === 'files' ? (
              <ArtifactsPanel
                layout="inline"
                isOpen
                onClose={() => setRightRailOpen(false)}
                activeSessionId={activeSessionId}
              />
            ) : (
              <MemoryPanel
                layout="inline"
                isOpen
                onClose={() => setRightRailOpen(false)}
                userId={userId}
                activeSessionId={activeSessionId}
                memoryApiStatus={health.memory}
                onOpenDevPanel={handleOpenDevPanel}
              />
            )}
          </div>
        </div>
      )}

      {/* Canvas — same dock shell as right rail; placed after rail so it anchors screen end (LTR). */}
      {canvasContent && !isLgUp && (
        <CanvasPanel content={canvasContent} onClose={closeCanvas} variant="sidebar" />
      )}

      {/* Mobile / tablet: slide-over panels */}
      {!isLgUp && (
        <>
          <MemoryPanel
            isOpen={isMemoryPanelOpen}
            onClose={() => setIsMemoryPanelOpen(false)}
            userId={userId}
            activeSessionId={activeSessionId}
            layout="overlay"
            memoryApiStatus={health.memory}
            onOpenDevPanel={handleOpenDevPanel}
          />
          <ArtifactsPanel
            isOpen={isArtifactsPanelOpen}
            onClose={() => setIsArtifactsPanelOpen(false)}
            activeSessionId={activeSessionId}
            layout="overlay"
          />
        </>
      )}

      {/* Share session modal — generates time-limited public link */}
      {isShareModalOpen && activeSessionId && (
        <ShareSessionModal
          sessionId={activeSessionId}
          sessionTitle={sessions.find((s) => s.id === activeSessionId)?.title}
          onClose={() => setIsShareModalOpen(false)}
          onSharedWithUsers={() => void refreshSharedWithMe()}
        />
      )}
    </div>
  );
}
