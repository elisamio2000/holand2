'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import cn from '@core/utils/class-names';
import { Button, Input, Text } from 'rizzui';
import {
  PiTrashBold,
  PiUploadSimpleBold,
  PiBooksBold,
  PiCloudBold,
  PiEyeBold,
  PiEyeSlashBold,
  PiPlayFill,
  PiArrowsClockwiseBold,
  PiLinkBold,
  PiWarningCircleBold,
} from 'react-icons/pi';
import { fetchTextHeadPreview } from '../lib/board-attachment-lifecycle';
import { useAttachmentAvailability } from '../hooks/use-attachment-availability';
import { useVirtualWindow } from '../hooks/use-virtual-window';
import { setAttachmentDragGhost } from './components/attachment-drag-ghost';
import type { RemoveAttachmentsOptions } from '../hooks/use-board-attachments';
import { useFilePreview } from '@/hooks/use-file-preview';
import { storageService } from '@/services/storage.service';
import type {
  BoardAttachmentCategory,
  BoardAttachmentRef,
  BoardAttachmentSource,
} from '../lib/board-types';
import {
  attachmentMime,
  countAllPlacements,
  filterAttachments,
  formatAttachmentBytes,
  sortAttachments,
  type AttachmentSortMode,
} from '../lib/board-attachment-utils';
import { BoardSystemFilesPicker } from './components/board-system-files-picker';
import { BoardAttachmentPreview } from './components/board-attachment-preview';
import {
  BoardAttachmentInlinePlayer,
  isPlayableAttachmentCategory,
} from './components/board-attachment-inline-player';

type PanelTab = 'library' | 'upload' | 'system';

const CATEGORY_FILTERS: Array<{ id: BoardAttachmentCategory | 'all'; labelKey: string; fallback: string }> = [
  { id: 'all', labelKey: 'boards.attachments.filterAll', fallback: 'All' },
  { id: 'image', labelKey: 'boards.attachments.filterImage', fallback: 'Images' },
  { id: 'video', labelKey: 'boards.attachments.filterVideo', fallback: 'Video' },
  { id: 'audio', labelKey: 'boards.attachments.filterAudio', fallback: 'Audio' },
  { id: 'document', labelKey: 'boards.attachments.filterDocument', fallback: 'Docs' },
  { id: 'archive', labelKey: 'boards.attachments.filterArchive', fallback: 'Archives' },
  { id: 'other', labelKey: 'boards.attachments.filterOther', fallback: 'Other' },
];

const SORT_OPTIONS: Array<{ id: AttachmentSortMode; labelKey: string; fallback: string }> = [
  { id: 'added-desc', labelKey: 'boards.attachments.sortAddedDesc', fallback: 'Newest' },
  { id: 'added-asc', labelKey: 'boards.attachments.sortAddedAsc', fallback: 'Oldest' },
  { id: 'name-asc', labelKey: 'boards.attachments.sortNameAsc', fallback: 'Name A–Z' },
  { id: 'name-desc', labelKey: 'boards.attachments.sortNameDesc', fallback: 'Name Z–A' },
  { id: 'size-desc', labelKey: 'boards.attachments.sortSizeDesc', fallback: 'Largest' },
  { id: 'type', labelKey: 'boards.attachments.sortType', fallback: 'Type' },
];

const LIBRARY_PAGE_SIZE = 50;

export interface BoardAttachmentsPanelProps {
  attachments: BoardAttachmentRef[];
  boardId?: string;
  caseId?: string;
  readOnly?: boolean;
  onChange: (attachments: BoardAttachmentRef[]) => void;
  onPlaceOnBoard?: (attachment: BoardAttachmentRef) => void;
  onAddFromArtifact?: (
    meta: {
      artifactId: string;
      name: string;
      mime_type?: string;
      size?: number;
    },
    source: BoardAttachmentSource
  ) => boolean;
  onUpload?: (file: File) => Promise<boolean>;
  onRemove?: (ids: string[], opts?: RemoveAttachmentsOptions) => void;
  onRefreshMetadata?: (libraryId: string) => Promise<boolean>;
  onMigrateBlobs?: () => void;
  placementCounts?: Map<string, number>;
  className?: string;
}

export function BoardAttachmentsPanel({
  attachments,
  boardId,
  caseId,
  readOnly = false,
  onChange,
  onPlaceOnBoard,
  onAddFromArtifact,
  onUpload,
  onRemove,
  onRefreshMetadata,
  onMigrateBlobs,
  placementCounts,
  className,
}: BoardAttachmentsPanelProps) {
  const { t } = useTranslation();
  const { openFilePreview } = useFilePreview();
  const fileRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<PanelTab>('library');
  const [artifactIdInput, setArtifactIdInput] = useState('');
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<BoardAttachmentCategory | 'all'>('all');
  const [sortMode, setSortMode] = useState<AttachmentSortMode>('added-desc');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [livePreview, setLivePreview] = useState(true);
  const [inlinePlayId, setInlinePlayId] = useState<string | null>(null);
  const [libraryPage, setLibraryPage] = useState(1);
  const [textPreviewById, setTextPreviewById] = useState<Record<string, string>>({});
  const { isUnavailable } = useAttachmentAvailability(attachments);

  useEffect(() => {
    setLibraryPage(1);
  }, [search, categoryFilter, sortMode]);

  const existingArtifactIds = useMemo(
    () => new Set(attachments.map((a) => a.artifactId)),
    [attachments]
  );

  const counts = useMemo(() => {
    const m = new Map<BoardAttachmentCategory, number>();
    for (const a of attachments) {
      const cat = a.category ?? 'other';
      m.set(cat, (m.get(cat) ?? 0) + 1);
    }
    return m;
  }, [attachments]);

  const filtered = useMemo(() => {
    const cat = categoryFilter === 'all' ? null : categoryFilter;
    const list = filterAttachments(attachments, { search, category: cat });
    return sortAttachments(list, sortMode);
  }, [attachments, search, categoryFilter, sortMode]);

  const libraryTotalPages = Math.max(1, Math.ceil(filtered.length / LIBRARY_PAGE_SIZE));
  const useVirtualLibrary = filtered.length > LIBRARY_PAGE_SIZE;
  const libraryListRef = useRef<HTMLDivElement>(null);
  const [libraryViewportH, setLibraryViewportH] = useState(360);
  const virtual = useVirtualWindow(filtered, 72, libraryViewportH);

  useEffect(() => {
    if (!useVirtualLibrary || !libraryListRef.current) return;
    const el = libraryListRef.current;
    const ro = new ResizeObserver(() => setLibraryViewportH(el.clientHeight || 360));
    ro.observe(el);
    return () => ro.disconnect();
  }, [useVirtualLibrary]);

  const pagedFiltered = useMemo(() => {
    if (useVirtualLibrary) return virtual.slice;
    if (filtered.length <= LIBRARY_PAGE_SIZE) return filtered;
    const start = (libraryPage - 1) * LIBRARY_PAGE_SIZE;
    return filtered.slice(start, start + LIBRARY_PAGE_SIZE);
  }, [filtered, libraryPage, useVirtualLibrary, virtual.slice]);

  const loadTextPreview = useCallback(async (att: BoardAttachmentRef) => {
    if (textPreviewById[att.id] || att.category !== 'document') return;
    const head = await fetchTextHeadPreview(att.artifactId);
    if (head) {
      setTextPreviewById((prev) => ({ ...prev, [att.id]: head }));
    }
  }, [textPreviewById]);

  const toggleSelect = (id: string, additive: boolean) => {
    setSelectedIds((prev) => {
      const next = additive ? new Set(prev) : new Set<string>();
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllFiltered = () => {
    setSelectedIds(new Set(filtered.map((a) => a.id)));
  };

  const clearSelection = () => setSelectedIds(new Set());

  const handleLinkArtifact = () => {
    const id = artifactIdInput.trim();
    if (!id) return;
    const added = onAddFromArtifact?.({ artifactId: id, name: id }, 'link');
    if (added !== false) setArtifactIdInput('');
  };

  const handleUploadFiles = async (files: FileList | File[]) => {
    const list = Array.from(files);
    if (!list.length || !onUpload) return;
    setUploading(true);
    try {
      for (const file of list) {
        await onUpload(file);
      }
    } finally {
      setUploading(false);
    }
  };

  const preview = (att: BoardAttachmentRef) => {
    const mime = attachmentMime(att);
    const src = storageService.getDownloadUrl(att.artifactId, 'inline');
    if (src) {
      openFilePreview({
        src,
        name: att.name,
        mimeType: mime,
        artifactId: att.artifactId,
        fileSize: att.size,
      });
    }
  };

  const toggleInlinePlay = (attId: string) => {
    setInlinePlayId((prev) => (prev === attId ? null : attId));
  };

  const onDragOverUpload = useCallback((e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes('Files')) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  const onDropUpload = useCallback(
    (e: React.DragEvent) => {
      if (!e.dataTransfer.types.includes('Files') || readOnly) return;
      e.preventDefault();
      if (e.dataTransfer.files?.length) void handleUploadFiles(e.dataTransfer.files);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [readOnly, onUpload]
  );

  const handleBatchRemove = (removeCanvasPlacements = false) => {
    if (!selectedIds.size) return;
    const ids = [...selectedIds];
    if (onRemove) onRemove(ids, { removeCanvasPlacements, skipPlacementCheck: removeCanvasPlacements });
    else onChange(attachments.filter((a) => !selectedIds.has(a.id)));
    clearSelection();
  };

  const handleAddFromSystem = (
    items: Array<{
      artifactId: string;
      name: string;
      mime_type?: string;
      size?: number;
    }>
  ) => {
    const source: BoardAttachmentSource = tab === 'system' && caseId ? 'case' : 'system';
    for (const item of items) {
      onAddFromArtifact?.(item, source);
    }
  };

  const tabs: Array<{ id: PanelTab; icon: React.ReactNode; label: string }> = [
    {
      id: 'library',
      icon: <PiBooksBold className="h-3.5 w-3.5" />,
      label: t('boards.attachments.tabLibrary', 'Library'),
    },
    {
      id: 'upload',
      icon: <PiUploadSimpleBold className="h-3.5 w-3.5" />,
      label: t('boards.attachments.tabUpload', 'Upload'),
    },
    {
      id: 'system',
      icon: <PiCloudBold className="h-3.5 w-3.5" />,
      label: t('boards.attachments.tabSystem', 'System files'),
    },
  ];

  return (
    <div className={cn('flex max-h-full flex-col overflow-hidden', className)}>
      <div className="shrink-0 border-b border-muted p-3 pb-2">
        <Text className="mb-2 font-semibold">{t('boards.attachments.title', 'Attachments')}</Text>
        {caseId ? (
          <Text className="mb-2 text-xs text-gray-500">
            {t('boards.attachments.caseHint', 'Case')}: {caseId}
          </Text>
        ) : (
          <Text className="mb-2 text-xs text-gray-500">
            {t('boards.attachments.hint', 'Link storage artifacts or upload files.')}
          </Text>
        )}
        <div className="flex gap-1 rounded-lg border border-muted p-0.5">
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={cn(
                'flex flex-1 items-center justify-center gap-1 rounded-md px-1.5 py-2 text-[10px] font-medium leading-none',
                tab === item.id
                  ? 'bg-primary text-white'
                  : 'text-gray-600 hover:bg-gray-50 dark:text-gray-400'
              )}
            >
              <span className="inline-flex shrink-0 items-center justify-center [&>svg]:h-3.5 [&>svg]:w-3.5">
                {item.icon}
              </span>
              <span className="truncate">{item.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3 pt-2">
        {tab === 'library' ? (
          <>
            <div className="mb-2 flex gap-2">
              <Input
                size="sm"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('boards.attachments.search', 'Search library…')}
                className="flex-1"
              />
              <Button
                size="sm"
                variant="outline"
                title={
                  livePreview
                    ? t('boards.attachments.previewIcons', 'Show icons only')
                    : t('boards.attachments.previewLive', 'Show live thumbnails')
                }
                onClick={() => setLivePreview((v) => !v)}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center p-0"
              >
                {livePreview ? (
                  <PiEyeBold className="h-4 w-4 shrink-0" />
                ) : (
                  <PiEyeSlashBold className="h-4 w-4 shrink-0" />
                )}
              </Button>
              <select
                value={sortMode}
                onChange={(e) => setSortMode(e.target.value as AttachmentSortMode)}
                className="max-w-[100px] rounded-md border border-muted bg-white px-1.5 text-[10px] dark:bg-gray-100"
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {t(opt.labelKey, opt.fallback)}
                  </option>
                ))}
              </select>
            </div>

            <div className="mb-2 flex flex-wrap gap-1">
              {CATEGORY_FILTERS.map((f) => {
                const count =
                  f.id === 'all' ? attachments.length : counts.get(f.id as BoardAttachmentCategory) ?? 0;
                if (f.id !== 'all' && count === 0) return null;
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setCategoryFilter(f.id)}
                    className={cn(
                      'rounded-full border px-2 py-0.5 text-[10px] font-medium',
                      categoryFilter === f.id
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-muted text-gray-600'
                    )}
                  >
                    {t(f.labelKey, f.fallback)} ({count})
                  </button>
                );
              })}
            </div>

            {selectedIds.size > 0 ? (
              <div className="mb-2 flex flex-wrap items-center gap-2 rounded border border-muted bg-gray-50 px-2 py-1.5 dark:bg-gray-200/30">
                <Text className="flex-1 text-[10px]">
                  {t('boards.attachments.selectedCount', '{{count}} selected', {
                    count: selectedIds.size,
                  })}
                </Text>
                {!readOnly ? (
                  <>
                    <Button size="sm" variant="text" color="danger" onClick={() => handleBatchRemove(false)}>
                      <PiTrashBold className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleBatchRemove(true)}>
                      {t('boards.attachments.removeAndCanvas', 'Remove + canvas')}
                    </Button>
                  </>
                ) : null}
                <Button size="sm" variant="text" onClick={clearSelection}>
                  {t('common.clear', 'Clear')}
                </Button>
              </div>
            ) : (
              <div className="mb-2 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={selectAllFiltered} disabled={!filtered.length}>
                  {t('boards.attachments.selectAll', 'Select all')}
                </Button>
                {onMigrateBlobs && !readOnly ? (
                  <Button size="sm" variant="outline" onClick={onMigrateBlobs}>
                    {t('boards.attachments.migrateBlobs', 'Migrate local media')}
                  </Button>
                ) : null}
              </div>
            )}

            {filtered.length === 0 ? (
              <div
                className={cn(
                  'rounded-lg border-2 border-dashed border-muted py-8 text-center',
                  !readOnly && 'hover:border-primary/40'
                )}
                onDragOver={onDragOverUpload}
                onDrop={onDropUpload}
              >
                <PiUploadSimpleBold className="mx-auto mb-2 h-8 w-8 text-gray-400" />
                <Text className="text-sm text-gray-500">
                  {t('boards.attachments.emptyDrop', 'No attachments. Drop files here to upload.')}
                </Text>
              </div>
            ) : (
              <>
              {libraryTotalPages > 1 && !useVirtualLibrary ? (
                <div className="mb-2 flex items-center justify-between text-[10px] text-gray-500">
                  <span>
                    {t('boards.attachments.libraryPage', 'Showing {{from}}–{{to}} of {{total}}', {
                      from: (libraryPage - 1) * LIBRARY_PAGE_SIZE + 1,
                      to: Math.min(libraryPage * LIBRARY_PAGE_SIZE, filtered.length),
                      total: filtered.length,
                    })}
                  </span>
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" disabled={libraryPage <= 1} onClick={() => setLibraryPage((p) => p - 1)}>
                      {t('common.prev', 'Prev')}
                    </Button>
                    <Button size="sm" variant="outline" disabled={libraryPage >= libraryTotalPages} onClick={() => setLibraryPage((p) => p + 1)}>
                      {t('common.next', 'Next')}
                    </Button>
                  </div>
                </div>
              ) : null}
              <div
                ref={libraryListRef}
                className={useVirtualLibrary ? 'max-h-[min(50vh,420px)] overflow-y-auto' : undefined}
                onScroll={
                  useVirtualLibrary
                    ? (e) => virtual.onScroll((e.target as HTMLDivElement).scrollTop)
                    : undefined
                }
              >
              {useVirtualLibrary ? (
                <div style={{ height: virtual.totalHeight, position: 'relative' }}>
                  <ul
                    className="absolute left-0 right-0 space-y-1.5"
                    style={{ top: virtual.offsetY }}
                  >
                    {pagedFiltered.map((att) => {
                      const isSelected = selectedIds.has(att.id);
                      const placed = placementCounts?.get(att.id) ?? 0;
                      const playable = isPlayableAttachmentCategory(att.category);
                      const inlineOpen = inlinePlayId === att.id;
                      const unavailable = isUnavailable(att);
                      const textHead = textPreviewById[att.id];
                      return (
                        <li key={att.id}>
                          <div
                            draggable={!readOnly}
                            onDragStart={(e) => {
                              e.dataTransfer.setData('application/x-board-attachment', att.id);
                              e.dataTransfer.effectAllowed = 'copy';
                              setAttachmentDragGhost(e, att.artifactId, att.name);
                            }}
                            onDoubleClick={() => preview(att)}
                            className={cn(
                              'flex items-center gap-2 rounded-lg border p-2 transition-colors',
                              isSelected ? 'border-primary bg-primary/5' : 'border-muted',
                              unavailable && 'border-amber-300 bg-amber-50/50 dark:bg-amber-900/10'
                            )}
                          >
                            <button
                              type="button"
                              className="shrink-0"
                              onClick={(e) => toggleSelect(att.id, e.shiftKey)}
                            >
                              <span
                                className={cn(
                                  'flex h-4 w-4 items-center justify-center rounded border text-[10px]',
                                  isSelected ? 'border-primary bg-primary text-white' : 'border-gray-300'
                                )}
                              >
                                {isSelected ? '✓' : ''}
                              </span>
                            </button>
                            <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded border border-muted bg-gray-50 dark:bg-gray-200/30">
                              <BoardAttachmentPreview
                                attachment={att}
                                compact
                                size="md"
                                livePreview={livePreview}
                                className="h-full w-full"
                              />
                              {placed > 0 ? (
                                <span
                                  className="absolute -end-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-white"
                                  title={t('boards.attachments.onCanvasBadge', 'On canvas')}
                                >
                                  <PiLinkBold className="h-2.5 w-2.5" />
                                </span>
                              ) : null}
                            </div>
                            <div className="min-w-0 flex-1">
                              <Text className="truncate text-xs font-medium">{att.name}</Text>
                              <Text className="truncate text-[10px] text-gray-500">
                                {att.category}
                                {att.anchorNodeId ? ` · anchor` : ''}
                              </Text>
                            </div>
                            {onPlaceOnBoard ? (
                              <Button size="sm" variant="outline" className="h-7 px-2 text-[10px]" onClick={() => onPlaceOnBoard(att)}>
                                {t('boards.attachments.place', 'Place')}
                              </Button>
                            ) : null}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : (
              <ul className="space-y-1.5">
                {pagedFiltered.map((att) => {
                  const placed = placementCounts?.get(att.id) ?? 0;
                  const playable = isPlayableAttachmentCategory(att.category);
                  const inlineOpen = inlinePlayId === att.id;
                  const unavailable = isUnavailable(att);
                  const textHead = textPreviewById[att.id];
                  return (
                    <li key={att.id}>
                    <div
                      draggable={!readOnly}
                      onDragStart={(e) => {
                        e.dataTransfer.setData('application/x-board-attachment', att.id);
                        e.dataTransfer.effectAllowed = 'copy';
                        setAttachmentDragGhost(e, att.artifactId, att.name);
                      }}
                      onDoubleClick={() => preview(att)}
                      className={cn(
                        'flex items-center gap-2 rounded-lg border p-2 transition-colors',
                        isSelected ? 'border-primary bg-primary/5' : 'border-muted',
                        unavailable && 'border-amber-300 bg-amber-50/50 dark:bg-amber-900/10'
                      )}
                    >
                      <button
                        type="button"
                        className="shrink-0"
                        onClick={(e) => toggleSelect(att.id, e.shiftKey)}
                      >
                        <span
                          className={cn(
                            'flex h-4 w-4 items-center justify-center rounded border text-[10px]',
                            isSelected ? 'border-primary bg-primary text-white' : 'border-gray-300'
                          )}
                        >
                          {isSelected ? '✓' : ''}
                        </span>
                      </button>
                      <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded border border-muted bg-gray-50 dark:bg-gray-200/30">
                        <BoardAttachmentPreview
                          attachment={att}
                          compact
                          size="md"
                          livePreview={livePreview}
                          className="h-full w-full"
                        />
                        {placed > 0 ? (
                          <span
                            className="absolute -end-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-white"
                            title={t('boards.attachments.onCanvasBadge', 'On canvas')}
                          >
                            <PiLinkBold className="h-2.5 w-2.5" />
                          </span>
                        ) : null}
                        {unavailable ? (
                          <span
                            className="absolute inset-0 flex items-center justify-center bg-amber-100/80"
                            title={t('boards.attachments.unavailable', 'Unavailable')}
                          >
                            <PiWarningCircleBold className="h-4 w-4 text-amber-600" />
                          </span>
                        ) : null}
                      </div>
                      <div className="min-w-0 flex-1">
                        <Text className="truncate text-xs font-medium">{att.name}</Text>
                        <Text className="truncate text-[10px] text-gray-500">
                          {att.category}
                          {att.size ? ` · ${formatAttachmentBytes(att.size)}` : ''}
                          {att.source ? ` · ${att.source}` : ''}
                          {placed ? ` · ${t('boards.attachments.onCanvas', '{{n}} on canvas', { n: placed })}` : ''}
                          {unavailable ? ` · ${t('boards.attachments.unavailable', 'Unavailable')}` : ''}
                        </Text>
                        {att.category === 'document' && !textHead ? (
                          <button
                            type="button"
                            className="text-[10px] text-primary underline"
                            onClick={() => void loadTextPreview(att)}
                          >
                            {t('boards.attachments.showTextHead', 'Preview text')}
                          </button>
                        ) : null}
                        {textHead ? (
                          <pre className="mt-1 max-h-16 overflow-hidden whitespace-pre-wrap break-all rounded bg-gray-100 p-1 text-[9px] text-gray-600 dark:bg-gray-200/40">
                            {textHead}
                            {textHead.length >= 4096 ? '…' : ''}
                          </pre>
                        ) : null}
                      </div>
                      <div className="flex shrink-0 flex-col gap-0.5">
                        {onRefreshMetadata && !readOnly ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="inline-flex h-7 w-7 items-center justify-center p-0"
                            title={t('boards.attachments.refresh', 'Refresh metadata')}
                            onClick={() => void onRefreshMetadata(att.id)}
                          >
                            <PiArrowsClockwiseBold className="h-3.5 w-3.5" />
                          </Button>
                        ) : null}
                        {playable ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="inline-flex h-7 min-w-0 items-center justify-center gap-1 px-2 text-[10px]"
                            onClick={() => toggleInlinePlay(att.id)}
                          >
                            <PiPlayFill className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">
                              {inlineOpen
                                ? t('boards.attachments.hidePlayer', 'Hide')
                                : t('boards.attachments.play', 'Play')}
                            </span>
                          </Button>
                        ) : null}
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-[10px]"
                          onClick={() => preview(att)}
                        >
                          {t('boards.attachments.preview', 'Preview')}
                        </Button>
                        {onPlaceOnBoard ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-[10px]"
                            onClick={() => onPlaceOnBoard(att)}
                          >
                            {t('boards.attachments.place', 'Place')}
                          </Button>
                        ) : null}
                      </div>
                    </div>
                    {inlineOpen && playable ? (
                      <div
                        className="mt-1 rounded-lg border border-muted bg-gray-50/80 p-2 dark:bg-gray-200/20"
                        onPointerDown={(e) => e.stopPropagation()}
                      >
                        <BoardAttachmentInlinePlayer
                          attachment={att}
                          rowId={`board-att-${att.id}`}
                          livePreview={livePreview}
                        />
                      </div>
                    ) : null}
                    </li>
                  );
                })}
              </ul>
              )}
              </div>
              </>
            )}
          </>
        ) : null}

        {tab === 'upload' ? (
          <div
            className={cn(
              'rounded-lg border-2 border-dashed border-muted p-4 text-center',
              !readOnly && 'hover:border-primary/40'
            )}
            onDragOver={onDragOverUpload}
            onDrop={onDropUpload}
          >
            <PiUploadSimpleBold className="mx-auto mb-2 h-8 w-8 text-gray-400" />
            <Text className="mb-3 text-xs text-gray-500">
              {t('boards.attachments.dropHint', 'Drop files here or use the buttons below')}
            </Text>
            <input
              ref={fileRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.length) void handleUploadFiles(e.target.files);
                e.target.value = '';
              }}
            />
            <Button
              size="sm"
              className="mb-4"
              onClick={() => fileRef.current?.click()}
              isLoading={uploading}
              disabled={readOnly}
            >
              {t('boards.attachments.upload', 'Upload file')}
            </Button>
            <div className="flex gap-2">
              <Input
                size="sm"
                value={artifactIdInput}
                onChange={(e) => setArtifactIdInput(e.target.value)}
                placeholder={t('boards.attachments.artifactId', 'Artifact ID')}
                className="flex-1"
                disabled={readOnly}
              />
              <Button
                size="sm"
                variant="outline"
                onClick={handleLinkArtifact}
                disabled={!artifactIdInput.trim() || readOnly}
              >
                {t('boards.attachments.link', 'Link')}
              </Button>
            </div>
          </div>
        ) : null}

        {tab === 'system' ? (
          <BoardSystemFilesPicker
            boardId={boardId}
            caseId={caseId}
            existingArtifactIds={existingArtifactIds}
            onAddSelected={handleAddFromSystem}
          />
        ) : null}
      </div>
    </div>
  );
}
