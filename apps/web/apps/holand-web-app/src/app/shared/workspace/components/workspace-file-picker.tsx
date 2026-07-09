'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Input, Loader, Text } from 'rizzui';
import { PiMagnifyingGlassBold } from 'react-icons/pi';
import { storageService } from '@/services/storage.service';

interface WorkspaceFilePickerProps {
  value: string;
  onChange: (artifactId: string, label?: string) => void;
  excludeIds?: string[];
}

export default function WorkspaceFilePicker({
  value,
  onChange,
  excludeIds = [],
}: WorkspaceFilePickerProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<{ id: string; label: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const search = useCallback(
    async (q: string) => {
      setLoading(true);
      try {
        const res = await storageService.listFilesViaPlugin({
          search: q || undefined,
          page_size: 15,
        });
        const exclude = new Set(excludeIds);
        const items = (res.items ?? []).map((f) => ({
          id: f.id,
          label: f.original_filename || f.id,
        }));
        setResults(items.filter((i) => i.id && !exclude.has(i.id)));
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    },
    [excludeIds]
  );

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleQuery = (q: string) => {
    setQuery(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      search(q);
      setOpen(true);
    }, 300);
  };

  return (
    <div ref={containerRef} className="relative max-w-md space-y-1">
      <Input
        label={t('workspace.pickers.file')}
        placeholder={t('workspace.pickers.filePlaceholder')}
        value={query}
        onChange={(e) => handleQuery(e.target.value)}
        onFocus={() => {
          search(query);
          setOpen(true);
        }}
        prefix={<PiMagnifyingGlassBold className="h-4 w-4" />}
        suffix={loading ? <Loader variant="spinner" size="sm" /> : undefined}
      />
      {value && (
        <Text className="text-xs text-gray-500">
          {t('workspace.pickers.selectedId', { id: value })}
        </Text>
      )}
      {open && results.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-muted bg-white shadow-lg dark:bg-gray-50">
          {results.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                className="flex w-full flex-col px-3 py-2 text-start text-sm hover:bg-gray-100"
                onClick={() => {
                  onChange(r.id, r.label);
                  setQuery(r.label);
                  setOpen(false);
                }}
              >
                <span className="font-medium truncate">{r.label}</span>
                <span className="truncate text-xs text-gray-500">{r.id}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
