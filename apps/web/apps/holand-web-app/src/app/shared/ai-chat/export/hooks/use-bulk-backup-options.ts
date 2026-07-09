'use client';

import { useCallback, useState } from 'react';
import type { BulkBackupFormat } from '../export/bulk-backup-runner';

export interface BulkBackupOptions {
  formats: Set<BulkBackupFormat>;
  includeMemory: boolean;
  includeTraces: boolean;
  useServerExport: boolean;
}

const DEFAULT_FORMATS: BulkBackupFormat[] = ['json', 'md'];

export function useBulkBackupOptions(serverExportAvailable: boolean) {
  const [formats, setFormats] = useState<Set<BulkBackupFormat>>(
    () => new Set(DEFAULT_FORMATS)
  );
  const [includeMemory, setIncludeMemory] = useState(false);
  const [includeTraces, setIncludeTraces] = useState(false);
  const [useServerExport, setUseServerExport] = useState(false);

  const toggleFormat = useCallback((format: BulkBackupFormat) => {
    setFormats((prev) => {
      const next = new Set(prev);
      if (next.has(format)) {
        if (next.size <= 1) return prev;
        next.delete(format);
      } else {
        next.add(format);
      }
      return next;
    });
  }, []);

  const options: BulkBackupOptions = {
    formats,
    includeMemory,
    includeTraces,
    useServerExport: serverExportAvailable && useServerExport,
  };

  return {
    options,
    toggleFormat,
    includeMemory,
    setIncludeMemory,
    includeTraces,
    setIncludeTraces,
    useServerExport,
    setUseServerExport,
    canUseServerExport: serverExportAvailable,
  };
}
