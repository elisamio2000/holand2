'use client';

import { useState } from 'react';
import { Button, Input, Text } from 'rizzui';
import type { FileManagerListArgs } from '@/types/storage.types';

export interface AdvancedFilterValues {
  tags_any?: string[];
  uploaded_by?: string;
  created_from?: string;
  created_to?: string;
  size_min?: number;
  size_max?: number;
}

interface FileExplorerAdvancedFiltersProps {
  open: boolean;
  values: AdvancedFilterValues;
  labels: {
    title: string;
    tags: string;
    tagsPlaceholder: string;
    uploadedBy: string;
    uploadedByPlaceholder: string;
    dateFrom: string;
    dateTo: string;
    sizeMin: string;
    sizeMax: string;
    apply: string;
    reset: string;
  };
  onApply: (values: AdvancedFilterValues) => void;
  onReset: () => void;
  onClose: () => void;
}

export default function FileExplorerAdvancedFilters({
  open,
  values,
  labels,
  onApply,
  onReset,
  onClose,
}: FileExplorerAdvancedFiltersProps) {
  const [draft, setDraft] = useState<AdvancedFilterValues>(values);

  if (!open) return null;

  return (
    <div className="rounded-lg border border-muted bg-gray-0 p-3 shadow-sm dark:bg-gray-50">
      <div className="mb-2 flex items-center justify-between">
        <Text className="text-sm font-semibold">{labels.title}</Text>
        <button
          type="button"
          className="text-xs text-gray-500 hover:text-gray-800"
          onClick={onClose}
        >
          ×
        </button>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <Input
          label={labels.tags}
          placeholder={labels.tagsPlaceholder}
          value={(draft.tags_any ?? []).join(', ')}
          onChange={(e) =>
            setDraft((d) => ({
              ...d,
              tags_any: e.target.value
                .split(',')
                .map((t) => t.trim())
                .filter(Boolean),
            }))
          }
        />
        <Input
          label={labels.uploadedBy}
          placeholder={labels.uploadedByPlaceholder}
          value={draft.uploaded_by ?? ''}
          onChange={(e) =>
            setDraft((d) => ({
              ...d,
              uploaded_by: e.target.value.trim() || undefined,
            }))
          }
        />
        <Input
          type="date"
          label={labels.dateFrom}
          value={draft.created_from?.slice(0, 10) ?? ''}
          onChange={(e) =>
            setDraft((d) => ({
              ...d,
              created_from: e.target.value
                ? new Date(e.target.value).toISOString()
                : undefined,
            }))
          }
        />
        <Input
          type="date"
          label={labels.dateTo}
          value={draft.created_to?.slice(0, 10) ?? ''}
          onChange={(e) =>
            setDraft((d) => ({
              ...d,
              created_to: e.target.value
                ? new Date(`${e.target.value}T23:59:59`).toISOString()
                : undefined,
            }))
          }
        />
        <Input
          type="number"
          label={labels.sizeMin}
          value={draft.size_min ?? ''}
          onChange={(e) =>
            setDraft((d) => ({
              ...d,
              size_min: e.target.value ? Number(e.target.value) : undefined,
            }))
          }
        />
        <Input
          type="number"
          label={labels.sizeMax}
          value={draft.size_max ?? ''}
          onChange={(e) =>
            setDraft((d) => ({
              ...d,
              size_max: e.target.value ? Number(e.target.value) : undefined,
            }))
          }
        />
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <Button size="sm" variant="outline" onClick={() => { onReset(); onClose(); }}>
          {labels.reset}
        </Button>
        <Button
          size="sm"
          onClick={() => {
            onApply(draft);
            onClose();
          }}
        >
          {labels.apply}
        </Button>
      </div>
    </div>
  );
}

/** Merge advanced filters into list API args (exported for parent). */
export function advancedFiltersToListArgs(
  filters: AdvancedFilterValues
): Partial<FileManagerListArgs> {
  const out: Record<string, unknown> = {};
  if (filters.tags_any?.length) out.tags_any = filters.tags_any;
  if (filters.uploaded_by) out.uploaded_by = filters.uploaded_by;
  if (filters.created_from) out.created_from = filters.created_from;
  if (filters.created_to) out.created_to = filters.created_to;
  if (filters.size_min != null) out.size_min = filters.size_min;
  if (filters.size_max != null) out.size_max = filters.size_max;
  return out;
}
