'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import cn from '@core/utils/class-names';
import { Button, Input, Text } from 'rizzui';
import {
  PiFolderOpenBold,
  PiMagnifyingGlassBold,
  PiEyeBold,
  PiArrowSquareOutBold,
} from 'react-icons/pi';
import { useFilePreview } from '@/hooks/use-file-preview';
import { storageService } from '@/services/storage.service';
import { getFileIconByExtension } from '@/utils/file-icons';
import type { Artifact } from '@/types/storage.types';
import type { FileManagerOwnership } from '@/types/storage.types';
import {
  resolveCaseFilePrefix,
  formatAttachmentBytes,
  isCasePrefixValid,
} from '../../lib/board-attachment-utils';
import { fileExplorerAttachUrl } from '../../lib/board-attach-bridge';

type SystemFilesScope = 'all' | 'case';

export interface BoardSystemFilesPickerProps {
  boardId?: string;
  caseId?: string;
  existingArtifactIds: ReadonlySet<string>;
  onAddSelected: (
    items: Array<{
      artifactId: string;
      name: string;
      mime_type?: string;
      size?: number;
    }>
  ) => void;
  className?: string;
}

export function BoardSystemFilesPicker({
  boardId,
  caseId,
  existingArtifactIds,
  onAddSelected,
  className,
}: BoardSystemFilesPickerProps) {
  const { t } = useTranslation();
  const { openFilePreview } = useFilePreview();
  const [scope, setScope] = useState<SystemFilesScope>(caseId ? 'case' : 'all');
  const [ownership, setOwnership] = useState<FileManagerOwnership>('any');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [items, setItems] = useState<Artifact[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [folderPrefix, setFolderPrefix] = useState('');
  const [folders, setFolders] = useState<Array<{ prefix: string; name: string; count?: number }>>([]);
  const [foldersLoading, setFoldersLoading] = useState(false);
  const [mediaFilter, setMediaFilter] = useState<string>('');
  const [mimeFilter, setMimeFilter] = useState('');
  const [facets, setFacets] = useState<{ media_type?: Record<string, number>; mime_type?: Array<{ value: string; count: number }> }>({});
  const pageSize = 20;

  const casePrefix = caseId ? resolveCaseFilePrefix(caseId) : '';
  const casePrefixOk = !caseId || isCasePrefixValid(caseId);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const listArgsBase = useMemo(() => {
    const args: Parameters<typeof storageService.listFilesForExplorer>[0] = {
      page,
      page_size: pageSize,
      sort_by: 'created_at',
      sort_dir: 'desc',
      ownership,
      search: debouncedSearch || undefined,
    };
    if (scope === 'case' && caseId && casePrefixOk) {
      args.folder_prefix = casePrefix;
      args.session_id = caseId;
    } else if (folderPrefix) {
      args.folder_prefix = folderPrefix;
    }
    if (mediaFilter) args.media_type = mediaFilter;
    if (mimeFilter) args.mime_type = mimeFilter;
    return args;
  }, [page, ownership, debouncedSearch, scope, caseId, casePrefix, casePrefixOk, folderPrefix, mediaFilter, mimeFilter]);

  const loadFolders = useCallback(async () => {
    setFoldersLoading(true);
    try {
      const prefix =
        scope === 'case' && caseId && casePrefixOk ? casePrefix : folderPrefix || '';
      const res = await storageService.getFileManagerFolders({
        prefix,
        delimiter: '/',
        limit: 100,
        ownership,
      });
      const list = (res.folders ?? []).map((f) => ({
        prefix: f.prefix ?? f.name ?? '',
        name: (f.name ?? f.prefix ?? '').replace(/\/$/, '').split('/').pop() ?? f.name ?? '',
        count: f.count,
      }));
      setFolders(list);
    } catch {
      setFolders([]);
    } finally {
      setFoldersLoading(false);
    }
  }, [scope, caseId, casePrefix, casePrefixOk, folderPrefix, ownership]);

  const loadFacets = useCallback(async () => {
    try {
      const res = await storageService.getFileManagerFacets({
        ownership,
        folder_prefix:
          scope === 'case' && caseId && casePrefixOk ? casePrefix : folderPrefix || undefined,
        session_id: scope === 'case' && caseId ? caseId : undefined,
      });
      setFacets({
        media_type: res.media_type,
        mime_type: res.mime_type,
      });
    } catch {
      setFacets({});
    }
  }, [ownership, scope, caseId, casePrefix, casePrefixOk, folderPrefix]);

  const loadFiles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await storageService.listFilesForExplorer(listArgsBase);
      setItems(res.items ?? []);
      setTotal(res.total ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('boards.attachments.systemLoadFailed', 'Failed to load files'));
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [listArgsBase, t]);

  useEffect(() => {
    void loadFiles();
  }, [loadFiles]);

  useEffect(() => {
    void loadFolders();
    void loadFacets();
  }, [loadFolders, loadFacets]);

  useEffect(() => {
    setPage(1);
    setSelected(new Set());
  }, [scope, ownership, debouncedSearch, folderPrefix, mediaFilter, mimeFilter]);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleAddSelected = () => {
    const picked = items.filter((item) => selected.has(item.id));
    if (!picked.length) return;
    onAddSelected(
      picked.map((item) => ({
        artifactId: item.id,
        name: item.filename ?? item.id,
        mime_type: item.mime_type ?? undefined,
        size: Number(item.file_size ?? 0) || undefined,
      }))
    );
    setSelected(new Set());
  };

  const previewItem = (item: Artifact) => {
    openFilePreview({
      src: storageService.getDownloadUrl(item.id, 'inline'),
      name: item.filename ?? item.id,
      mimeType: item.mime_type,
      fileSize: item.file_size,
      artifactId: item.id,
    });
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const mediaTypes = Object.entries(facets.media_type ?? {}).sort((a, b) => b[1] - a[1]);
  const mimeTypes = facets.mime_type ?? [];

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <PiFolderOpenBold className="h-4 w-4 shrink-0 text-primary" />
          <Text className="text-sm font-medium">
            {t('boards.attachments.systemTitle', 'Cloud files')}
          </Text>
        </div>
        {boardId ? (
          <Link
            href={fileExplorerAttachUrl(boardId)}
            className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline"
          >
            <PiArrowSquareOutBold className="h-3.5 w-3.5" />
            {t('boards.attachments.openExplorer', 'Open in File Explorer')}
          </Link>
        ) : null}
      </div>

      {caseId && !casePrefixOk ? (
        <Text className="rounded border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] text-amber-800">
          {t(
            'boards.attachments.casePrefixInvalid',
            'Case ID is empty or invalid — case-scoped files may not appear.'
          )}
        </Text>
      ) : null}

      <div className="flex flex-wrap gap-1">
        <button
          type="button"
          onClick={() => {
            setScope('all');
            setFolderPrefix('');
          }}
          className={cn(
            'rounded-full border px-2 py-0.5 text-[10px]',
            scope === 'all' ? 'border-primary bg-primary/10 text-primary' : 'border-muted'
          )}
        >
          {t('boards.attachments.scopeAll', 'All accessible')}
        </button>
        {caseId ? (
          <button
            type="button"
            onClick={() => {
              setScope('case');
              setFolderPrefix('');
            }}
            className={cn(
              'rounded-full border px-2 py-0.5 text-[10px]',
              scope === 'case' ? 'border-primary bg-primary/10 text-primary' : 'border-muted'
            )}
          >
            {t('boards.attachments.scopeCase', 'This case')}
          </button>
        ) : null}
      </div>

      {scope === 'all' || (scope === 'case' && casePrefixOk) ? (
        <div className="max-h-[100px] overflow-y-auto rounded border border-muted p-1">
          {folderPrefix ? (
            <button
              type="button"
              className="mb-1 block w-full truncate rounded px-1 py-0.5 text-left text-[10px] text-primary hover:bg-gray-50"
              onClick={() => {
                const parts = folderPrefix.replace(/\/$/, '').split('/');
                parts.pop();
                setFolderPrefix(parts.length ? `${parts.join('/')}/` : '');
              }}
            >
              {t('boards.attachments.folderUp', '↑ Up')}
            </button>
          ) : null}
          {foldersLoading ? (
            <Text className="text-[10px] text-gray-400">{t('common.loading', 'Loading…')}</Text>
          ) : folders.length === 0 ? (
            <Text className="text-[10px] text-gray-400">
              {t('boards.attachments.noFolders', 'No subfolders')}
            </Text>
          ) : (
            folders.map((f) => (
              <button
                key={f.prefix}
                type="button"
                className="block w-full truncate rounded px-1 py-0.5 text-left text-[10px] hover:bg-gray-50 dark:hover:bg-gray-200/40"
                onClick={() => setFolderPrefix(f.prefix.endsWith('/') ? f.prefix : `${f.prefix}/`)}
              >
                📁 {f.name}
                {f.count != null ? ` (${f.count})` : ''}
              </button>
            ))
          )}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-1">
        <select
          value={mediaFilter}
          onChange={(e) => setMediaFilter(e.target.value)}
          className="max-w-[120px] rounded-md border border-muted bg-white px-1.5 text-[10px] dark:bg-gray-100"
        >
          <option value="">{t('boards.attachments.filterAllTypes', 'All types')}</option>
          {mediaTypes.map(([type, count]) => (
            <option key={type} value={type}>
              {type} ({count})
            </option>
          ))}
        </select>
        <select
          value={mimeFilter}
          onChange={(e) => setMimeFilter(e.target.value)}
          className="max-w-[140px] rounded-md border border-muted bg-white px-1.5 text-[10px] dark:bg-gray-100"
        >
          <option value="">{t('boards.attachments.filterAllMimes', 'All MIME')}</option>
          {mimeTypes.slice(0, 12).map((m) => (
            <option key={m.value} value={m.value}>
              {m.value} ({m.count})
            </option>
          ))}
        </select>
      </div>

      <div className="flex gap-2">
        <Input
          size="sm"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('boards.attachments.systemSearch', 'Search files…')}
          prefix={<PiMagnifyingGlassBold className="h-3.5 w-3.5" />}
          className="flex-1"
        />
        <select
          value={ownership}
          onChange={(e) => setOwnership(e.target.value as FileManagerOwnership)}
          className="rounded-md border border-muted bg-white px-2 text-xs dark:bg-gray-100"
        >
          <option value="any">{t('boards.attachments.ownershipAny', 'Any')}</option>
          <option value="owner">{t('boards.attachments.ownershipMine', 'Mine')}</option>
          <option value="shared">{t('boards.attachments.ownershipShared', 'Shared')}</option>
        </select>
      </div>

      {loading ? (
        <Text className="py-6 text-center text-xs text-gray-500">
          {t('common.loading', 'Loading…')}
        </Text>
      ) : error ? (
        <div className="py-4 text-center">
          <Text className="text-xs text-red-500">{error}</Text>
          <Button size="sm" variant="outline" className="mt-2" onClick={() => void loadFiles()}>
            {t('common.retry', 'Retry')}
          </Button>
        </div>
      ) : items.length === 0 ? (
        <Text className="py-6 text-center text-xs text-gray-500">
          {scope === 'case' && caseId
            ? t('boards.attachments.caseFilesEmpty', 'No case files found for this board.')
            : t('boards.attachments.systemEmpty', 'No accessible files found.')}
        </Text>
      ) : (
        <ul className="max-h-[240px] space-y-1 overflow-y-auto">
          {items.map((item) => {
            const id = item.id;
            const name = item.filename ?? id;
            const already = existingArtifactIds.has(id);
            const isSelected = selected.has(id);
            return (
              <li key={id}>
                <div
                  className={cn(
                    'flex w-full items-center gap-2 rounded-lg border px-2 py-1.5 text-left text-xs transition-colors',
                    already && 'opacity-50',
                    isSelected
                      ? 'border-primary bg-primary/5'
                      : 'border-transparent hover:border-muted hover:bg-gray-50 dark:hover:bg-gray-200/40'
                  )}
                >
                  <button
                    type="button"
                    disabled={already}
                    onClick={() => !already && toggleSelect(id)}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  >
                    <span
                      className={cn(
                        'flex h-4 w-4 shrink-0 items-center justify-center rounded border',
                        isSelected ? 'border-primary bg-primary text-white' : 'border-gray-300'
                      )}
                    >
                      {isSelected ? '✓' : ''}
                    </span>
                    <span className="[&>svg]:h-6 [&>svg]:w-6">
                      {getFileIconByExtension(name, 'h-6 w-6')}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-gray-800 dark:text-gray-200">{name}</p>
                      <p className="truncate text-[10px] text-gray-500">
                        {item.mime_type}
                        {item.file_size ? ` · ${formatAttachmentBytes(Number(item.file_size))}` : ''}
                        {already ? ` · ${t('boards.attachments.alreadyAdded', 'Added')}` : ''}
                      </p>
                    </div>
                  </button>
                  <Button
                    size="sm"
                    variant="text"
                    className="h-7 w-7 shrink-0 p-0"
                    title={t('boards.attachments.preview', 'Preview')}
                    onClick={() => previewItem(item)}
                  >
                    <PiEyeBold className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {totalPages > 1 ? (
        <div className="flex items-center justify-between text-[10px] text-gray-500">
          <span>
            {t('boards.attachments.pageOf', 'Page {{page}} of {{total}}', {
              page,
              total: totalPages,
            })}
          </span>
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="outline"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              {t('common.prev', 'Prev')}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((p) => p + 1)}
            >
              {t('common.next', 'Next')}
            </Button>
          </div>
        </div>
      ) : null}

      <Button
        size="sm"
        disabled={!selected.size}
        onClick={handleAddSelected}
        className="w-full"
      >
        {t('boards.attachments.addSelected', 'Add to board ({{count}})', {
          count: selected.size,
        })}
      </Button>
    </div>
  );
}
