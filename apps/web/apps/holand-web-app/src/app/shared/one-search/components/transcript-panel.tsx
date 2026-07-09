'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import cn from '@core/utils/class-names';
import { Button, Text, Title } from 'rizzui';
import { PiXBold } from 'react-icons/pi';
import { storageService, type ArtifactTranscript } from '@/services/storage.service';

export interface TranscriptPanelProps {
  artifactId: string;
  title?: string;
  query?: string;
  open: boolean;
  onClose: () => void;
  onSeek: (seconds: number) => void;
  className?: string;
}

function highlightText(text: string, query: string): React.ReactNode {
  const q = query.trim();
  if (!q) return text;
  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  if (idx < 0) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="rounded bg-primary/20 px-0.5 text-inherit">{text.slice(idx, idx + q.length)}</mark>
      {text.slice(idx + q.length)}
    </>
  );
}

export function TranscriptPanel({
  artifactId,
  title,
  query = '',
  open,
  onClose,
  onSeek,
  className,
}: TranscriptPanelProps) {
  const { t } = useTranslation();
  const [data, setData] = useState<ArtifactTranscript | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !artifactId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setData(null);
    void storageService
      .fetchArtifactTranscript(artifactId)
      .then((res) => {
        if (!cancelled) {
          setData(res);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : t('searchHub.transcriptLoadFailed'));
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [open, artifactId, t]);

  const formatTime = useCallback((sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }, []);

  if (!open) return null;

  return (
    <div
      className={cn(
        'fixed inset-y-0 end-0 z-[70] flex w-full max-w-md flex-col border-s border-muted bg-gray-0 shadow-xl dark:bg-gray-50',
        className
      )}
      role="dialog"
      aria-label={t('searchHub.transcriptPanel.title')}
    >
      <div className="flex items-center justify-between gap-2 border-b border-muted px-4 py-3">
        <div className="min-w-0">
          <Title as="h3" className="truncate text-sm font-semibold">
            {t('searchHub.transcriptPanel.title')}
          </Title>
          {title ? (
            <Text className="truncate text-xs text-gray-500 dark:text-gray-400">{title}</Text>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-200/20"
          aria-label={t('common.close', 'Close')}
        >
          <PiXBold className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        {loading && (
          <Text className="text-sm text-gray-500">{t('common.loading', 'Loading…')}</Text>
        )}
        {error && !loading && (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200">
            {error}
            <Text className="mt-1 text-xs opacity-80">{t('searchHub.transcriptPanel.degradedHint')}</Text>
          </div>
        )}
        {data && !loading && (
          <ul className="space-y-2">
            {data.segments.map((seg, i) => (
              <li key={`${seg.start_sec}-${i}`}>
                <button
                  type="button"
                  onClick={() => onSeek(seg.start_sec)}
                  className="w-full rounded-md px-2 py-1.5 text-start text-sm transition-colors hover:bg-gray-100 dark:hover:bg-gray-200/15"
                >
                  <span className="me-2 font-mono text-[11px] text-primary">
                    {formatTime(seg.start_sec)}
                  </span>
                  <span className="text-gray-800 dark:text-gray-600">
                    {highlightText(seg.text, query)}
                  </span>
                </button>
              </li>
            ))}
            {data.segments.length === 0 && data.full_text ? (
              <li className="text-sm leading-relaxed text-gray-700 dark:text-gray-500">
                {highlightText(data.full_text, query)}
              </li>
            ) : null}
          </ul>
        )}
      </div>

      {data?.segments.length ? (
        <div className="border-t border-muted px-4 py-2">
          <Button type="button" variant="text" size="sm" className="text-xs" onClick={onClose}>
            {t('common.close', 'Close')}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
