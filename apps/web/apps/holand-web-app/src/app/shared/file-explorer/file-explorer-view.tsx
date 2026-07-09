// ============================================
// FileExplorerView — Main 3-panel file explorer layout
// Left: Folder Tree | Center: File Table | Right: Detail Panel
// Panels are resizable and collapsible.
// Layout pattern matches graph-data-processor (edit-entities).
// ============================================

'use client';

import { Tooltip } from '@/components/tooltip';
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { isAxiosError } from 'axios';
import FloatingNativeAiChat from '@/app/shared/native-ai-chat/floating-native-ai-chat';
import { Text, Title, Button, ActionIcon, Badge } from 'rizzui';
import { useTranslation } from 'react-i18next';
import {
  PiCloudSlashBold,
  PiArrowsCounterClockwiseBold,
  PiUploadSimpleBold,
  PiSidebarBold,
  PiSidebarSimpleBold,
  PiListBold,
  PiSquaresFourBold,
  PiUserBold,
  PiUsersBold,
  PiGlobeBold,
  PiLinkBold,
} from 'react-icons/pi';
import cn from '@core/utils/class-names';

import FolderTree from './left-panel/folder-tree';
import FileTable from './center-panel/file-table';
import FileDetailPanel from './right-panel/file-detail-panel';
import UploadModal from './upload-modal';
import { useConfirmDialog } from './confirm-dialog';
import { useFilePreview } from '@/hooks/use-file-preview';
import {
  clearStoragePreviewFailureCache,
  storageService,
} from '@/services/storage.service';
import { thumbnailQueue } from '@/utils/request-queue';
import type {
  Artifact,
  FileManagerFacetsResult,
  FileManagerFolderBucket,
  FileManagerListArgs,
  FileManagerOwnership,
  FileManagerTotals,
} from '@/types/storage.types';
import type { FileExplorerListFilter } from '@/utils/file-explorer-filters';
import { routes } from '@/config/routes';
import { enqueueAttachItems } from '@/app/shared/user-boards/lib/board-attach-bridge';
import {
  advancedFiltersToListArgs,
  type AdvancedFilterValues,
} from './center-panel/file-explorer-advanced-filters';
import { useOnWorkspaceChanged } from '@/hooks/use-workspace-scope';
import WorkspaceScopeBanner from '@/app/shared/workspace/components/workspace-scope-banner';

// ==========================================
// Constants
// ==========================================

/** Default page size for the file table. */
const DEFAULT_PAGE_SIZE = 50;
/** Available page-size options in the footer dropdown. */
const PAGE_SIZE_OPTIONS = [25, 50, 100, 200] as const;

function formatBytesHuman(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`;
  return `${(bytes / 1073741824).toFixed(2)} GB`;
}

// ==========================================
// FileExplorerView
// ==========================================

/**
 * FileExplorerView — Main 3-panel file explorer.
 *
 * Layout matches graph-data-processor:
 * 1. Header row (title + stats + actions) — mb-6
 * 2. Workspace layout bar (panel toggles) — mb-3
 * 3. Bordered panel container (rounded-lg border border-muted)
 *    ┌──────────┬──────────────────────────────┬──────────────┐
 *    │  Folder  │        File Table            │   Detail     │
 *    │  Tree    │  (chips + breadcrumb + rows) │   Panel      │
 *    └──────────┴──────────────────────────────┴──────────────┘
 *
 * @example
 * ```tsx
 * <FileExplorerView />
 * ```
 */
export default function FileExplorerView() {
  const { t } = useTranslation();
  const tx = useCallback(
    (key: string, options?: Record<string, unknown>) =>
      t(`fileExplorer.${key}`, options),
    [t]
  );
  // ── Data state ────────────────────────────────────────────────────────────
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<
    null | 'rate_limit' | 'auth' | 'server' | 'network'
  >(null);
  const [totalCount, setTotalCount] = useState(0);
  /** Server-side per-type totals from plugin.file_manager.facets (preferred). */
  const [totalsByType, setTotalsByType] = useState<
    Record<string, FileManagerTotals> | undefined
  >(undefined);
  /** Server-side facet result (mime/session/tags/uploaders). */
  const [facets, setFacets] = useState<FileManagerFacetsResult | null>(null);
  /** Server-side folder list from plugin.file_manager.folders. */
  const [serverFolders, setServerFolders] = useState<
    FileManagerFolderBucket[] | null
  >(null);

  // ── Server-side query state (v0.39.2) ─────────────────────────────────────
  /** Current page (1-based). */
  const [page, setPage] = useState(1);
  /** Debounced page for list API — avoids burst when user clicks Next rapidly */
  const [fetchPage, setFetchPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE);
  const [sortBy, setSortBy] = useState<
    'created_at' | 'name' | 'size' | 'mime_type' | 'media_type'
  >('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  /** Free-text search sent to backend (debounced upstream of fetch). */
  const [search, setSearch] = useState('');
  /** Active list filter from type chips (media_type and/or mime_types). */
  const [listFilter, setListFilter] = useState<FileExplorerListFilter>({});
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedFilterValues>({});
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  /** Storage usage bar — facets.total preferred, quota API fallback. */
  const [storageUsage, setStorageUsage] = useState<{
    usedHuman: string;
    quotaHuman: string;
    percent: number;
  } | null>(null);
  /** Owner / shared / any filter (default any = own + group + override). */
  const [ownership, setOwnership] = useState<FileManagerOwnership>('any');

  // ── Navigation / selection state ──────────────────────────────────────────
  const [currentPath, setCurrentPath] = useState('');
  const [selectedArtifact, setSelectedArtifact] = useState<Artifact | null>(null);
  const [attachBulkIds, setAttachBulkIds] = useState<string[]>([]);

  // ── Upload modal ──────────────────────────────────────────────────────────
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [droppedFiles, setDroppedFiles] = useState<File[] | undefined>(undefined);

  // ── Panel visibility ──────────────────────────────────────────────────────
  const [showNavPanel, setShowNavPanel] = useState(true);
  const [showDetailPanel, setShowDetailPanel] = useState(false);

  // ── Debug counters (A7) — only active when DEBUG_STORAGE is true ─────────
  const debugCounters = useRef({ list: 0, facets: 0, folders: 0, windowStart: Date.now() });
  const DEBUG_STORAGE = typeof window !== 'undefined' && (window as any).DEBUG_STORAGE === true;

  // ── View mode (v0.45.0) — list ↔ grid, persisted in URL `?view=` ─────────
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const urlView = (searchParams?.get('view') ?? '').toLowerCase();
  const urlSearchParam = searchParams?.get('search') ?? '';
  const urlArtifactParam = searchParams?.get('artifact') ?? '';
  const urlPreviewParam = searchParams?.get('preview') === '1';
  const attachToBoardId = searchParams?.get('attachToBoard') ?? '';
  const pendingUrlArtifactRef = useRef<string | null>(null);
  const view: 'list' | 'grid' = urlView === 'grid' ? 'grid' : 'list';
  const setView = useCallback(
    (next: 'list' | 'grid') => {
      const params = new URLSearchParams(searchParams?.toString() ?? '');
      if (next === 'list') params.delete('view');
      else params.set('view', next);
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
      console.info('[FileExplorerView] View changed:', { view: next });
    },
    [pathname, router, searchParams]
  );

  // ── Hooks: preview modal + confirmation dialogs (v0.44.0) ────────────────
  const { openFilePreview } = useFilePreview();
  const confirm = useConfirmDialog();

  /**
   * Open authenticated preview modal for an artifact (Eye / double-click / detail panel).
   */
  const handlePreviewArtifact = useCallback(
    (artifact: Artifact) => {
      openFilePreview({
        src: storageService.getDownloadUrl(artifact.id, 'inline'),
        name: artifact.filename,
        mimeType: artifact.mime_type,
        fileSize: artifact.file_size,
        artifactId: artifact.id,
      });
    },
    [openFilePreview]
  );

  /**
   * Promise-based confirmation guard for bulk delete.
   * Resolves to true → proceed, false → cancel.
   */
  const handleConfirmBulkDelete = useCallback(
    (count: number) =>
      confirm({
        title: tx('bulkDeleteTitle'),
        message: tx('bulkDeleteMessage', { count }),
        confirmLabel: tx('deleteNow'),
        cancelLabel: tx('cancel'),
        destructive: true,
      }),
    [confirm, tx]
  );

  // ── Responsive layout detection (matches edit-entities xl breakpoint) ─────
  const [isWideLayout, setIsWideLayout] = useState(true);

  useEffect(() => {
    const checkWideLayout = () => setIsWideLayout(window.innerWidth >= 1280);
    checkWideLayout();
    window.addEventListener('resize', checkWideLayout);
    return () => window.removeEventListener('resize', checkWideLayout);
  }, []);

  // ── Panel resize (percentage-based like edit-entities) ────────────────────
  // navWidthPercent: left panel width as % of container
  const [navWidthPercent, setNavWidthPercent] = useState(18);
  const [detailWidthPercent, setDetailWidthPercent] = useState(26);
  const [isResizingNav, setIsResizingNav] = useState(false);
  const [isResizingDetail, setIsResizingDetail] = useState(false);
  const splitContainerRef = useRef<HTMLDivElement>(null);

  /**
   * Start resize for nav (left) panel.
   * Uses same pattern as graph-data-processor startPreviewResize.
   */
  const startNavResize = useCallback(
    (event: React.MouseEvent) => {
      if (!isWideLayout || !showNavPanel) return;
      event.preventDefault();
      const container = splitContainerRef.current;
      if (!container) return;

      setIsResizingNav(true);
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'col-resize';

      const onMouseMove = (moveEvent: MouseEvent) => {
        const rect = container.getBoundingClientRect();
        if (!rect.width) return;
        const pointerX = Math.min(Math.max(moveEvent.clientX - rect.left, 0), rect.width);
        const nextPercent = (pointerX / rect.width) * 100;
        // Clamp between 12% and 30%
        setNavWidthPercent(Math.min(30, Math.max(12, nextPercent)));
      };

      const onMouseUp = () => {
        setIsResizingNav(false);
        document.body.style.userSelect = '';
        document.body.style.cursor = '';
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    },
    [isWideLayout, showNavPanel]
  );

  /**
   * Start resize for detail (right) panel.
   * Uses same pattern as graph-data-processor startPreviewResize.
   */
  const startDetailResize = useCallback(
    (event: React.MouseEvent) => {
      if (!isWideLayout || !showDetailPanel) return;
      event.preventDefault();
      const container = splitContainerRef.current;
      if (!container) return;

      setIsResizingDetail(true);
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'col-resize';

      const onMouseMove = (moveEvent: MouseEvent) => {
        const rect = container.getBoundingClientRect();
        if (!rect.width) return;
        const pointerX = Math.min(Math.max(moveEvent.clientX - rect.left, 0), rect.width);
        const nextPercent = ((rect.width - pointerX) / rect.width) * 100;
        // Clamp between 20% and 45%
        setDetailWidthPercent(Math.min(45, Math.max(20, nextPercent)));
      };

      const onMouseUp = () => {
        setIsResizingDetail(false);
        document.body.style.userSelect = '';
        document.body.style.cursor = '';
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    },
    [isWideLayout, showDetailPanel]
  );

  useEffect(() => {
    thumbnailQueue.cancelPending();
    clearStoragePreviewFailureCache();
    const timer = window.setTimeout(() => setFetchPage(page), 400);
    return () => window.clearTimeout(timer);
  }, [page, pageSize]);

  // Prevent double API calls in React Strict Mode
  const mountedRef = useRef(false);
  const fetchInProgressRef = useRef({
    artifacts: false,
    facets: false,
    folders: false,
  });

  // ── Fetch artifacts (server-side paged) ───────────────────────────────────
  // Uses plugin.file_manager.list with all filters/sort sent to backend so
  // pagination scales beyond a single page worth of data.
  const fetchArtifacts = useCallback(async () => {
    // Prevent concurrent duplicate calls
    if (fetchInProgressRef.current.artifacts) {
      console.debug('[FileExplorerView] Skipping duplicate fetchArtifacts call');
      return;
    }
    
    fetchInProgressRef.current.artifacts = true;

    // Debug counter (A7)
    if (DEBUG_STORAGE) {
      const now = Date.now();
      if (now - debugCounters.current.windowStart > 10000) {
        console.log('[DEBUG_STORAGE] 10s window:', debugCounters.current);
        debugCounters.current = { list: 0, facets: 0, folders: 0, windowStart: now };
      }
      debugCounters.current.list++;
    }

    console.info('[FileExplorerView] Fetching files (server-paged):', {
      page: fetchPage,
      pageSize,
      sortBy,
      sortDir,
      search,
      listFilter,
      ownership,
      currentPath,
      advancedFilters,
    });
    setLoading(true);
    try {
      const listArgs: FileManagerListArgs = {
        page: fetchPage,
        page_size: pageSize,
        sort_by: sortBy,
        sort_dir: sortDir,
        ownership,
        include_stats: true,
        ...(search.trim() ? { search: search.trim() } : {}),
        ...listFilter,
        ...advancedFiltersToListArgs(advancedFilters),
      };
      if (currentPath && !currentPath.startsWith('__')) {
        listArgs.prefix = `${currentPath}/`;
        listArgs.include_subfolders = false;
      }
      // B8: Recent path forces chronological sort
      if (currentPath === '__recent__') {
        listArgs.sort_by = 'created_at';
        listArgs.sort_dir = 'desc';
      }
      const response = await storageService.listFilesForExplorer(listArgs);
      setArtifacts(response.items);
      const totalFromStats = response.totals_by_type
        ? Object.values(response.totals_by_type).reduce(
            (sum, bucket) => sum + (bucket?.count ?? 0),
            0
          )
        : 0;
      const resolvedTotal = Math.max(
        response.total ?? 0,
        totalFromStats,
        response.items.length
      );
      setTotalCount(resolvedTotal);
      // Prefer server totals when available; falls back to local computation.
      if (response.totals_by_type) setTotalsByType(response.totals_by_type);
      setFetchError(null);
      console.info('[FileExplorerView] Files loaded:', {
        count: response.items.length,
        total: resolvedTotal,
        totalFromList: response.total,
        totalFromStats,
      });
    } catch (error) {
      console.error('[FileExplorerView] Failed to load files:', error);
      
      // Classify error (A6)
      let errorType: 'rate_limit' | 'auth' | 'server' | 'network' = 'network';
      if (isAxiosError(error) && error.response) {
        const status = error.response.status;
        if (status === 429) errorType = 'rate_limit';
        else if (status === 401 || status === 403) errorType = 'auth';
        else if (status >= 500) errorType = 'server';
      }
      setFetchError(errorType);
      setArtifacts([]);
    } finally {
      setLoading(false);
      fetchInProgressRef.current.artifacts = false;
    }
  }, [DEBUG_STORAGE, fetchPage, pageSize, sortBy, sortDir, search, listFilter, ownership, currentPath, advancedFilters]);

  /**
   * Fetch sidebar facet counts (run once on mount + on ownership change).
   * Independent of pagination so chip totals reflect the whole library.
   */
  const fetchFacets = useCallback(async () => {
    // Prevent concurrent duplicate calls
    if (fetchInProgressRef.current.facets) {
      console.debug('[FileExplorerView] Skipping duplicate fetchFacets call');
      return;
    }
    
    fetchInProgressRef.current.facets = true;

    // Debug counter (A7)
    if (DEBUG_STORAGE) {
      debugCounters.current.facets++;
    }

    try {
      const data = await storageService.getFileManagerFacets({
        filters: { ownership },
        top_mimes: 12,
        top_tags: 12,
        top_sessions: 12,
      });
      setFacets(data);
      // If the facets endpoint returns media_type counts, use them as the
      // authoritative source for the type chips.
      if (data.media_type) setTotalsByType(data.media_type);
      if (data.total?.bytes != null) {
        const used = data.total.bytes;
        const quotaFallback = await storageService.getStorageQuota();
        const quotaBytes = quotaFallback?.quota_bytes ?? used * 10;
        const percent =
          quotaFallback?.usage_percent ??
          (quotaBytes > 0 ? Math.round((used / quotaBytes) * 1000) / 10 : 0);
        setStorageUsage({
          usedHuman: formatBytesHuman(used),
          quotaHuman:
            quotaFallback?.quota_human ?? formatBytesHuman(quotaBytes),
          percent,
        });
      }
    } catch (error) {
      console.warn('[FileExplorerView] Facets unavailable:', error);
      const quotaFallback = await storageService.getStorageQuota();
      if (quotaFallback) {
        setStorageUsage({
          usedHuman: quotaFallback.used_human ?? formatBytesHuman(quotaFallback.used_bytes),
          quotaHuman: quotaFallback.quota_human ?? formatBytesHuman(quotaFallback.quota_bytes),
          percent: quotaFallback.usage_percent,
        });
      }
    } finally {
      fetchInProgressRef.current.facets = false;
    }
  }, [DEBUG_STORAGE, ownership]);

  /**
   * Fetch top-level folder list once on mount. Used to seed the FolderTree
   * with paths that aren't on the current page.
   */
  const fetchFolders = useCallback(async () => {
    // Prevent concurrent duplicate calls
    if (fetchInProgressRef.current.folders) {
      console.debug('[FileExplorerView] Skipping duplicate fetchFolders call');
      return;
    }
    
    fetchInProgressRef.current.folders = true;

    // Debug counter (A7)
    if (DEBUG_STORAGE) {
      debugCounters.current.folders++;
    }

    try {
      const data = await storageService.getFileManagerFolders({
        prefix: '',
        delimiter: '/',
        ownership,
        limit: 200,
      });
      setServerFolders(data.folders);
      console.info('[FileExplorerView] Folders loaded:', {
        count: data.folders.length,
      });
    } catch (error) {
      // Non-critical — FolderTree will fall back to deriving folders from
      // the in-memory artifact list.
      console.warn('[FileExplorerView] Folders unavailable:', error);
      setServerFolders(null);
    } finally {
      fetchInProgressRef.current.folders = false;
    }
  }, [DEBUG_STORAGE, ownership]);

  useEffect(() => {
    fetchArtifacts();
  }, [fetchArtifacts]);

  /** Deep link from One Search: ?search= */
  useEffect(() => {
    setSearch(urlSearchParam);
    if (urlSearchParam) setPage(1);
  }, [urlSearchParam]);

  useEffect(() => {
    if (urlArtifactParam) pendingUrlArtifactRef.current = urlArtifactParam;
  }, [urlArtifactParam]);

  // Facets + folders are independent of pagination — fetch them when
  // ownership scope changes (and once on mount).
  useEffect(() => {
    fetchFacets();
    fetchFolders();
  }, [fetchFacets, fetchFolders]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleSelectArtifact = useCallback((artifact: Artifact) => {
    setSelectedArtifact(artifact);
    setShowDetailPanel(true);
  }, []);

  /** Deep link from One Search: ?artifact= (& optional ?preview=1). */
  useEffect(() => {
    const pendingId = pendingUrlArtifactRef.current;
    if (!pendingId || loading) return;
    const artifact = artifacts.find((a) => a.id === pendingId);
    if (!artifact) return;
    handleSelectArtifact(artifact);
    if (urlPreviewParam) handlePreviewArtifact(artifact);
    pendingUrlArtifactRef.current = null;
  }, [
    artifacts,
    loading,
    urlPreviewParam,
    handleSelectArtifact,
    handlePreviewArtifact,
  ]);

  const handleNavigatePath = useCallback((path: string) => {
    setCurrentPath(path);
    setSelectedArtifact(null);
    // Reset to first page when changing folder context.
    setPage(1);
  }, []);

  const handleArtifactsDeleted = useCallback((ids: string[]) => {
    setArtifacts((prev) => prev.filter((a) => !ids.includes(a.id)));
    if (selectedArtifact && ids.includes(selectedArtifact.id)) {
      setSelectedArtifact(null);
      setShowDetailPanel(false);
    }
    // Refresh facets/folders so counts stay accurate.
    fetchFacets();
  }, [selectedArtifact, fetchFacets]);

  const handleArtifactDeleted = useCallback((id: string) => {
    handleArtifactsDeleted([id]);
  }, [handleArtifactsDeleted]);

  const handleUploadComplete = useCallback(
    (uploadedCount: number) => {
      console.info('[FileExplorerView] Upload complete, refreshing:', { uploadedCount });
      setShowUploadModal(false);
      fetchArtifacts();
      fetchFacets();
      fetchFolders();
    },
    [fetchArtifacts, fetchFacets, fetchFolders]
  );

  const refreshAll = useCallback(() => {
    fetchArtifacts();
    fetchFacets();
    fetchFolders();
  }, [fetchArtifacts, fetchFacets, fetchFolders]);

  useOnWorkspaceChanged(refreshAll);

  // ── Server-side query handlers (memoised so children don't re-render) ─────
  /** Reset page when search/filter/sort changes so user starts at page 1. */
  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    setPage(1);
  }, []);
  const handleSortChange = useCallback(
    (field: typeof sortBy, dir: typeof sortDir) => {
      setSortBy(field);
      setSortDir(dir);
      setPage(1);
    },
    []
  );
  const handleListFilterChange = useCallback((filter: FileExplorerListFilter) => {
    setListFilter(filter);
    setPage(1);
  }, []);
  const handleAdvancedFiltersApply = useCallback((values: AdvancedFilterValues) => {
    setAdvancedFilters(values);
    setPage(1);
  }, []);
  const handleAdvancedFiltersReset = useCallback(() => {
    setAdvancedFilters({});
    setPage(1);
  }, []);
  const handlePageChange = useCallback((next: number) => {
    setPage(Math.max(1, next));
  }, []);
  const handlePageSizeChange = useCallback((next: number) => {
    setPageSize(next);
    setPage(1);
  }, []);
  const handleOwnershipChange = useCallback((next: FileManagerOwnership) => {
    setOwnership(next);
    setPage(1);
  }, []);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(totalCount / pageSize)),
    [totalCount, pageSize]
  );
  const libraryTotal = useMemo(() => {
    if (totalsByType && Object.keys(totalsByType).length > 0) {
      return Object.values(totalsByType).reduce((sum, v) => sum + (v?.count ?? 0), 0);
    }
    return totalCount;
  }, [totalsByType, totalCount]);

  const starredCount = 0;

  // ── Calculate panel widths ────────────────────────────────────────────────
  const getNavWidth = () => {
    if (!showNavPanel || !isWideLayout) return '0%';
    return `${navWidthPercent}%`;
  };

  const getDetailWidth = () => {
    if (!showDetailPanel || !isWideLayout) return '0%';
    return `${detailWidthPercent}%`;
  };

  const getCenterWidth = () => {
    if (!isWideLayout) return '100%';
    let used = 0;
    if (showNavPanel) used += navWidthPercent;
    if (showDetailPanel) used += detailWidthPercent;
    return `${100 - used}%`;
  };

  const buildNativeAiChatContext = useCallback(
    () => ({
      current_path: currentPath,
      view_mode: view,
      ownership,
      total_count: totalCount,
      backend_available: !fetchError,
      loading,
      page,
      page_size: pageSize,
      selected_artifact_id: selectedArtifact?.id ?? null,
      nav_panel_open: showNavPanel,
      detail_panel_open: showDetailPanel,
    }),
    [
      currentPath,
      view,
      ownership,
      totalCount,
      fetchError,
      loading,
      page,
      pageSize,
      selectedArtifact?.id,
      showNavPanel,
      showDetailPanel,
    ]
  );

  const handleAttachSelectedToBoard = useCallback(() => {
    if (!attachToBoardId) return;
    const ids =
      attachBulkIds.length > 0
        ? attachBulkIds
        : selectedArtifact
          ? [selectedArtifact.id]
          : [];
    if (!ids.length) return;
    const items = ids.map((id) => {
      const art = artifacts.find((a) => a.id === id) ?? selectedArtifact;
      if (!art) {
        return {
          artifactId: id,
          name: id,
        };
      }
      return {
        artifactId: art.id,
        name: art.filename ?? art.id,
        mime_type: art.mime_type ?? undefined,
        size: art.file_size != null ? Number(art.file_size) : undefined,
      };
    });
    enqueueAttachItems(attachToBoardId, items);
    router.push(routes.userBoards.detail(attachToBoardId));
  }, [attachToBoardId, attachBulkIds, selectedArtifact, artifacts, router]);

  return (
    <div className={cn('flex flex-col')}>

      <WorkspaceScopeBanner />

      {attachToBoardId ? (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2">
          <Text className="text-xs text-gray-700 dark:text-gray-300">
            {t('boards.attachments.explorerAttachMode', 'Select files to attach to your board.')}
            {attachBulkIds.length > 1
              ? ` (${attachBulkIds.length} ${t('boards.attachments.selected', 'selected')})`
              : ''}
          </Text>
          <Button
            size="sm"
            disabled={attachBulkIds.length === 0 && !selectedArtifact}
            onClick={handleAttachSelectedToBoard}
            className="gap-1"
          >
            <PiLinkBold className="h-3.5 w-3.5" />
            {t('boards.attachments.attachToBoard', 'Attach to board')}
          </Button>
        </div>
      ) : null}

      {/* ── 1. Header Row ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div>
            <Title as="h3" className="text-lg font-semibold">{tx('title')}</Title>
            <div className="mt-0.5 flex items-center gap-2">
              <Text className="text-xs text-gray-500">{tx('storage')}:</Text>
              <Badge variant="flat" color="info" size="sm">
                {currentPath || tx('root')}
              </Badge>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Stats */}
          {!loading && !fetchError && (
            <div className="hidden items-center gap-4 text-xs text-gray-600 dark:text-gray-400 md:flex">
              <span>
                <strong className="text-gray-900 dark:text-gray-100">{totalCount}</strong>
                <span className="text-gray-400"> {tx('files')}</span>
              </span>
              {storageUsage && (
                <span title={tx('storageUsage')}>
                  {tx('storageUsedOf', {
                    used: storageUsage.usedHuman,
                    total: storageUsage.quotaHuman,
                  })}
                  <span className="ms-1 text-gray-400">({storageUsage.percent}%)</span>
                </span>
              )}
            </div>
          )}

          {/* Upload button */}
          <Button
            onClick={() => {
              setDroppedFiles(undefined);
              setShowUploadModal(true);
            }}
            className="flex items-center gap-2"
          >
            <PiUploadSimpleBold className="h-4 w-4" />
            {tx('upload')}
          </Button>
        </div>
      </div>

      {/* Error banner (A6) — different messages for rate limit / auth / server / network */}
      {fetchError && !loading && (
        <div className="mb-4 rounded-lg border border-dashed border-orange-300 bg-orange-50 p-4 dark:border-orange-800 dark:bg-orange-950/30">
          <div className="flex items-center gap-3">
            <PiCloudSlashBold className="h-6 w-6 shrink-0 text-orange-500" />
            <div className="flex-1">
              <Text className="text-sm font-semibold text-orange-700 dark:text-orange-400">
                {fetchError === 'rate_limit' && tx('errors.rateLimitTitle')}
                {fetchError === 'auth' && tx('errors.authErrorTitle')}
                {fetchError === 'server' && tx('errors.serverErrorTitle')}
                {fetchError === 'network' && tx('errors.backendUnavailableTitle')}
              </Text>
              <Text className="text-xs text-orange-600 dark:text-orange-500">
                {fetchError === 'rate_limit' && tx('errors.rateLimitMessage')}
                {fetchError === 'auth' && tx('errors.authErrorMessage')}
                {fetchError === 'server' && tx('errors.serverErrorMessage')}
                {fetchError === 'network' && tx('errors.backendUnavailableMessage')}
              </Text>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 border-orange-300 text-orange-700"
              onClick={fetchArtifacts}
            >
              <PiArrowsCounterClockwiseBold className="h-4 w-4" />
              {tx('errors.retry')}
            </Button>
          </div>
        </div>
      )}

      {/* ── 2. Workspace Layout Bar ───────────────────────────────── */}
      {/* v0.43.0 — compact icon-only controls with tooltips. */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {/* Panel toggles (icon-only) */}
        <div className="flex items-center gap-1 rounded-md border border-muted bg-gray-0 p-0.5 dark:bg-gray-50">
          <Tooltip content={showNavPanel ? tx('closeNavigationPanel') : tx('openNavigationPanel')} size="sm">
            <ActionIcon
              size="sm"
              variant={showNavPanel ? 'solid' : 'text'}
              onClick={() => setShowNavPanel((v) => !v)}
              aria-label={tx('navigationPanel')}
              aria-pressed={showNavPanel}
              className="h-7 w-7"
            >
              <PiSidebarBold className="h-4 w-4" />
            </ActionIcon>
          </Tooltip>
          <Tooltip content={showDetailPanel ? tx('closeDetailsPanel') : tx('openDetailsPanel')} size="sm">
            <ActionIcon
              size="sm"
              variant={showDetailPanel ? 'solid' : 'text'}
              onClick={() => setShowDetailPanel((v) => !v)}
              aria-label={tx('detailsPanel')}
              aria-pressed={showDetailPanel}
              className="h-7 w-7"
            >
              <PiSidebarSimpleBold className="h-4 w-4 scale-x-[-1]" />
            </ActionIcon>
          </Tooltip>
        </div>

        {/* View mode toggle (list ↔ grid) — v0.45.0 */}
        <div className="flex items-center gap-1 rounded-md border border-muted bg-gray-0 p-0.5 dark:bg-gray-50">
          <Tooltip content={tx('listView')} size="sm">
            <ActionIcon
              size="sm"
              variant={view === 'list' ? 'solid' : 'text'}
              onClick={() => setView('list')}
              aria-label={tx('listView')}
              aria-pressed={view === 'list'}
              className="h-7 w-7"
            >
              <PiListBold className="h-4 w-4" />
            </ActionIcon>
          </Tooltip>
          <Tooltip content={tx('gridView')} size="sm">
            <ActionIcon
              size="sm"
              variant={view === 'grid' ? 'solid' : 'text'}
              onClick={() => setView('grid')}
              aria-label={tx('gridView')}
              aria-pressed={view === 'grid'}
              className="h-7 w-7"
            >
              <PiSquaresFourBold className="h-4 w-4" />
            </ActionIcon>
          </Tooltip>
        </div>

        {/* Ownership scope (icon segmented) */}
        <div className="flex items-center gap-1 rounded-md border border-muted bg-gray-0 p-0.5 dark:bg-gray-50">
          {(
            [
              { key: 'any', label: tx('ownership.any'), Icon: PiGlobeBold },
              { key: 'owner', label: tx('ownership.owner'), Icon: PiUserBold },
              { key: 'shared', label: tx('ownership.shared'), Icon: PiUsersBold },
            ] as { key: FileManagerOwnership; label: string; Icon: typeof PiUserBold }[]
          ).map(({ key, label, Icon }) => (
            <Tooltip key={key} content={label} size="sm">
              <ActionIcon
                size="sm"
                variant={ownership === key ? 'solid' : 'text'}
                onClick={() => handleOwnershipChange(key)}
                aria-label={label}
                aria-pressed={ownership === key}
                className="h-7 w-7"
              >
                <Icon className="h-4 w-4" />
              </ActionIcon>
            </Tooltip>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Tooltip content={tx('reload')} size="sm">
            <ActionIcon
              size="sm"
              variant="outline"
              onClick={() => {
                fetchArtifacts();
                fetchFacets();
                fetchFolders();
              }}
              aria-label={tx('reload')}
              className={cn('h-7 w-7', loading && 'animate-spin')}
            >
              <PiArrowsCounterClockwiseBold className="h-3.5 w-3.5" />
            </ActionIcon>
          </Tooltip>
        </div>
      </div>

      {/* ── 3. Panel Container ───────────────────────────────────── */}
      {/* v0.43.0 — outer container is a transparent shell; each child panel */}
      {/* and the inner FileTable cards have their own borders/shadows.       */}
      <div
        ref={splitContainerRef}
        className={cn(
          'min-h-[560px] xl:h-[calc(100vh-260px)]',
          'flex flex-col xl:flex-row gap-2.5'
        )}
      >
        {/* ── Left Panel (Navigation) ──────────────────────────────── */}
        {showNavPanel && (
          <div
            className={cn(
              'min-w-0 min-h-[200px] xl:min-h-0 xl:h-full',
              'rounded-lg border border-muted bg-gray-0 dark:bg-gray-50 shadow-sm overflow-hidden'
            )}
            style={
              isWideLayout
                ? { width: getNavWidth() }
                : { width: '100%' }
            }
          >
            <FolderTree
              artifacts={artifacts}
              serverFolders={serverFolders ?? undefined}
              selectedPath={currentPath}
              onSelectPath={handleNavigatePath}
              starredCount={starredCount}
              libraryTotal={libraryTotal}
            />
          </div>
        )}

        {/* Nav resize divider */}
        {showNavPanel && isWideLayout && (
          <button
            type="button"
            onMouseDown={startNavResize}
            className={cn(
              'w-1.5 flex-shrink-0 rounded-full transition-colors cursor-col-resize',
              isResizingNav ? 'bg-primary/30' : 'bg-gray-200 hover:bg-primary/20 dark:bg-gray-100'
            )}
            aria-label="Resize navigation panel"
            title="Drag to resize"
          />
        )}

        {/* ── Center Panel (File Table or Grid) ───────────────────── */}
        <div
          className="min-w-0 flex flex-col"
          style={
            isWideLayout
              ? { width: getCenterWidth() }
              : { width: '100%' }
          }
        >
          <FileTable
            artifacts={artifacts}
            loading={loading}
            currentPath={currentPath}
            onNavigatePath={handleNavigatePath}
            onSelectArtifact={handleSelectArtifact}
            onArtifactSelectionChange={attachToBoardId ? setAttachBulkIds : undefined}
            selectedArtifactId={selectedArtifact?.id}
            onArtifactsDeleted={handleArtifactsDeleted}
            // Server-side query controls (v0.39.2)
            search={search}
            onSearchChange={handleSearchChange}
            sortBy={sortBy}
            sortDir={sortDir}
            onSortChange={handleSortChange}
            onListFilterChange={handleListFilterChange}
            advancedFilters={advancedFilters}
            showAdvancedFilters={showAdvancedFilters}
            onToggleAdvancedFilters={() => setShowAdvancedFilters((v) => !v)}
            onAdvancedFiltersApply={handleAdvancedFiltersApply}
            onAdvancedFiltersReset={handleAdvancedFiltersReset}
            onRequestUpload={(files) => {
              setDroppedFiles(files);
              setShowUploadModal(true);
            }}
            page={page}
            pageSize={pageSize}
            totalCount={totalCount}
            totalPages={totalPages}
            pageSizeOptions={[...PAGE_SIZE_OPTIONS]}
            onPageChange={handlePageChange}
            onPageSizeChange={handlePageSizeChange}
            // Server-side facet totals for the chip bar.
            totalsByType={totalsByType}
            // v0.44.0 / v0.45.0 — preview, confirm-dialog, view mode
            onPreviewArtifact={handlePreviewArtifact}
            onConfirmBulkDelete={handleConfirmBulkDelete}
            view={view}
            listEmptyHint={
              !loading && !fetchError && totalCount === 0
                ? tx('emptyTenantHint')
                : undefined
            }
            className="h-full"
          />
        </div>

        {/* Detail resize divider */}
        {showDetailPanel && isWideLayout && (
          <button
            type="button"
            onMouseDown={startDetailResize}
            className={cn(
              'w-1.5 flex-shrink-0 rounded-full transition-colors cursor-col-resize',
              isResizingDetail ? 'bg-primary/30' : 'bg-gray-200 hover:bg-primary/20 dark:bg-gray-100'
            )}
            aria-label="Resize detail panel"
            title="Drag to resize"
          />
        )}

        {/* ── Right Panel (Detail) ─────────────────────────────────── */}
        {showDetailPanel && (
          <div
            className={cn(
              'min-w-0 flex flex-col',
              'rounded-lg border border-muted bg-gray-0 dark:bg-gray-50 shadow-sm overflow-hidden'
            )}
            style={
              isWideLayout
                ? { width: getDetailWidth() }
                : { width: '100%' }
            }
          >
            <FileDetailPanel
              artifact={selectedArtifact}
              onDeleted={handleArtifactDeleted}
              onClose={() => setShowDetailPanel(false)}
              onPreview={handlePreviewArtifact}
              onConfirmDelete={confirm}
              className="h-full"
            />
          </div>
        )}
      </div>

      <FloatingNativeAiChat surface="file_explorer" buildContext={buildNativeAiChatContext} />

      {/* ── Upload Modal ────────────────────────────────────────────── */}
      {showUploadModal && (
        <UploadModal
          folderPath={currentPath.startsWith('__') ? '' : currentPath}
          initialFiles={droppedFiles}
          onUploadComplete={handleUploadComplete}
          onClose={() => {
            setShowUploadModal(false);
            setDroppedFiles(undefined);
          }}
        />
      )}
    </div>
  );
}
