'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import cn from '@core/utils/class-names';
import type { OneSearchHit } from '@/types/one-search.types';
import { PiListBold, PiSquaresFourBold, PiTableBold } from 'react-icons/pi';
import { formatRelativeDate, formatFileSize } from '../../utils/format-date';
import { getFileIcon } from '@/utils/file-icons';
import { HitFileActions, useHitFilePreview } from '../hit-file-actions';

type ViewMode = 'table' | 'grid' | 'list';

export interface FileSearchViewProps {
  files: OneSearchHit[];
  className?: string;
}

export function FileSearchView({ files, className }: FileSearchViewProps) {
  const { t } = useTranslation();
  const [viewMode, setViewMode] = useState<ViewMode>('list');

  if (files.length === 0) {
    return (
      <div className={cn('py-20 text-center', className)}>
        <p className="text-gray-500 dark:text-gray-400">
          {t('searchHub.noResults')}
        </p>
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {t('searchHub.resultsCount', { count: files.length })}
        </p>
        <div className="flex items-center gap-1 rounded-lg border border-muted bg-gray-0 p-1 dark:bg-gray-50">
          {([
            { mode: 'list' as const, Icon: PiListBold },
            { mode: 'grid' as const, Icon: PiSquaresFourBold },
            { mode: 'table' as const, Icon: PiTableBold },
          ]).map(({ mode, Icon }) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={cn(
                'rounded p-2 transition-colors',
                viewMode === mode
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-200/20'
              )}
            >
              <Icon className="h-4 w-4" />
            </button>
          ))}
        </div>
      </div>

      {viewMode === 'list' && <FileListView files={files} />}
      {viewMode === 'grid' && <FileGridView files={files} />}
      {viewMode === 'table' && <FileTableView files={files} />}
    </div>
  );
}

function FileListView({ files }: { files: OneSearchHit[] }) {
  const { t, i18n } = useTranslation();

  return (
    <div className="space-y-2">
      {files.map((file) => {
        const iconNode = getFileIcon(String(file.meta?.mime || ''), 'h-8 w-8');

        return (
          <div
            key={file.id}
            className="rounded-lg border border-muted bg-gray-0 p-4 transition-colors hover:bg-gray-100 dark:bg-gray-50 dark:hover:bg-gray-200/20"
          >
            <div className="flex items-start gap-3">
              <span className="shrink-0">{iconNode}</span>

              <div className="min-w-0 flex-1 space-y-2">
                <h3 className="line-clamp-1 font-mono text-sm font-medium text-gray-900 dark:text-gray-700">
                  {file.title}
                </h3>

                {file.href && (
                  <p className="truncate font-mono text-xs text-emerald-700 dark:text-emerald-400">
                    {file.href}
                  </p>
                )}

                {file.snippet && (
                  <p className="line-clamp-2 text-sm text-gray-600 dark:text-gray-400">
                    {file.snippet}
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                  {file.meta?.path && (
                    <span className="truncate">{String(file.meta.path)}</span>
                  )}
                  {file.meta?.mime && (
                    <span>{String(file.meta.mime)}</span>
                  )}
                  {file.meta?.size_bytes && (
                    <span>{formatFileSize(Number(file.meta.size_bytes))}</span>
                  )}
                  {file.occurredAt && (
                    <span>{formatRelativeDate(file.occurredAt, i18n.language)}</span>
                  )}
                </div>

                <HitFileActions hit={file} variant="buttons" />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function FileGridView({ files }: { files: OneSearchHit[] }) {
  const previewHit = useHitFilePreview();

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {files.map((file) => {
        const iconNode = getFileIcon(String(file.meta?.mime || ''), 'h-12 w-12');

        return (
          <div
            key={file.id}
            role="button"
            tabIndex={0}
            onClick={() => previewHit(file)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                previewHit(file);
              }
            }}
            className="cursor-pointer rounded-lg border border-muted bg-gray-0 p-4 transition-colors hover:bg-gray-100 dark:bg-gray-50 dark:hover:bg-gray-200/20"
          >
            <div className="flex flex-col items-center space-y-2 text-center">
              <span>{iconNode}</span>
              <h3 className="line-clamp-2 w-full text-sm font-medium text-gray-900 dark:text-gray-700">
                {file.title}
              </h3>
              {file.meta?.size_bytes && (
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {formatFileSize(Number(file.meta.size_bytes))}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function FileTableView({ files }: { files: OneSearchHit[] }) {
  const { t, i18n } = useTranslation();

  return (
    <div className="overflow-hidden rounded-lg border border-muted">
      <table className="w-full">
        <thead className="border-b border-muted bg-gray-0 dark:bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-400">
              {t('common.name')}
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-400">
              {t('common.type')}
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-400">
              {t('common.size')}
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-400">
              {t('common.modified')}
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-400">
              {t('common.actions')}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-muted">
          {files.map((file) => {
            const iconNode = getFileIcon(String(file.meta?.mime || ''), 'h-5 w-5');

            return (
              <tr
                key={file.id}
                className="transition-colors hover:bg-gray-100 dark:hover:bg-gray-200/20"
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span>{iconNode}</span>
                    <span className="max-w-xs truncate font-mono text-sm text-gray-900 dark:text-gray-700">
                      {file.title}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {file.meta?.mime ? String(file.meta.mime).split('/')[1]?.toUpperCase() : '-'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {file.meta?.size_bytes ? formatFileSize(Number(file.meta.size_bytes)) : '-'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {file.occurredAt ? formatRelativeDate(file.occurredAt, i18n.language) : '-'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <HitFileActions hit={file} variant="icons" />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
