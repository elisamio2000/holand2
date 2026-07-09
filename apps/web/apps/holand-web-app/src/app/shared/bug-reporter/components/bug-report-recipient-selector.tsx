'use client';

import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { Avatar, Loader, Text } from 'rizzui';
import cn from '@core/utils/class-names';
import type { BugReportConfig } from '../config/bug-report-config';
import { useBugReportRecipients } from '../hooks/use-bug-report-recipients';

interface BugReportRecipientSelectorProps {
  config: BugReportConfig;
  value: string;
  onChange: (recipientId: string) => void;
  className?: string;
}

function roleLabel(role: string | undefined, t: TFunction) {
  if (!role) return null;
  const normalized = role.toLowerCase().replace(/_/g, '-');
  if (normalized.includes('support')) {
    return t('messages.bugReport.recipientRoleSupport', 'Support');
  }
  if (normalized.includes('super') || normalized.includes('admin')) {
    return t('messages.bugReport.recipientRoleAdmin', 'Admin');
  }
  return role;
}

/** Read-only display of the admin-configured support recipient */
export default function BugReportRecipientSelector({
  config,
  value,
  onChange,
  className,
}: BugReportRecipientSelectorProps) {
  const { t } = useTranslation();
  const { recipients, loading, error } = useBugReportRecipients(config);

  const selected =
    recipients.find((r) => r.id === value) ??
    recipients[0] ??
    (config.recipientId ? { id: config.recipientId, name: config.recipientId } : null);

  useEffect(() => {
    if (selected?.id && selected.id !== value) {
      onChange(selected.id);
    }
  }, [selected?.id, value, onChange]);

  return (
    <div className={cn('space-y-2', className)}>
      <Text className="text-xs font-semibold text-gray-500">
        {t('messages.bugReport.recipientLabel', 'Send to')}
      </Text>

      {loading ? (
        <div className="flex items-center gap-2 py-2">
          <Loader variant="spinner" size="sm" />
          <Text className="text-xs text-gray-500">
            {t('messages.bugReport.recipientLoading', 'Loading support contact…')}
          </Text>
        </div>
      ) : !selected?.id ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-900/40 dark:bg-amber-950/30">
          <Text className="text-xs text-amber-800 dark:text-amber-300">
            {t(
              'messages.bugReport.recipientNotConfigured',
              'Bug report recipient is not configured. Ask an admin to set it in Settings.'
            )}
          </Text>
        </div>
      ) : (
        <div className="flex items-center gap-2.5 rounded-lg border border-muted bg-gray-0 px-3 py-2 dark:bg-gray-50">
          <Avatar name={selected.name} size="sm" className="shrink-0" />
          <div className="min-w-0 flex-1">
            <Text className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
              {selected.name}
            </Text>
            {(selected.email || selected.role) && (
              <Text className="truncate text-xs text-gray-500">
                {[roleLabel(selected.role, t), selected.email].filter(Boolean).join(' · ')}
              </Text>
            )}
          </div>
        </div>
      )}

      {error && selected?.id && (
        <Text className="text-xs text-gray-500">
          {t('messages.bugReport.recipientResolveFallback', 'Showing configured recipient id.')}
        </Text>
      )}

      <Text className="text-xs text-gray-500">
        {t(
          'messages.bugReport.recipientLockedHint',
          'Reports are sent to your organization support inbox. Recipient is configured by an admin.'
        )}
      </Text>
    </div>
  );
}
