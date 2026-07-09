'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text } from 'rizzui';
import { PiTrayBold } from 'react-icons/pi';
import { LineGroup, Skeleton } from '@core/ui/skeleton';
import MessageListItem from './message-list-item';
import type { MessageFolder, MessageItem } from '@/types/messages.types';
import { useMessengerUserDirectory } from '@/hooks/use-messenger-user-directory';
import { mailboxListPartner } from '@/utils/messages-normalize';

type MailboxListProps = {
  items: MessageItem[];
  folder: MessageFolder;
  loading: boolean;
  selectedId: string | null;
  selectedIds: Set<string>;
  onSelect: (id: string) => void;
  onToggleSelect: (id: string) => void;
  isStarred?: (id: string) => boolean;
  onToggleStar?: (id: string) => void;
  showCheckboxes?: boolean;
  density?: 'comfortable' | 'compact';
};

function ListSkeleton() {
  return (
    <div className="space-y-0 p-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex gap-3 border-b border-muted px-2 py-3">
          <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2">
            <LineGroup columns={2} />
            <Skeleton className="h-3 w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function MailboxList({
  items,
  folder,
  loading,
  selectedId,
  selectedIds,
  onSelect,
  onToggleSelect,
  isStarred,
  onToggleStar,
  showCheckboxes,
  density = 'comfortable',
}: MailboxListProps) {
  const { t } = useTranslation();

  const senderIds = useMemo(
    () => [...new Set(items.map((m) => mailboxListPartner(m, folder).id))],
    [items, folder]
  );
  const directory = useMessengerUserDirectory(senderIds);

  const rowHeight = density === 'compact' ? 56 : 72;
  const scrollRef = useRef<HTMLDivElement>(null);
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 30 });

  const useVirtual = items.length > 40;

  const onScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el || !useVirtual) return;
    const start = Math.max(0, Math.floor(el.scrollTop / rowHeight) - 4);
    const count = Math.ceil(el.clientHeight / rowHeight) + 8;
    setVisibleRange({ start, end: start + count });
  }, [rowHeight, useVirtual]);

  const windowedItems = useMemo(() => {
    if (!useVirtual) return items.map((message, index) => ({ message, index }));
    return items
      .slice(visibleRange.start, visibleRange.end)
      .map((message, i) => ({ message, index: visibleRange.start + i }));
  }, [items, useVirtual, visibleRange.end, visibleRange.start]);

  if (loading) return <ListSkeleton />;

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
        <PiTrayBold className="mb-3 h-10 w-10 text-gray-300 dark:text-gray-600" />
        <Text className="text-sm text-gray-500">{t('messages.empty.inbox')}</Text>
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      onScroll={onScroll}
      className={useVirtual ? 'max-h-full overflow-y-auto' : undefined}
    >
      {useVirtual && (
        <div style={{ height: items.length * rowHeight, position: 'relative' }}>
          <div style={{ transform: `translateY(${visibleRange.start * rowHeight}px)` }}>
            {windowedItems.map(({ message, index }) => (
              <div key={message.id} style={{ height: rowHeight }}>
                <MessageListItem
                  message={message}
                  folder={folder}
                  directory={directory}
                  active={selectedId === message.id}
                  selected={selectedIds.has(message.id)}
                  starred={isStarred?.(message.id)}
                  onSelect={onSelect}
                  onToggleSelect={onToggleSelect}
                  onToggleStar={onToggleStar}
                  showCheckbox={showCheckboxes}
                  density={density}
                />
              </div>
            ))}
          </div>
        </div>
      )}
      {!useVirtual &&
        windowedItems.map(({ message }) => (
          <MessageListItem
            key={message.id}
            message={message}
            folder={folder}
            directory={directory}
            active={selectedId === message.id}
            selected={selectedIds.has(message.id)}
            starred={isStarred?.(message.id)}
            onSelect={onSelect}
            onToggleSelect={onToggleSelect}
            onToggleStar={onToggleStar}
            showCheckbox={showCheckboxes}
            density={density}
          />
        ))}
    </div>
  );
}
