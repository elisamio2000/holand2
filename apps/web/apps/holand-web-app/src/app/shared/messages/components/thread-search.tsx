'use client';

import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Input } from 'rizzui';
import { PiMagnifyingGlassBold, PiXBold } from 'react-icons/pi';
import cn from '@core/utils/class-names';
import type { MessageDetail, MessageItem } from '@/types/messages.types';

interface ThreadSearchProps {
  messages: (MessageItem | MessageDetail)[];
  onHighlight?: (messageId: string | null) => void;
  className?: string;
}

export default function ThreadSearch({ messages, onHighlight, className }: ThreadSearchProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);

  const matches = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return messages.filter((msg) => {
      const body = 'body' in msg && msg.body ? msg.body : msg.preview;
      const div = typeof document !== 'undefined' ? document.createElement('div') : null;
      if (div) div.innerHTML = body;
      const text = (div?.textContent || msg.preview || '').toLowerCase();
      return text.includes(q);
    });
  }, [messages, query]);

  const handleSearch = (value: string) => {
    setQuery(value);
    setActiveIdx(0);
    if (!value.trim()) {
      onHighlight?.(null);
      return;
    }
    if (matches.length > 0) {
      onHighlight?.(matches[0].id);
    }
  };

  const navigateMatch = (direction: 1 | -1) => {
    if (matches.length === 0) return;
    const nextIdx = (activeIdx + direction + matches.length) % matches.length;
    setActiveIdx(nextIdx);
    onHighlight?.(matches[nextIdx].id);
  };

  if (!query && matches.length === 0) {
    return (
      <div className={cn('relative', className)}>
        <Input
          prefix={<PiMagnifyingGlassBold className="h-3.5 w-3.5" />}
          placeholder={t('messages.search.inThread', 'Search in conversation')}
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          className="h-8 w-48 text-xs"
          inputClassName="h-8 text-xs"
        />
      </div>
    );
  }

  return (
    <div className={cn('flex items-center gap-1', className)}>
      <Input
        prefix={<PiMagnifyingGlassBold className="h-3.5 w-3.5" />}
        placeholder={t('messages.search.inThread', 'Search in conversation')}
        value={query}
        onChange={(e) => handleSearch(e.target.value)}
        className="h-8 w-48 text-xs"
        inputClassName="h-8 text-xs"
        suffix={
          query ? (
            <button type="button" onClick={() => handleSearch('')} className="text-gray-400 hover:text-gray-600">
              <PiXBold className="h-3 w-3" />
            </button>
          ) : undefined
        }
      />
      {matches.length > 0 && (
        <div className="flex items-center gap-0.5 text-xs text-gray-500">
          <button type="button" onClick={() => navigateMatch(-1)} className="rounded px-1 hover:bg-gray-100">
            ↑
          </button>
          <span>
            {activeIdx + 1}/{matches.length}
          </span>
          <button type="button" onClick={() => navigateMatch(1)} className="rounded px-1 hover:bg-gray-100">
            ↓
          </button>
        </div>
      )}
    </div>
  );
}
