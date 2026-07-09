'use client';

import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { Text } from 'rizzui';
import {
  PiCalendarBlank,
  PiFolder,
  PiGraph,
  PiKanban,
  PiLinkBold,
  PiListChecks,
} from 'react-icons/pi';
import cn from '@core/utils/class-names';
import type { EntityRef, MessageDetail, MessageItem } from '@/types/messages.types';
import {
  entityModuleLabel,
  getEntityRefsFromMessage,
  parseEntityPayloadFromBody,
} from '../utils/entity-message';

type EntityLinkMessageCardProps = {
  message: MessageItem | MessageDetail;
  className?: string;
};

function EntityIcon({ type }: { type: EntityRef['type'] }) {
  const className = 'h-4 w-4 shrink-0';
  switch (type) {
    case 'project':
      return <PiFolder className={className} />;
    case 'task':
      return <PiListChecks className={className} />;
    case 'calendar_event':
      return <PiCalendarBlank className={className} />;
    case 'graph_node':
      return <PiGraph className={className} />;
    case 'case':
      return <PiKanban className={className} />;
    default:
      return <PiLinkBold className={className} />;
  }
}

export default function EntityLinkMessageCard({ message, className }: EntityLinkMessageCardProps) {
  const { t } = useTranslation();
  const body = ('body' in message && message.body) || message.preview || '';
  const embedded = parseEntityPayloadFromBody(body);
  const refs = getEntityRefsFromMessage(message);
  const summary = embedded?.summary ?? message.preview;

  return (
    <div className={cn('flex w-full justify-center px-2 py-2', className)}>
      <div className="w-full max-w-xl overflow-hidden rounded-xl border border-muted bg-gray-0 shadow-sm dark:bg-gray-50">
        <div className="border-b border-muted bg-gradient-to-r from-slate-600 to-slate-800 px-4 py-3">
          <Text className="text-xs font-medium uppercase tracking-wide text-white/80">
            {t('messages.entity.systemLabel', 'Linked record')}
          </Text>
          <Text className="text-base font-semibold text-white">
            {message.subject || t('messages.entity.cardTitle', 'Related items')}
          </Text>
        </div>
        <div className="space-y-3 p-4">
          {summary && (
            <Text className="text-sm text-gray-600 dark:text-gray-400">{summary}</Text>
          )}
          <ul className="space-y-2">
            {refs.map((ref) => (
              <li key={`${ref.type}:${ref.id}`}>
                {ref.href ? (
                  <Link
                    href={ref.href}
                    className="flex items-center gap-2 rounded-lg border border-muted px-3 py-2 text-sm transition-colors hover:bg-gray-50 dark:hover:bg-gray-100/50"
                  >
                    <EntityIcon type={ref.type} />
                    <span className="min-w-0 flex-1 truncate font-medium">
                      {ref.label ?? ref.id}
                    </span>
                    <span className="shrink-0 text-xs text-gray-400">
                      {entityModuleLabel(ref.type)}
                    </span>
                  </Link>
                ) : (
                  <div className="flex items-center gap-2 rounded-lg border border-dashed border-muted px-3 py-2 text-sm text-gray-500">
                    <EntityIcon type={ref.type} />
                    <span className="truncate">{ref.label ?? ref.id}</span>
                    <span className="text-xs">({entityModuleLabel(ref.type)})</span>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
