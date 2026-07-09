'use client';

import { Input, Text } from 'rizzui';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PiMagnifyingGlassBold } from 'react-icons/pi';

interface ToolBindingsConnectionListProps {
  bindings: Array<{
    tool_id: string;
    model?: string;
    fallback_model?: string | null;
    api?: string | null;
  }>;
}

export default function ToolBindingsConnectionList({
  bindings,
}: ToolBindingsConnectionListProps) {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return bindings;
    return bindings.filter(
      (b) =>
        b.tool_id.toLowerCase().includes(q) ||
        (b.model ?? '').toLowerCase().includes(q) ||
        (b.fallback_model ?? '').toLowerCase().includes(q)
    );
  }, [bindings, search]);

  if (bindings.length === 0) return null;

  return (
    <div className="rounded-xl border border-muted p-4">
      <Text className="mb-2 text-sm font-semibold">
        {t('pipeline.tools.connectionList', 'Connection list')}
      </Text>
      <Input
        size="sm"
        prefix={<PiMagnifyingGlassBold className="h-4 w-4" />}
        placeholder={t('pipeline.tools.searchPlaceholder')}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="mb-3"
      />
      <div className="max-h-48 overflow-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-start text-gray-500">
              <th className="pb-2 pe-2">tool_id</th>
              <th className="pb-2 pe-2">model</th>
              <th className="pb-2">fallback</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((b) => (
              <tr key={b.tool_id} className="border-t border-muted">
                <td className="py-1.5 pe-2 font-mono">{b.tool_id}</td>
                <td className="py-1.5 pe-2">{b.model ?? '—'}</td>
                <td className="py-1.5">{b.fallback_model ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
