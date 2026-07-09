// ============================================
// FileTable — Center Panel main file/folder table
// Server-paged: search / sort / mediaType filter / pagination are CONTROLLED
// by FileExplorerView (v0.39.2). Type chips and folder rows are still
// visualised here.
// ============================================

'use client';

import { Tooltip } from '@/components/tooltip';
import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Text, Input, Button, ActionIcon } from 'rizzui';
import { useTranslation } from 'react-i18next';
import JSZip from 'jszip';
import {
  PiMagnifyingGlassBold,
  PiTrashBold,
  PiDownloadSimpleBold,
  PiFileBold,
  PiImageBold,
  PiFilePdfBold,
  PiVideoFill,
  PiMusicNotesBold,
  PiArchiveBold,
  PiFileTextBold,
  PiCheckSquareBold,
  PiSquareBold,
  PiArrowRightBold,
  PiCaretUpDownBold,
  PiCaretLeftBold,
  PiCaretRightBold,
  PiCaretDoubleLeftBold,
  PiCaretDoubleRightBold,
  PiUserBold,
  PiUsersBold,
  PiLinkSimpleBold,
  PiMagnifyingGlassPlusBold,
  PiMagnifyingGlassMinusBold,
  PiShieldCheckBold,
  PiInfoBold,
  PiUserCircleBold,
  PiXBold,
  PiSortAscendingBold,
  PiSortDescendingBold,
  PiCaretUpBold,
  PiCaretDownBold,
  PiFunnelBold,
  PiSlidersHorizontalBold,
} from 'react-icons/pi';
import cn from '@core/utils/class-names';
import FolderIcon from '@core/components/icons/folder-solid';
import AuthenticatedStorageImage from '@/components/authenticated-storage-image';
import { THUMBNAIL_PRESETS } from '@/config/file-upload.config';
import { thumbnailQueue } from '@/utils/request-queue';
import { clearStoragePreviewFailureCache, storageService } from '@/services/storage.service';
import TypeFilterChips from './type-filter-chips';
import BreadcrumbNav from './breadcrumb-nav';
import AuthenticatedImage from '@/app/shared/ai-chat/authenticated-image';
import { getFileIcon } from '@/utils/file-icons';
import {
  supportsArtifactVisualPreview,
  supportsStoragePreviewEndpoint,
  supportsStorageThumbnailEndpoint,
} from '@/utils/storage-media-url';
import { chipToListFilter, FileExplorerListFilter } from '@/utils/file-explorer-filters';
import ShareStorageImage from '@/components/share-storage-image';
import FileExplorerContextMenu, {
  type FileExplorerContextMenuState,
} from './file-explorer-context-menu';
import FileExplorerAdvancedFilters, {
  type AdvancedFilterValues,
} from './file-explorer-advanced-filters';
import type {
  Artifact,
  FileTypeKey,
  FileManagerTotals,
} from '@/types/storage.types';
import toast from 'react-hot-toast';
import { FILE_EXPLORER_FACE_SEARCH_ENABLED } from '@/config/constants';
import dayjs from 'dayjs';

// ==========================================
// Helpers
// ==========================================

/** Get icon component for a given mime_type */
/** Convert bytes to human-readable size string */
function formatSize(bytes: number): string {
  if (bytes === 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`;
  return `${(bytes / 1073741824).toFixed(2)} GB`;
}

/** Get MIME category badge color */
function getMimeBadgeColor(mimeType: string): string {
  if (mimeType.startsWith('image/')) return 'bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400';
  if (mimeType === 'application/pdf') return 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400';
  if (mimeType.startsWith('video/')) return 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400';
  if (mimeType.startsWith('audio/')) return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-400';
  if (mimeType.includes('archive') || mimeType.includes('zip') || mimeType.includes('tar'))
    return 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400';
  return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400';
}

/** Get simplified MIME label for badge */
function getMimeLabel(mimeType: string): string {
  if (mimeType.startsWith('image/')) return mimeType.split('/')[1].toUpperCase();
  if (mimeType === 'application/pdf') return 'PDF';
  if (mimeType.startsWith('video/')) return mimeType.split('/')[1].toUpperCase();
  if (mimeType.startsWith('audio/')) return mimeType.split('/')[1].toUpperCase();
  if (mimeType.includes('zip')) return 'ZIP';
  if (mimeType.includes('tar')) return 'TAR';
  const sub = mimeType.split('/')[1] || mimeType;
  return sub.length > 8 ? sub.substring(0, 8).toUpperCase() : sub.toUpperCase();
}

function canRenderGridPreview(artifact: Artifact): boolean {
  return supportsArtifactVisualPreview(artifact.mime_type, artifact.media_type);
}

/**
 * Grid card preview — Lazy-loaded with Intersection Observer + queue.
 * Only fetches when visible in viewport, max 4 concurrent requests.
 * Prevents N+1 request storm when scrolling/paginating.
 */
function GridFileThumbnail({
  artifact,
  scrollRoot,
}: {
  artifact: Artifact;
  scrollRoot: HTMLElement | null;
}) {
  const [shareTokenFailed, setShareTokenFailed] = useState(false);
  const [blobFailed, setBlobFailed] = useState(false);
  const preset = THUMBNAIL_PRESETS.fileExplorerGrid;

  const handleShareError = useCallback(() => {
    setShareTokenFailed(true);
  }, []);

  if (!canRenderGridPreview(artifact)) {
    return getFileIcon(artifact.mime_type, 'h-12 w-12');
  }

  // Try share-token first (browser-cacheable, no JWT)
  if (
    supportsStorageThumbnailEndpoint(artifact.mime_type, artifact.media_type) &&
    !shareTokenFailed
  ) {
    return (
      <ShareStorageImage
        artifactId={artifact.id}
        mimeType={artifact.mime_type}
        mediaType={artifact.media_type}
        alt={artifact.filename}
        className="h-full w-full object-contain"
        onError={handleShareError}
      />
    );
  }

  // Fallback: blob fetch with JWT (one attempt only)
  if (blobFailed) {
    return getFileIcon(artifact.mime_type, 'h-12 w-12');
  }

  const inlinePreviewUrl = storageService.getDownloadUrl(artifact.id, 'inline');
  const thumbnailUrl = supportsStoragePreviewEndpoint(
    artifact.mime_type,
    artifact.media_type
  )
    ? storageService.getPreviewUrl(artifact.id, 1)
    : storageService.getThumbnailUrl(
        artifact.id,
        preset.width,
        preset.height,
        'webp',
        preset.quality,
        artifact.mime_type,
        artifact.media_type
      );

  return (
    <AuthenticatedStorageImage
      src={inlinePreviewUrl}
      thumbnailSrc={thumbnailUrl}
      alt={artifact.filename}
      className="h-full w-full object-contain"
      lazy
      lazyRootMargin="80px"
      scrollRoot={scrollRoot}
      onStatusChange={(s) => {
        if (s === 'error') setBlobFailed(true);
      }}
    />
  );
}

/** Processing status mini indicators — Phosphor-icon based (v0.43.0). */
function ProcessingBadges({ status }: { status: Artifact['processing_status'] }) {
  const { t } = useTranslation();
  if (!status) return null;
  const items: { key: keyof NonNullable<Artifact['processing_status']>; label: string; Icon: React.ComponentType<{ className?: string }>; color: string }[] = [
    { key: 'file_identify', label: 'file.identify', Icon: PiInfoBold, color: 'text-sky-500' },
    { key: 'file_meta', label: 'file.meta', Icon: PiMagnifyingGlassPlusBold, color: 'text-violet-500' },
    { key: 'file_secure', label: 'file.secure', Icon: PiShieldCheckBold, color: 'text-emerald-500' },
    { key: 'image_faces', label: 'image.faces', Icon: PiUserCircleBold, color: 'text-amber-500' },
  ];
  return (
    <div className="flex items-center gap-0.5">
      {items.map(({ key, label, Icon, color }) =>
        status[key] === 'done' ? (
          <Tooltip
            key={key}
            content={`${label}: ${t('fileExplorer.completed')}`}
            placement="top"
            size="sm"
          >
            <span className={cn('inline-flex h-4 w-4 items-center justify-center', color)}>
              <Icon className="h-3.5 w-3.5" />
            </span>
          </Tooltip>
        ) : null
      )}
    </div>
  );
}

// ==========================================
// Types
// ==========================================

/** Server-side sort fields supported by plugin.file_manager.list. */
type SortField = 'created_at' | 'name' | 'size' | 'mime_type' | 'media_type';
type SortDir = 'asc' | 'desc';

/** A virtual folder row shown in the table when navigating directories */
interface FolderRow {
  type: 'folder';
  name: string;
  path: string;
  childCount: number;
}

interface FileTableProps {
  /** Artifacts for the CURRENT page (already paged by server). */
  artifacts: Artifact[];
  /** Loading state */
  loading: boolean;
  /** Current folder path filter ('' = root, '__starred__', '__recent__') */
  currentPath: string;
  onNavigatePath: (path: string) => void;
  /** Called when row is single-clicked */
  onSelectArtifact: (artifact: Artifact) => void;
  /** Bulk checkbox selection ids (for attach-to-board multi-select) */
  onArtifactSelectionChange?: (ids: string[]) => void;
  /** Currently selected artifact ID */
  selectedArtifactId?: string | null;
  /** Called after successful deletion */
  onArtifactsDeleted: (ids: string[]) => void;
  className?: string;

  // ── Controlled server-side query state (v0.39.2) ────────────────────────
  /** Search text — debounced upstream and forwarded to backend. */
  search: string;
  onSearchChange: (value: string) => void;
  /** Sort column. */
  sortBy: SortField;
  /** Sort direction. */
  sortDir: SortDir;
  /** Sort change. */
  onSortChange: (field: SortField, dir: SortDir) => void;
  /** Server list filter from type chips. */
  onListFilterChange: (filter: FileExplorerListFilter) => void;
  advancedFilters?: AdvancedFilterValues;
  showAdvancedFilters?: boolean;
  onToggleAdvancedFilters?: () => void;
  onAdvancedFiltersApply?: (values: AdvancedFilterValues) => void;
  onAdvancedFiltersReset?: () => void;
  onRequestUpload?: (files?: File[]) => void;
  /** Pagination state. */
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  pageSizeOptions: number[];
  onPageChange: (next: number) => void;
  onPageSizeChange: (next: number) => void;
  /** Server-side per-type totals (mediaType → {count, bytes}) for chip badges. */
  totalsByType?: Record<string, FileManagerTotals>;
  /** v0.44.0 — preview an artifact (Eye icon / double-click on file row). */
  onPreviewArtifact?: (artifact: Artifact) => void;
  /** v0.44.0 — request user confirmation before bulk delete. */
  onConfirmBulkDelete?: (count: number) => Promise<boolean>;
  /** v0.45.0 — current view mode (list | grid). */
  view?: 'list' | 'grid';
  /** Optional hint when list is empty (e.g. tenant has no files vs error). */
  listEmptyHint?: string;
}

// ==========================================
// FileTable Component
// ==========================================

/**
 * FileTable — Main center panel of File Explorer.
 *
 * Features:
 * - Type filter chips (All, Image, PDF, Video, ...)
 * - Folder breadcrumb navigation
 * - Search bar
 * - Sortable columns
 * - Virtual folder rows (from artifact.folder_path)
 * - Bulk selection with delete/download actions
 * - Single-click → Right panel detail
 * - Double-click folder → Drill-in navigation
 *
 * @requires storageService — for delete operations
 */
export default function FileTable({
  artifacts,
  loading,
  currentPath,
  onNavigatePath,
  onSelectArtifact,
  onArtifactSelectionChange,
  selectedArtifactId,
  onArtifactsDeleted,
  className,
  search,
  onSearchChange,
  sortBy,
  sortDir,
  onSortChange,
  onListFilterChange,
  advancedFilters = {},
  showAdvancedFilters = false,
  onToggleAdvancedFilters,
  onAdvancedFiltersApply,
  onAdvancedFiltersReset,
  onRequestUpload,
  page,
  pageSize,
  totalCount,
  totalPages,
  pageSizeOptions,
  onPageChange,
  onPageSizeChange,
  totalsByType,
  onPreviewArtifact,
  onConfirmBulkDelete,
  view = 'list',
  listEmptyHint,
}: FileTableProps) {
  const { t } = useTranslation();
  const tx = useCallback((key: string) => t(`fileExplorer.${key}`), [t]);
  // ── Local UI state ────────────────────────────────────────────────────────
  // Local-only state for selection (multi-select) and the search-input
  // debounce buffer. Sort/filter/page are CONTROLLED via props.
  const [activeType, setActiveType] = useState<FileTypeKey>('all');
  const [searchDraft, setSearchDraft] = useState(search);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selectedFolders, setSelectedFolders] = useState<Set<string>>(new Set());
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [pageJumpDraft, setPageJumpDraft] = useState<string>(String(page));
  /** v0.43.0 — collapsing search bar; expanded on focus or when value present. */
  const [searchFocused, setSearchFocused] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [typeMenuOpen, setTypeMenuOpen] = useState(false);
  const [isCompactPanel, setIsCompactPanel] = useState(false);
  const tableRootRef = useRef<HTMLDivElement | null>(null);
  const [scrollRoot, setScrollRoot] = useState<HTMLElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const searchAreaRef = useRef<HTMLDivElement | null>(null);
  const typeMenuRef = useRef<HTMLDivElement | null>(null);
  const searchExpanded = searchFocused || searchDraft.length > 0;
  const [contextMenu, setContextMenu] = useState<FileExplorerContextMenuState>({
    visible: false,
    x: 0,
    y: 0,
    artifact: null,
    folderPath: null,
  });
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [isDragOver, setIsDragOver] = useState(false);
  const [listScrollTop, setListScrollTop] = useState(0);
  const [thumbnailScale, setThumbnailScale] = useState(1);
  const [density, setDensity] = useState<'compact' | 'comfortable'>('comfortable');
  const [groupBy, setGroupBy] = useState<'none' | 'type' | 'date'>('none');
  const LIST_ROW_HEIGHT = 52;
  const VIRTUAL_OVERSCAN = 8;

  // Sync local search draft when parent resets the value (e.g., on filter change).
  useEffect(() => {
    setSearchDraft(search);
  }, [search]);

  useEffect(() => {
    setPageJumpDraft(String(page));
  }, [page]);

  // Page change: drop queued thumbnails, allow retry after 429/5xx
  useEffect(() => {
    thumbnailQueue.cancelPending();
    clearStoragePreviewFailureCache();
  }, [page, pageSize]);

  useEffect(() => {
    if (!searchExpanded) return;
    const onDocumentPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (searchAreaRef.current?.contains(target)) return;
      if (typeMenuRef.current?.contains(target)) return;
      setSearchFocused(false);
      setTypeMenuOpen(false);
    };
    document.addEventListener('mousedown', onDocumentPointerDown);
    return () => document.removeEventListener('mousedown', onDocumentPointerDown);
  }, [searchExpanded]);

  useEffect(() => {
    const node = tableRootRef.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => {
      const width = entry.contentRect.width;
      setIsCompactPanel(width < 760);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  // Debounce: push search draft to parent after 350ms of inactivity.
  useEffect(() => {
    if (searchDraft === search) return;
    const id = window.setTimeout(() => onSearchChange(searchDraft), 350);
    return () => window.clearTimeout(id);
  }, [searchDraft, search, onSearchChange]);

  useEffect(() => {
    onListFilterChange(chipToListFilter(activeType));
  }, [activeType, onListFilterChange]);

  // ── Derive virtual folders within the current page ───────────────────────
  // Server-side folder resolution lives in FolderTree (via plugin.folders).
  // Here we only synthesise drill-down rows for sub-folders that appear in
  // the visible artifact set.
  const virtualFolders = useMemo<FolderRow[]>(() => {
    if (currentPath.startsWith('__')) return []; // starred/recent → no folders

    const prefix = currentPath ? `${currentPath}/` : '';
    const seen = new Map<string, number>();

    artifacts.forEach((a) => {
      const fp = a.folder_path || '';
      if (!fp.startsWith(prefix)) return;
      const remainder = fp.slice(prefix.length);
      const nextSegment = remainder.split('/')[0];
      if (!nextSegment) return;
      const folderPath = prefix + nextSegment;
      seen.set(folderPath, (seen.get(folderPath) ?? 0) + 1);
    });

    return Array.from(seen.entries()).map(([path, count]) => ({
      type: 'folder' as const,
      name: path.split('/').pop()!,
      path,
      childCount: count,
    }));
  }, [artifacts, currentPath]);

  // ── Filter artifacts for current path (client-side only for path) ────────
  // All other filters (search/media_type/sort/page) are already applied
  // server-side. The path filter still happens here because folder_path
  // navigation is purely a UI concept on top of the unified file_manager view.
  const pathFiltered = useMemo(() => {
    if (currentPath === '__starred__') return artifacts; // future: starred logic
    if (currentPath === '__recent__') return artifacts; // already sorted desc
    if (currentPath === '') return artifacts;

    return artifacts.filter((a) => (a.folder_path || '') === currentPath);
  }, [artifacts, currentPath]);

  // The visible row set after the local path filter.
  // Search/sort already happened on the server, so we use this directly.
  const sorted = pathFiltered;

  const virtualListWindow = useMemo(() => {
    if (view !== 'list') return { start: 0, end: sorted.length, paddingTop: 0, paddingBottom: 0 };
    const containerH = scrollRoot?.clientHeight ?? 600;
    const start = Math.max(0, Math.floor(listScrollTop / LIST_ROW_HEIGHT) - VIRTUAL_OVERSCAN);
    const visibleCount = Math.ceil(containerH / LIST_ROW_HEIGHT) + VIRTUAL_OVERSCAN * 2;
    const end = Math.min(sorted.length, start + visibleCount);
    return {
      start,
      end,
      paddingTop: start * LIST_ROW_HEIGHT,
      paddingBottom: Math.max(0, (sorted.length - end) * LIST_ROW_HEIGHT),
    };
  }, [view, sorted.length, listScrollTop, scrollRoot]);

  const visibleArtifacts = useMemo(
    () => sorted.slice(virtualListWindow.start, virtualListWindow.end),
    [sorted, virtualListWindow.start, virtualListWindow.end]
  );

  useEffect(() => {
    setFocusedIndex((i) => Math.min(i, Math.max(0, sorted.length - 1)));
  }, [sorted.length]);

  const openContextMenu = useCallback(
    (e: React.MouseEvent, artifact: Artifact | null, folderPath: string | null) => {
      e.preventDefault();
      setContextMenu({
        visible: true,
        x: e.clientX,
        y: e.clientY,
        artifact,
        folderPath,
      });
    },
    []
  );

  const handleRenameArtifact = useCallback(
    async (artifact: Artifact) => {
      const next = window.prompt(tx('renamePrompt'), artifact.filename);
      if (!next || next === artifact.filename) return;
      try {
        await storageService.runFileManagerBatch({
          action: 'patch_metadata',
          artifact_ids: [artifact.id],
          metadata_patch: { original_filename: next },
        });
        toast.success(tx('renameSuccess'));
      } catch {
        toast.error(tx('renameFailed'));
      }
    },
    [tx]
  );

  // ── Prune stale selected IDs whenever the page changes ───────────────────
  // Prevents bulk-action UI from showing counts for items no longer in view
  // and avoids the React "setState during render" warning when the parent
  // refreshes the artifact list.
  useEffect(() => {
    setSelected((prev) => {
      if (prev.size === 0) return prev;
      const validIds = new Set(artifacts.map((a) => a.id));
      let mutated = false;
      const next = new Set<string>();
      prev.forEach((id) => {
        if (validIds.has(id)) next.add(id);
        else mutated = true;
      });
      return mutated ? next : prev;
    });
  }, [artifacts]);

  // ── Sort toggle ───────────────────────────────────────────────────────────
  const handleSort = useCallback(
    (field: SortField) => {
      if (sortBy === field) {
        onSortChange(field, sortDir === 'asc' ? 'desc' : 'asc');
      } else {
        onSortChange(field, 'asc');
      }
    },
    [sortBy, sortDir, onSortChange]
  );

  // ── Selection ─────────────────────────────────────────────────────────────
  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const toggleFolderSelect = (path: string) => {
    setSelectedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === sorted.length) setSelected(new Set());
    else setSelected(new Set(sorted.map((a) => a.id)));
  };

  const selectedArtifactIdsForActions = useMemo(() => {
    const ids = new Set<string>(selected);
    if (selectedFolders.size > 0) {
      artifacts.forEach((artifact) => {
        const path = artifact.folder_path || '';
        for (const folderPath of selectedFolders) {
          if (path === folderPath || path.startsWith(`${folderPath}/`)) {
            ids.add(artifact.id);
            break;
          }
        }
      });
    }
    return Array.from(ids);
  }, [artifacts, selected, selectedFolders]);

  useEffect(() => {
    onArtifactSelectionChange?.(selectedArtifactIdsForActions);
  }, [selectedArtifactIdsForActions, onArtifactSelectionChange]);
  const totalSelectedCount = selected.size + selectedFolders.size;

  // ── Bulk Delete ───────────────────────────────────────────────────────────
  const handleBulkDelete = useCallback(async () => {
    const ids = selectedArtifactIdsForActions;
    // v0.44.0 — ask for confirmation before destructive bulk action.
    if (onConfirmBulkDelete) {
      const ok = await onConfirmBulkDelete(ids.length);
      if (!ok) {
        console.info('[FileTable] Bulk delete cancelled by user');
        return;
      }
    }
    console.info('[FileTable] Bulk deleting artifacts:', { count: ids.length });
    setDeletingIds(new Set(ids));
    const failed: string[] = [];
    try {
      await storageService.deleteArtifactsViaBatch(ids);
    } catch {
      failed.push(...ids);
    }
    setDeletingIds(new Set());
    const deletedIds = ids.filter((id) => !failed.includes(id));
    if (deletedIds.length) {
      toast.success(`${deletedIds.length} ${tx('filesDeleted')}`);
      onArtifactsDeleted(deletedIds);
      setSelected(new Set());
      setSelectedFolders(new Set());
    }
    if (failed.length) {
      toast.error(`${tx('deleteFailedFor')} ${failed.length} ${tx('files')}`);
    }
  }, [selectedArtifactIdsForActions, onConfirmBulkDelete, onArtifactsDeleted, tx]);

  useEffect(() => {
    const root = tableRootRef.current;
    if (!root) return;
    const onKey = (e: KeyboardEvent) => {
      if (sorted.length === 0) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setFocusedIndex((i) => Math.min(sorted.length - 1, i + 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setFocusedIndex((i) => Math.max(0, i - 1));
      } else if (e.key === 'Enter' && sorted[focusedIndex]) {
        e.preventDefault();
        onPreviewArtifact?.(sorted[focusedIndex]);
      } else if (e.key === ' ' && sorted[focusedIndex]) {
        e.preventDefault();
        onPreviewArtifact?.(sorted[focusedIndex]);
      } else if (e.key === 'Delete' && selected.size > 0) {
        e.preventDefault();
        void handleBulkDelete();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        setSelected(new Set(sorted.map((a) => a.id)));
      }
    };
    root.addEventListener('keydown', onKey);
    return () => root.removeEventListener('keydown', onKey);
  }, [sorted, focusedIndex, onPreviewArtifact, selected.size, handleBulkDelete]);

  // ── Bulk Download ─────────────────────────────────────────────────────────
  const handleBulkDownload = async () => {
    const ids = selectedArtifactIdsForActions;
    console.info('[FileTable] Bulk downloading:', { count: ids.length, selectedFolders: selectedFolders.size });
    if (ids.length === 0) return;
    if (selectedFolders.size === 0 && ids.length <= 1) {
      try {
        for (const id of ids) {
          const artifact = artifacts.find((a) => a.id === id);
          await storageService.downloadArtifact(id, artifact?.filename);
        }
      } catch (error) {
        console.error('[FileTable] Download failed:', error);
        toast.error(tx('downloadFailed'));
      }
      return;
    }
    try {
      const zip = new JSZip();
      const usedNames = new Set<string>();
      for (const id of ids) {
        const artifact = artifacts.find((a) => a.id === id);
        if (!artifact) continue;
        let blob: Blob;
        try {
          blob = await storageService.fetchArtifactBlob(id, 'attachment');
        } catch {
          continue;
        }
        let baseName = artifact.folder_path
          ? `${artifact.folder_path}/${artifact.filename}`
          : artifact.filename;
        if (usedNames.has(baseName)) {
          const dot = baseName.lastIndexOf('.');
          const ext = dot > 0 ? baseName.slice(dot) : '';
          const core = dot > 0 ? baseName.slice(0, dot) : baseName;
          let i = 2;
          while (usedNames.has(`${core} (${i})${ext}`)) i += 1;
          baseName = `${core} (${i})${ext}`;
        }
        usedNames.add(baseName);
        zip.file(baseName, blob);
      }
      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'selected-items.zip';
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('[FileTable] Bulk zip download failed:', error);
      toast.error(tx('downloadFailed'));
    }
  };

  // ── Sort header helper ────────────────────────────────────────────────────
  const SortHeader = ({
    field,
    label,
  }: {
    field: SortField;
    label: string;
  }) => {
    const isActive = sortBy === field;
    const isAsc = isActive && sortDir === 'asc';
    const isDesc = isActive && sortDir === 'desc';

    return (
      <button
        onClick={() => handleSort(field)}
        className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
      >
        {label}
        {isAsc ? (
          <PiCaretUpBold className="h-3 w-3 text-primary" />
        ) : isDesc ? (
          <PiCaretDownBold className="h-3 w-3 text-primary" />
        ) : (
          <PiCaretUpDownBold className="h-3 w-3 text-gray-300 dark:text-gray-600" />
        )}
      </button>
    );
  };

  // ── Pagination derived values ─────────────────────────────────────────────
  const hasAnyData = totalCount > 0;
  const hasMultiplePages = totalPages > 1;
  const pageStart = hasAnyData ? (page - 1) * pageSize + 1 : 0;
  const pageEnd = hasAnyData ? Math.min(page * pageSize, totalCount) : 0;
  const applyPageJump = useCallback(() => {
    const parsed = Number(pageJumpDraft);
    if (!Number.isFinite(parsed)) {
      setPageJumpDraft(String(page));
      return;
    }
    const clamped = Math.min(Math.max(Math.floor(parsed), 1), totalPages);
    onPageChange(clamped);
    setPageJumpDraft(String(clamped));
  }, [onPageChange, page, pageJumpDraft, totalPages]);

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div ref={tableRootRef} className={cn('flex h-full min-h-0 flex-col gap-2.5', className)}>
      {/* ══════════════════ Card 1 — Toolbar (filter + search + sort) ══════════════════ */}
      <div className="shrink-0 rounded-lg border border-muted bg-gray-0 dark:bg-gray-50 px-3 py-2.5 shadow-sm space-y-2.5">
        {/* Row A — Breadcrumb (only when navigating real folders) */}
        {!currentPath.startsWith('__') && (
          <BreadcrumbNav path={currentPath} onNavigate={onNavigatePath} />
        )}

        {/* Row B — One-line adaptive toolbar (type + search + sort) */}
        <div className={cn('flex min-w-0 items-center gap-2', isCompactPanel && 'flex-wrap')}>
          {!searchExpanded && !isCompactPanel && (
            <div className="min-w-0 flex-1">
              <TypeFilterChips
                activeType={activeType}
                onTypeChange={setActiveType}
                allArtifacts={pathFiltered}
                visibleArtifacts={sorted}
                serverTotals={totalsByType}
              />
            </div>
          )}

          <div
            ref={searchAreaRef}
            className={cn(
              'ml-auto flex items-center justify-end gap-1',
              isCompactPanel && 'order-2 ml-0 w-full justify-end'
            )}
          >
            <div
              className={cn(
                'relative overflow-hidden transition-all duration-200 ease-out',
                searchExpanded
                  ? isCompactPanel
                    ? 'w-full opacity-100'
                    : 'w-[17rem] sm:w-[20rem] xl:w-[24rem] opacity-100'
                  : 'w-0 opacity-0'
              )}
            >
              <div className="relative flex items-center gap-1">
                <div ref={typeMenuRef} className="relative shrink-0">
                  <Tooltip content={tx('filterByType')} size="sm">
                    <ActionIcon
                      size="sm"
                      variant={typeMenuOpen || activeType !== 'all' ? 'solid' : 'outline'}
                      onClick={() => setTypeMenuOpen((prev) => !prev)}
                      aria-label={tx('filterByType')}
                      className="h-8 w-8"
                    >
                      <PiFunnelBold className="h-4 w-4" />
                    </ActionIcon>
                  </Tooltip>
                  {typeMenuOpen && (
                    <div className="absolute left-0 top-10 z-20 w-[min(92vw,34rem)] rounded-lg border border-muted bg-gray-0 p-2 shadow-lg dark:bg-gray-50">
                      <TypeFilterChips
                        activeType={activeType}
                        onTypeChange={(type) => {
                          setActiveType(type);
                          setTypeMenuOpen(false);
                        }}
                        allArtifacts={pathFiltered}
                        visibleArtifacts={sorted}
                        serverTotals={totalsByType}
                      />
                    </div>
                  )}
                </div>
                <Input
                  ref={searchInputRef}
                  placeholder={tx('searchPlaceholder')}
                  value={searchDraft}
                  onChange={(e) => setSearchDraft(e.target.value)}
                  onFocus={() => setSearchFocused(true)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      e.preventDefault();
                      setSearchDraft('');
                      onSearchChange('');
                      setSearchFocused(false);
                      searchInputRef.current?.blur();
                    }
                  }}
                  className="pr-7 text-sm"
                />
                {searchExpanded && searchDraft.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchDraft('');
                      onSearchChange('');
                      setSearchFocused(false);
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-100"
                    aria-label={tx('clear')}
                  >
                    <PiXBold className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>
            <ActionIcon
              size="sm"
              variant={searchExpanded ? 'solid' : 'outline'}
              onClick={() => {
                setSearchFocused(true);
                requestAnimationFrame(() => searchInputRef.current?.focus());
              }}
              aria-label={tx('search')}
              className="h-8 w-8"
            >
              <PiMagnifyingGlassBold className="h-4 w-4" />
            </ActionIcon>
            <select
              value={sortBy}
              onChange={(e) => onSortChange(e.target.value as SortField, sortDir)}
              className={cn(
                'h-8 min-w-[8.5rem] rounded border border-muted bg-gray-0 px-2 text-xs dark:bg-gray-100',
                isCompactPanel && 'min-w-[7rem]'
              )}
              aria-label={tx('sortField')}
            >
              <option value="created_at">{tx('sortFields.createdAt')}</option>
              <option value="name">{tx('sortFields.name')}</option>
              <option value="size">{tx('sortFields.size')}</option>
              <option value="mime_type">{tx('sortFields.mimeType')}</option>
              <option value="media_type">{tx('sortFields.mediaType')}</option>
            </select>
            <Tooltip
              content={`${tx('sortBy')}: ${sortBy} (${sortDir === 'asc' ? tx('sortAsc') : tx('sortDesc')})`}
              size="sm"
            >
              <ActionIcon
                size="sm"
                variant="outline"
                onClick={() =>
                  onSortChange(sortBy, sortDir === 'asc' ? 'desc' : 'asc')
                }
                aria-label={tx('changeSortDirection')}
                className="h-8 w-8"
              >
                {sortDir === 'asc' ? (
                  <PiSortAscendingBold className="h-4 w-4" />
                ) : (
                  <PiSortDescendingBold className="h-4 w-4" />
                )}
              </ActionIcon>
            </Tooltip>
          </div>
          <div className={cn(isCompactPanel ? 'order-1' : 'hidden')}>
            <Tooltip content={tx('filtersAndSort')} size="sm">
              <ActionIcon
                size="sm"
                variant="outline"
                onClick={() => setMobileFiltersOpen((prev) => !prev)}
                aria-label={tx('filtersAndSort')}
              >
                <PiSlidersHorizontalBold className="h-4 w-4" />
              </ActionIcon>
            </Tooltip>
          </div>
        </div>

        {isCompactPanel && !searchExpanded && !mobileFiltersOpen && (
          <div className="min-w-0 overflow-x-auto pb-1">
            <TypeFilterChips
              activeType={activeType}
              onTypeChange={setActiveType}
              allArtifacts={pathFiltered}
              visibleArtifacts={sorted}
              serverTotals={totalsByType}
            />
          </div>
        )}

        {mobileFiltersOpen && (
          <div className="rounded-md border border-muted bg-gray-0 p-2 dark:bg-gray-50 space-y-2">
            <TypeFilterChips
              activeType={activeType}
              onTypeChange={setActiveType}
              allArtifacts={pathFiltered}
              visibleArtifacts={sorted}
              serverTotals={totalsByType}
            />
            <div className="flex items-center gap-2">
              <select
                value={sortBy}
                onChange={(e) => onSortChange(e.target.value as SortField, sortDir)}
                className="h-8 min-w-0 flex-1 rounded border border-muted bg-gray-0 px-2 text-xs dark:bg-gray-100"
                aria-label={tx('sortField')}
              >
                <option value="created_at">{tx('sortFields.createdAt')}</option>
                <option value="name">{tx('sortFields.name')}</option>
                <option value="size">{tx('sortFields.size')}</option>
                <option value="mime_type">{tx('sortFields.mimeType')}</option>
                <option value="media_type">{tx('sortFields.mediaType')}</option>
              </select>
              <ActionIcon
                size="sm"
                variant="outline"
                onClick={() =>
                  onSortChange(sortBy, sortDir === 'asc' ? 'desc' : 'asc')
                }
                aria-label={tx('changeSortDirection')}
              >
                {sortDir === 'asc' ? (
                  <PiSortAscendingBold className="h-4 w-4" />
                ) : (
                  <PiSortDescendingBold className="h-4 w-4" />
                )}
              </ActionIcon>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 pt-1">
          {onToggleAdvancedFilters && (
            <Button size="sm" variant="outline" onClick={onToggleAdvancedFilters}>
              {tx('advancedFilters')}
            </Button>
          )}
          {FILE_EXPLORER_FACE_SEARCH_ENABLED ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => toast(tx('faceSearchHint'), { icon: 'ℹ️' })}
            >
              {tx('faceSearch')}
            </Button>
          ) : null}
          {view === 'grid' && (
            <>
              <select
                value={String(thumbnailScale)}
                onChange={(e) => setThumbnailScale(Number(e.target.value))}
                className="h-8 rounded border border-muted bg-gray-0 px-2 text-xs dark:bg-gray-100"
                aria-label={tx('thumbnailSize')}
              >
                <option value="0.85">S</option>
                <option value="1">M</option>
                <option value="1.15">L</option>
              </select>
              <select
                value={density}
                onChange={(e) => setDensity(e.target.value as 'compact' | 'comfortable')}
                className="h-8 rounded border border-muted bg-gray-0 px-2 text-xs dark:bg-gray-100"
                aria-label={tx('density')}
              >
                <option value="comfortable">{tx('densityComfortable')}</option>
                <option value="compact">{tx('densityCompact')}</option>
              </select>
            </>
          )}
          <select
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value as 'none' | 'type' | 'date')}
            className="h-8 rounded border border-muted bg-gray-0 px-2 text-xs dark:bg-gray-100"
            aria-label={tx('groupBy')}
          >
            <option value="none">{tx('groupByNone')}</option>
            <option value="type">{tx('groupByType')}</option>
            <option value="date">{tx('groupByDate')}</option>
          </select>
        </div>

        {showAdvancedFilters && onAdvancedFiltersApply && onAdvancedFiltersReset && (
          <FileExplorerAdvancedFilters
            open={showAdvancedFilters}
            values={advancedFilters}
            labels={{
              title: tx('advancedFilters'),
              tags: tx('filterTags'),
              tagsPlaceholder: tx('filterTagsPlaceholder'),
              uploadedBy: tx('filterUploadedBy'),
              uploadedByPlaceholder: tx('filterUploadedByPlaceholder'),
              dateFrom: tx('filterDateFrom'),
              dateTo: tx('filterDateTo'),
              sizeMin: tx('filterSizeMin'),
              sizeMax: tx('filterSizeMax'),
              apply: tx('applyFilters'),
              reset: tx('resetFilters'),
            }}
            onApply={onAdvancedFiltersApply}
            onReset={onAdvancedFiltersReset}
            onClose={() => onToggleAdvancedFilters?.()}
          />
        )}
      </div>

      {/* ══════════════════ Compact bulk actions bar (icon + count) ══════════════════ */}
      {totalSelectedCount > 0 && (
        <div className="shrink-0 flex items-center gap-2 rounded-lg border border-orange-200 bg-orange-50 px-3 py-1.5 dark:border-orange-800 dark:bg-orange-950/30">
          <span className="inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-full bg-orange-500 px-2 text-xs font-semibold text-white">
            {totalSelectedCount}
          </span>
          <Text className="text-xs text-orange-700 dark:text-orange-400">
            {tx('selected')}
          </Text>
          <div className="ml-auto flex items-center gap-1">
            <Tooltip content={tx('bulkDownload')} size="sm">
              <ActionIcon
                size="sm"
                variant="text"
                onClick={handleBulkDownload}
                className="text-orange-700 hover:bg-orange-100 dark:text-orange-300"
                aria-label={tx('bulkDownload')}
              >
                <PiDownloadSimpleBold className="h-4 w-4" />
              </ActionIcon>
            </Tooltip>
            <Tooltip content={tx('addTags')} size="sm">
              <ActionIcon
                size="sm"
                variant="text"
                aria-label={tx('addTags')}
                className="text-orange-700"
                onClick={async () => {
                  const raw = window.prompt(tx('filterTagsPlaceholder'));
                  if (!raw?.trim()) return;
                  const tags = raw.split(',').map((t) => t.trim()).filter(Boolean);
                  try {
                    await storageService.runFileManagerBatch({
                      action: 'add_tags',
                      artifact_ids: selectedArtifactIdsForActions,
                      tags,
                    });
                    toast.success(tx('tagsApplied'));
                  } catch {
                    toast.error(tx('deleteFailedFor'));
                  }
                }}
              >
                <PiFunnelBold className="h-4 w-4" />
              </ActionIcon>
            </Tooltip>
            <Tooltip content={tx('moveToFolder')} size="sm">
              <ActionIcon
                size="sm"
                variant="text"
                aria-label={tx('moveToFolder')}
                className="text-orange-700"
                onClick={async () => {
                  const folderId = window.prompt(tx('moveToFolder'));
                  if (!folderId?.trim()) return;
                  try {
                    await storageService.runFileManagerBatch({
                      action: 'set_folder',
                      artifact_ids: selectedArtifactIdsForActions,
                      folder_id: folderId.trim(),
                    });
                    toast.success(tx('tagsApplied'));
                  } catch {
                    toast.error(tx('deleteFailedFor'));
                  }
                }}
              >
                <PiArrowRightBold className="h-4 w-4" />
              </ActionIcon>
            </Tooltip>
            <Tooltip content={tx('bulkDelete')} size="sm">
              <ActionIcon
                size="sm"
                variant="text"
                onClick={handleBulkDelete}
                isLoading={deletingIds.size > 0}
                className="text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
                aria-label={tx('bulkDelete')}
              >
                <PiTrashBold className="h-4 w-4" />
              </ActionIcon>
            </Tooltip>
            <Tooltip content={tx('clearSelection')} size="sm">
              <ActionIcon
                size="sm"
                variant="text"
                onClick={() => {
                  setSelected(new Set());
                  setSelectedFolders(new Set());
                }}
                aria-label={tx('clearSelection')}
              >
                <PiXBold className="h-4 w-4" />
              </ActionIcon>
            </Tooltip>
          </div>
        </div>
      )}

      {/* ══════════════════ Card 2 — Table ══════════════════ */}
      <div
        ref={(el) => setScrollRoot(el)}
        tabIndex={0}
        onScroll={(e) => setListScrollTop((e.target as HTMLElement).scrollTop)}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragOver(false);
          const files = Array.from(e.dataTransfer.files ?? []);
          if (files.length) onRequestUpload?.(files);
        }}
        className={cn(
          'relative min-h-0 flex-1 overflow-auto rounded-lg border border-muted bg-gray-0 dark:bg-gray-50 shadow-sm outline-none',
          isDragOver && 'ring-2 ring-primary/40'
        )}
      >
        {isDragOver && (
          <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-primary/10 text-sm font-medium text-primary">
            {tx('dropToUpload')}
          </div>
        )}
        {loading ? (
          // Loading skeleton
          <div className="space-y-2 p-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="h-12 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-100"
              />
            ))}
          </div>
        ) : sorted.length === 0 && virtualFolders.length === 0 ? (
          // Empty state
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <PiFileBold className="mb-3 h-12 w-12 text-gray-200 dark:text-gray-700" />
            <Text className="text-sm font-medium text-gray-500">
              {search ? tx('noResults') : tx('emptyFolder')}
            </Text>
            {!search && listEmptyHint ? (
              <Text className="mt-2 max-w-md text-xs text-gray-400">{listEmptyHint}</Text>
            ) : null}
            {search && (
              <button
                onClick={() => onSearchChange('')}
                className="mt-2 text-xs text-primary hover:underline"
              >
                {tx('clearSearch')}
              </button>
            )}
          </div>
        ) : view === 'grid' ? (
          /* ── Grid body (v0.45.0) — density affects gap/padding ───── */
          <div
            className={cn(
              'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6',
              density === 'compact' ? 'gap-2 p-2' : 'gap-3 p-4'
            )}
          >
            {/* Folder cards */}
            {virtualFolders.map((folder) => {
              const isFolderSelected = selectedFolders.has(folder.path);
              return (
              <div
                key={folder.path}
                className={cn(
                  'group relative flex flex-col rounded-lg border border-muted bg-gray-0 transition-all hover:border-primary/40 hover:shadow-md dark:bg-gray-50',
                  isFolderSelected && 'border-orange-300 ring-1 ring-orange-200'
                )}
              >
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleFolderSelect(folder.path);
                  }}
                  className={cn(
                    'absolute left-1.5 top-1.5 z-10 rounded bg-gray-0/90 p-0.5 text-gray-400 backdrop-blur transition-opacity dark:bg-gray-50/90',
                    isFolderSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100'
                  )}
                  aria-label={isFolderSelected ? tx('unselect') : tx('select')}
                >
                  {isFolderSelected ? (
                    <PiCheckSquareBold className="h-4 w-4 text-primary" />
                  ) : (
                    <PiSquareBold className="h-4 w-4" />
                  )}
                </button>
                <button
                  type="button"
                  onDoubleClick={() => onNavigatePath(folder.path)}
                  onClick={() => onNavigatePath(folder.path)}
                  className="flex h-28 items-center justify-center overflow-hidden rounded-t-lg bg-gray-100 dark:bg-gray-100"
                  aria-label={tx('openFolder')}
                >
                  <FolderIcon className="h-12 w-12 transition-transform group-hover:scale-110" />
                </button>
                <button
                  type="button"
                  onDoubleClick={() => onNavigatePath(folder.path)}
                  onClick={() => onNavigatePath(folder.path)}
                  className="flex flex-col gap-1 p-2 text-left"
                >
                  <span
                    className="line-clamp-1 w-full text-xs font-medium text-gray-800 dark:text-gray-200"
                    title={folder.name}
                  >
                    {folder.name}
                  </span>
                  <span className="text-[10px] text-gray-500">
                    {folder.childCount} {tx('items')}
                  </span>
                </button>
              </div>
            )})}

            {/* File cards */}
            {visibleArtifacts.map((artifact, vi) => {
              const rowIndex = virtualListWindow.start + vi;
              const isSelected = selected.has(artifact.id);
              const isActive = selectedArtifactId === artifact.id;

              return (
                <div
                  key={artifact.id}
                  onClick={() => onSelectArtifact(artifact)}
                  onDoubleClick={() => onPreviewArtifact?.(artifact)}
                  onContextMenu={(e) => openContextMenu(e, artifact, null)}
                  className={cn(
                    'group relative flex cursor-pointer flex-col rounded-lg border bg-gray-0 transition-all hover:shadow-md dark:bg-gray-50',
                    isActive
                      ? 'border-primary ring-1 ring-primary/30'
                      : isSelected
                      ? 'border-orange-300'
                      : 'border-muted hover:border-primary/40'
                  )}
                >
                  {/* Selection checkbox (top-left, visible on hover or when selected) */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleSelect(artifact.id);
                    }}
                    className={cn(
                      'absolute left-1.5 top-1.5 z-10 rounded bg-gray-0/90 p-0.5 backdrop-blur transition-opacity dark:bg-gray-50/90',
                      isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                    )}
                    aria-label={isSelected ? tx('unselect') : tx('select')}
                  >
                    {isSelected ? (
                      <PiCheckSquareBold className="h-4 w-4 text-primary" />
                    ) : (
                      <PiSquareBold className="h-4 w-4 text-gray-400" />
                    )}
                  </button>

                  {/* Access badge (top-right) */}
                  <div className="absolute right-1.5 top-1.5 z-10">
                    <AccessBadge artifact={artifact} />
                  </div>

                  {/* Thumbnail / icon — object-contain shows full image without cropping */}
                  <div
                    className="relative flex items-center justify-center overflow-hidden rounded-t-lg bg-gray-100 p-1.5 dark:bg-gray-100"
                    style={{ height: `${Math.round(112 * thumbnailScale)}px` }}
                  >
                    <GridFileThumbnail artifact={artifact} scrollRoot={scrollRoot} />
                    {/* Hover preview button */}
                    {onPreviewArtifact && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onPreviewArtifact(artifact);
                        }}
                        className="absolute inset-0 flex items-center justify-center bg-gray-900/40 opacity-0 transition-opacity hover:opacity-100"
                        aria-label={tx('preview')}
                      >
                        <span className="rounded-full bg-white/95 px-3 py-1 text-xs font-medium text-gray-800 shadow-md">
                          {tx('preview')}
                        </span>
                      </button>
                    )}
                  </div>

                  {/* Meta */}
                  <div className="flex flex-col gap-1 p-2">
                    <span
                      className="line-clamp-1 text-xs font-medium text-gray-800 dark:text-gray-200"
                      title={artifact.filename}
                    >
                      {artifact.filename}
                    </span>
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={cn(
                          'rounded px-1.5 py-0.5 text-[9px] font-medium',
                          getMimeBadgeColor(artifact.mime_type)
                        )}
                      >
                        {getMimeLabel(artifact.mime_type)}
                      </span>
                      <span className="text-[10px] text-gray-500">
                        {formatSize(artifact.file_size)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <table className="w-full">
            {/* Table head */}
            <thead className="sticky top-0 z-10 bg-gray-50 dark:bg-gray-100">
              <tr className="border-b border-muted">
                <th className="w-10 px-4 py-2.5 text-left">
                  <button onClick={toggleAll} className="text-gray-400 hover:text-gray-600">
                    {selected.size === sorted.length && sorted.length > 0 ? (
                      <PiCheckSquareBold className="h-4 w-4 text-primary" />
                    ) : (
                      <PiSquareBold className="h-4 w-4" />
                    )}
                  </button>
                </th>
                <th className="px-3 py-2.5 text-left">
                  <SortHeader field="name" label={tx('tableColumns.name')} />
                </th>
                <th className="px-3 py-2.5 text-left">
                  <SortHeader field="mime_type" label={tx('tableColumns.type')} />
                </th>
                <th className="hidden px-3 py-2.5 text-left lg:table-cell">
                  <SortHeader field="size" label={tx('tableColumns.size')} />
                </th>
                <th className="hidden px-3 py-2.5 text-left xl:table-cell">
                  <SortHeader field="created_at" label={tx('tableColumns.date')} />
                </th>
                <th className="hidden px-3 py-2.5 text-left xl:table-cell">
                  <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                    {tx('tableColumns.status')}
                  </span>
                </th>
                <th className="w-20 px-3 py-2.5" />
              </tr>
            </thead>

            <tbody className="divide-y divide-muted/50">
              {/* Virtual folder rows */}
              {virtualFolders.map((folder) => (
                <tr
                  key={folder.path}
                  onDoubleClick={() => onNavigatePath(folder.path)}
                  className="cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-100/70 group"
                >
                  <td className="px-4 py-2 text-center">
                    <FolderIcon className="h-4 w-4" />
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2.5">
                      <FolderIcon className="h-6 w-6 shrink-0" />
                      <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
                        {folder.name}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <span className="text-xs text-gray-400">{tx('folder')}</span>
                  </td>
                  <td className="hidden px-3 py-2 lg:table-cell">
                    <span className="text-xs text-gray-400">
                      {folder.childCount} {tx('items')}
                    </span>
                  </td>
                  <td className="hidden px-3 py-2 xl:table-cell" />
                  <td className="hidden px-3 py-2 xl:table-cell" />
                  <td className="px-3 py-2 text-center">
                    <Tooltip content={tx('openFolder')} size="sm">
                      <ActionIcon
                        size="sm"
                        variant="text"
                        onClick={() => onNavigatePath(folder.path)}
                        aria-label={tx('openFolder')}
                      >
                        <PiArrowRightBold className="h-4 w-4" />
                      </ActionIcon>
                    </Tooltip>
                  </td>
                </tr>
              ))}

              {view === 'list' && virtualListWindow.paddingTop > 0 && (
                <tr aria-hidden style={{ height: virtualListWindow.paddingTop }}>
                  <td colSpan={7} />
                </tr>
              )}
              {/* File rows (virtualized in list view) */}
              {visibleArtifacts.map((artifact, vi) => {
                const rowIndex = virtualListWindow.start + vi;
                const iconNode = getFileIcon(artifact.mime_type, 'h-4 w-4');
                const isSelected = selected.has(artifact.id);
                const isActive = selectedArtifactId === artifact.id;

                return (
                  <tr
                    key={artifact.id}
                    onClick={() => onSelectArtifact(artifact)}
                    onDoubleClick={() => onPreviewArtifact?.(artifact)}
                    onContextMenu={(e) => openContextMenu(e, artifact, null)}
                    className={cn(
                      'cursor-pointer transition-colors group border-b border-muted/50',
                      isActive
                        ? 'bg-primary/5 dark:bg-primary/10'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-100/70',
                      isSelected && 'bg-orange-50/60 dark:bg-orange-950/20',
                      focusedIndex === rowIndex && 'ring-1 ring-inset ring-primary/30'
                    )}
                  >
                    {/* Checkbox */}
                    <td
                      className="w-10 px-4 py-2"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSelect(artifact.id);
                      }}
                    >
                      {isSelected ? (
                        <PiCheckSquareBold className="h-4 w-4 text-primary" />
                      ) : (
                        <PiSquareBold className="h-4 w-4 text-gray-300 hover:text-gray-500" />
                      )}
                    </td>

                    {/* Name */}
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-100">
                          {iconNode}
                        </div>
                        <span
                          className="max-w-[200px] truncate text-sm font-medium text-gray-800 dark:text-gray-200"
                          title={artifact.filename}
                        >
                          {artifact.filename}
                        </span>
                        <AccessBadge artifact={artifact} />
                      </div>
                    </td>

                    {/* MIME badge */}
                    <td className="px-3 py-2">
                      <span
                        className={cn(
                          'rounded-md px-2 py-0.5 text-xs font-medium',
                          getMimeBadgeColor(artifact.mime_type)
                        )}
                      >
                        {getMimeLabel(artifact.mime_type)}
                      </span>
                    </td>

                    {/* Size */}
                    <td className="hidden px-3 py-2 lg:table-cell">
                      <span className="text-xs text-gray-500">
                        {formatSize(artifact.file_size)}
                      </span>
                    </td>

                    {/* Date */}
                    <td className="hidden px-3 py-2 xl:table-cell">
                      <span className="text-xs text-gray-500">
                        {dayjs(artifact.created_at).format('YYYY-MM-DD')}
                      </span>
                    </td>

                    {/* Processing */}
                    <td className="hidden px-3 py-2 xl:table-cell">
                      <ProcessingBadges status={artifact.processing_status} />
                    </td>

                    {/* Quick actions: Preview + Download */}
                    <td
                      className="px-3 py-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-end gap-0.5 opacity-60 transition-opacity group-hover:opacity-100">
                        {onPreviewArtifact && (
                          <Tooltip content={tx('preview')} size="sm">
                            <ActionIcon
                              size="sm"
                              variant="text"
                              aria-label={tx('preview')}
                              className="text-gray-500 hover:text-primary"
                              onClick={() => onPreviewArtifact(artifact)}
                            >
                              <PiMagnifyingGlassPlusBold className="h-4 w-4" />
                            </ActionIcon>
                          </Tooltip>
                        )}
                        <Tooltip content={tx('download')} size="sm">
                          <ActionIcon
                            size="sm"
                            variant="text"
                            aria-label={tx('download')}
                            className="text-gray-500 hover:text-gray-800"
                            onClick={() => {
                              void storageService
                                .downloadArtifact(artifact.id, artifact.filename)
                                .catch((error) => {
                                  console.error('[FileTable] Download failed:', error);
                                  toast.error(tx('downloadFailed'));
                                });
                            }}
                          >
                            <PiDownloadSimpleBold className="h-4 w-4" />
                          </ActionIcon>
                        </Tooltip>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {view === 'list' && virtualListWindow.paddingBottom > 0 && (
                <tr aria-hidden style={{ height: virtualListWindow.paddingBottom }}>
                  <td colSpan={7} />
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* ══════════════════ Card 3 — Pagination footer ══════════════════ */}
      <div
        className={cn(
          'shrink-0 rounded-lg border border-muted bg-gray-0 dark:bg-gray-50 px-3 py-2 shadow-sm',
          isCompactPanel
            ? 'flex flex-col gap-2'
            : 'flex items-center justify-between gap-3'
        )}
      >
        <div className="min-w-0">
          <Text className="truncate text-xs text-gray-500">
            {hasAnyData
              ? `${tx('showing')} ${pageStart}-${pageEnd} ${tx('of')} ${totalCount} ${tx('files')}`
              : tx('noFilesToShow')}
            {virtualFolders.length > 0 && ` · ${virtualFolders.length} ${tx('folders')}`}
          </Text>
        </div>

        <div className={cn('flex flex-wrap items-center gap-1.5', !isCompactPanel && 'justify-end')}>
          {/* Page-size selector */}
          <label className="flex h-8 items-center gap-1.5 text-xs text-gray-500">
            {tx('rows')}
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="h-8 min-w-[5.25rem] rounded border border-muted bg-gray-0 px-2 text-xs dark:bg-gray-100"
              aria-label={tx('rowsPerPage')}
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </label>

          {/* Prev / Next */}
          {hasMultiplePages && (
            <>
              <span className="inline-flex h-7 items-center rounded border border-muted px-2 text-[11px] text-gray-500">
                {page} / {totalPages}
              </span>
              <Tooltip content={tx('firstPage')} size="sm">
                <ActionIcon
                  size="sm"
                  variant="outline"
                  disabled={page <= 1 || loading}
                  onClick={() => onPageChange(1)}
                  className="h-7 w-7"
                  aria-label={tx('firstPage')}
                >
                  <PiCaretDoubleLeftBold className="h-3.5 w-3.5" />
                </ActionIcon>
              </Tooltip>
              <Tooltip content={tx('previousPage')} size="sm">
                <ActionIcon
                  size="sm"
                  variant="outline"
                  disabled={page <= 1 || loading}
                  onClick={() => onPageChange(page - 1)}
                  className="h-7 w-7"
                  aria-label={tx('previousPage')}
                >
                  <PiCaretLeftBold className="h-3.5 w-3.5" />
                </ActionIcon>
              </Tooltip>
              <Tooltip content={tx('nextPage')} size="sm">
                <ActionIcon
                  size="sm"
                  variant="outline"
                  disabled={page >= totalPages || loading}
                  onClick={() => onPageChange(page + 1)}
                  className="h-7 w-7"
                  aria-label={tx('nextPage')}
                >
                  <PiCaretRightBold className="h-3.5 w-3.5" />
                </ActionIcon>
              </Tooltip>
              <Tooltip content={tx('lastPage')} size="sm">
                <ActionIcon
                  size="sm"
                  variant="outline"
                  disabled={page >= totalPages || loading}
                  onClick={() => onPageChange(totalPages)}
                  className="h-7 w-7"
                  aria-label={tx('lastPage')}
                >
                  <PiCaretDoubleRightBold className="h-3.5 w-3.5" />
                </ActionIcon>
              </Tooltip>
              <label className="flex h-8 items-center gap-1 text-xs text-gray-500">
                {tx('page')}
                <input
                  type="number"
                  min={1}
                  max={totalPages}
                  value={pageJumpDraft}
                  onChange={(e) => {
                    setPageJumpDraft(e.target.value);
                  }}
                  onBlur={applyPageJump}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      applyPageJump();
                    }
                  }}
                  className="h-8 w-16 rounded border border-muted bg-gray-0 px-1.5 text-center text-xs dark:bg-gray-100"
                  aria-label={tx('pageNumber')}
                />
              </label>
              <Button
                size="sm"
                variant="outline"
                className="h-8 px-2 text-[11px]"
                onClick={applyPageJump}
              >
                {tx('go')}
              </Button>
            </>
          )}
        </div>
      </div>

      <FileExplorerContextMenu
        state={contextMenu}
        labels={{
          preview: tx('contextMenu.preview'),
          download: tx('contextMenu.download'),
          share: tx('contextMenu.share'),
          details: tx('contextMenu.details'),
          delete: tx('contextMenu.delete'),
          rename: tx('contextMenu.rename'),
          openFolder: tx('contextMenu.openFolder'),
        }}
        onClose={() => setContextMenu((s) => ({ ...s, visible: false }))}
        onPreview={onPreviewArtifact}
        onDownload={(a) => {
          void storageService
            .downloadArtifact(a.id, a.filename)
            .catch((error) => {
              console.error('[FileTable] Download failed:', error);
              toast.error(tx('downloadFailed'));
            });
        }}
        onShare={async (a) => {
          try {
            const data = await storageService.createShareToken(a.id);
            if (!data.token) throw new Error('no token');
            const url = `${window.location.origin}${storageService.getShareDownloadUrl(data.token)}`;
            await navigator.clipboard.writeText(url);
            toast.success(tx('shareCreated'));
          } catch {
            toast.error(tx('shareCreateFailed'));
          }
        }}
        onDetails={onSelectArtifact}
        onDelete={async (a) => {
          try {
            await storageService.deleteArtifactsViaBatch([a.id]);
            onArtifactsDeleted([a.id]);
            toast.success(tx('filesDeleted'));
          } catch {
            toast.error(tx('deleteFailedFor'));
          }
        }}
        onRename={handleRenameArtifact}
        onOpenFolder={onNavigatePath}
      />
    </div>
  );
}

// ==========================================
// Local sub-components
// ==========================================

/**
 * Access badge — visual hint for ownership/sharing context (v0.39.1).
 * Shows a single icon based on the strongest applicable access mode:
 *   - link icon  → user reaches the file through an override (custom share)
 *   - users icon → file is owned by the user but in a group context
 *   - person     → file is owned by the current user (default → no icon to
 *                  avoid visual noise)
 */
function AccessBadge({ artifact }: { artifact: Artifact }) {
  const { t } = useTranslation();
  const access = artifact.access;
  if (!access) return null;

  if (access.is_override) {
    return (
      <Tooltip content={t('fileExplorer.sharedViaOverride')}>
        <span className="inline-flex h-4 w-4 items-center justify-center text-[10px] text-blue-600 dark:text-blue-400">
          <PiLinkSimpleBold className="h-3 w-3" />
        </span>
      </Tooltip>
    );
  }
  if (access.is_group) {
    return (
      <Tooltip content={t('fileExplorer.groupSharedFile')}>
        <span className="inline-flex h-4 w-4 items-center justify-center text-[10px] text-violet-600 dark:text-violet-400">
          <PiUsersBold className="h-3 w-3" />
        </span>
      </Tooltip>
    );
  }
  if (access.is_owner === false) {
    // Foreign file without override / group → unusual. Mark explicitly.
    return (
      <Tooltip content={t('fileExplorer.notOwnedByYou')}>
        <span className="inline-flex h-4 w-4 items-center justify-center text-[10px] text-amber-600 dark:text-amber-400">
          <PiUserBold className="h-3 w-3" />
        </span>
      </Tooltip>
    );
  }
  return null;
}
