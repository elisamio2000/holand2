'use client';

import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Button, Loader, Select, Switch, Text, Title } from 'rizzui';
import { PiBugBold, PiFloppyDiskBold, PiWarningBold } from 'react-icons/pi';
import { useTranslation } from 'react-i18next';
import { useSession } from 'next-auth/react';
import { adminService } from '@/services/admin.service';
import RecipientSearchInput from '@/app/shared/messages/components/recipient-search-input';
import type { UserSummary } from '@/types/messages.types';
import type { BugReportDeliveryChannel } from '@/app/shared/bug-reporter/config/bug-report-config';

type BugReportSettingsSectionProps = {
  /** When parent saves all system settings, these keys are included if present */
  onDraftChange?: (patch: Record<string, unknown>) => void;
};

export default function BugReportSettingsSection({ onDraftChange }: BugReportSettingsSectionProps) {
  const { t } = useTranslation();
  const { data: session } = useSession();
  const currentUserId = session?.user?.id ?? '';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enabled, setEnabled] = useState(true);
  const [defaultChannel, setDefaultChannel] = useState<BugReportDeliveryChannel>('email');
  const [recipient, setRecipient] = useState<UserSummary[]>([]);

  const emitDraft = useCallback(
    (patch: {
      enabled: boolean;
      defaultChannel: BugReportDeliveryChannel;
      recipient: UserSummary[];
    }) => {
      onDraftChange?.({
        bug_report_enabled: patch.enabled,
        bug_report_default_channel: patch.defaultChannel,
        bug_report_recipient: patch.recipient[0]?.id ?? '',
      });
    },
    [onDraftChange]
  );

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = (await adminService.getSystemSettings()) as Record<string, unknown>;
      if (typeof data.bug_report_enabled === 'boolean') {
        setEnabled(data.bug_report_enabled);
      }
      if (data.bug_report_default_channel === 'chat' || data.bug_report_default_channel === 'email') {
        setDefaultChannel(data.bug_report_default_channel);
      }
      const recipientId =
        typeof data.bug_report_recipient === 'string' ? data.bug_report_recipient.trim() : '';
      if (recipientId) {
        setRecipient([{ id: recipientId, name: recipientId }]);
      } else {
        setRecipient([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load bug report settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    if (!loading) {
      emitDraft({ enabled, defaultChannel, recipient });
    }
  }, [enabled, defaultChannel, recipient, loading, emitDraft]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await adminService.updateSystemSettings({
        bug_report_enabled: enabled,
        bug_report_recipient: recipient[0]?.id ?? '',
        bug_report_default_channel: defaultChannel,
      });
      toast.success(t('settingsPage.bugReport.saveSuccess', 'Bug report settings saved'));
      await loadSettings();
    } catch (err) {
      console.error('[BugReportSettings] save failed:', err);
      toast.error(t('settingsPage.bugReport.saveError', 'Failed to save bug report settings'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-lg border border-muted p-6">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 dark:bg-amber-950/30">
          <PiBugBold className="h-5 w-5 text-amber-600" />
        </div>
        <div>
          <Title as="h4" className="font-semibold text-gray-900 dark:text-gray-700">
            {t('settingsPage.bugReport.title', 'Bug Report')}
          </Title>
          <Text className="text-sm text-gray-500 dark:text-gray-400">
            {t(
              'settingsPage.bugReport.desc',
              'Configure where user bug reports are delivered. End users cannot change the recipient.'
            )}
          </Text>
        </div>
      </div>

      {loading && (
        <div className="flex min-h-[120px] items-center justify-center">
          <Loader variant="spinner" size="lg" />
        </div>
      )}

      {error && !loading && (
        <div className="rounded-lg border border-dashed border-orange-300 bg-orange-50 p-4 dark:border-orange-800 dark:bg-orange-950/30">
          <div className="flex items-center gap-2">
            <PiWarningBold className="h-5 w-5 text-orange-500" />
            <Text className="text-sm text-orange-700 dark:text-orange-400">{error}</Text>
          </div>
        </div>
      )}

      {!loading && !error && (
        <>
          <div className="space-y-5">
            <div className="flex items-center justify-between rounded-lg border border-muted px-4 py-3">
              <div>
                <Text className="text-sm font-medium">
                  {t('settingsPage.bugReport.enabled', 'Enable bug reports')}
                </Text>
                <Text className="text-xs text-gray-500">
                  {t('settingsPage.bugReport.enabledHint', 'Show the bug reporter in the header help menu')}
                </Text>
              </div>
              <Switch checked={enabled} onChange={() => setEnabled((v) => !v)} />
            </div>

            <RecipientSearchInput
              id="bug-report-recipient"
              label={t('settingsPage.bugReport.recipient', 'Support recipient')}
              value={recipient}
              onChange={setRecipient}
              single
              currentUserId={currentUserId}
              placeholder={t(
                'settingsPage.bugReport.recipientPlaceholder',
                'Search users by name or email…'
              )}
            />

            <Select
              label={t('settingsPage.bugReport.defaultChannel', 'Default delivery channel')}
              options={[
                { label: t('messages.bugReport.channelEmail', 'Email (Recommended)'), value: 'email' },
                { label: t('messages.bugReport.channelChat', 'Chat Message'), value: 'chat' },
              ]}
              value={defaultChannel}
              onChange={(val: string) => setDefaultChannel(val as BugReportDeliveryChannel)}
              getOptionValue={(option) => option.value}
              displayValue={(selected: string) =>
                selected === 'chat'
                  ? t('messages.bugReport.channelChat', 'Chat Message')
                  : t('messages.bugReport.channelEmail', 'Email (Recommended)')
              }
            />
          </div>

          <div className="mt-6 flex justify-end">
            <Button onClick={() => void handleSave()} isLoading={saving}>
              <PiFloppyDiskBold className="me-1.5 h-4 w-4" />
              {t('settingsPage.bugReport.save', 'Save Bug Report Settings')}
            </Button>
          </div>
        </>
      )}
    </section>
  );
}
