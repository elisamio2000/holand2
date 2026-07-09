'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Text } from 'rizzui';
import type { MessageDetail, MessageItem } from '@/types/messages.types';
import {
  entityModuleLabel,
  getEntityRefsFromMessage,
} from './utils/entity-message';

type ThreadLinksPanelProps = {
  message: MessageDetail | null;
  replies: MessageItem[];
};

export default function ThreadLinksPanel({ message, replies }: ThreadLinksPanelProps) {
  const { t } = useTranslation();

  const refs = useMemo(() => {
    const map = new Map<string, ReturnType<typeof getEntityRefsFromMessage>[number]>();
    const all = message ? [message, ...replies] : replies;
    for (const msg of all) {
      for (const ref of getEntityRefsFromMessage(msg)) {
        map.set(`${ref.type}:${ref.id}`, ref);
      }
    }
    return Array.from(map.values());
  }, [message, replies]);

  if (!message) {
    return (
      <div className="p-4">
        <Text className="text-sm text-gray-500">{t('messages.rail.selectThread')}</Text>
      </div>
    );
  }

  if (refs.length === 0) {
    return (
      <div className="p-4">
        <Text className="text-sm text-gray-500">{t('messages.rail.noLinks', 'No linked records')}</Text>
      </div>
    );
  }

  return (
    <ul className="custom-scrollbar max-h-full space-y-2 overflow-y-auto p-3">
      {refs.map((ref) => (
        <li key={`${ref.type}:${ref.id}`}>
          {ref.href ? (
            <Link
              href={ref.href}
              className="block rounded-lg border border-muted px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-100/40"
            >
              <Text className="font-medium">{ref.label ?? ref.id}</Text>
              <Text className="text-xs text-gray-500">{entityModuleLabel(ref.type)}</Text>
            </Link>
          ) : (
            <div className="rounded-lg border border-dashed border-muted px-3 py-2 text-sm text-gray-500">
              <Text className="font-medium">{ref.label ?? ref.id}</Text>
              <Text className="text-xs">{entityModuleLabel(ref.type)}</Text>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
