// ============================================
// SettingsManagement â€” System & LLM Settings page
// Fetches and displays real settings from backend Gateway
// ============================================

'use client';

import { useCallback, useEffect, useState } from 'react';

import toast from 'react-hot-toast';
import { Button, Input, Loader, Switch, Text, Title, Select } from 'rizzui';
import {
  PiGearBold,
  PiRobotBold,
  PiFloppyDiskBold,
  PiArrowCounterClockwiseBold,
  PiWarningBold,
} from 'react-icons/pi';

import cn from '@core/utils/class-names';

import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { routes } from '@/config/routes';
import { adminService } from '@/services/admin.service';
import BugReportSettingsSection from './bug-report-settings-section';
import type {
  SystemSettingItem,
  LLMSettingsResponse,
} from '@/types/auth.types';

/**
 * Convert a flat settings object from backend into SystemSettingItem[] for display.
 *
 * Backend returns: { system_name: "Holand", maintenance_mode: false, max_upload_size_mb: 100, ... }
 * We infer the type from the JS value type.
 */
function flatObjectToSettingItems(obj: Record<string, unknown>): SystemSettingItem[] {
  return Object.entries(obj).map(([key, value]) => {
    let type: SystemSettingItem['type'] = 'string';
    if (typeof value === 'boolean') type = 'boolean';
    else if (typeof value === 'number') type = 'number';
    else if (typeof value === 'object' && value !== null) type = 'json';
    return { id: key, key, value, type };
  });
}

/**
 * SettingsManagement â€” Admin-level system settings page.
 *
 * @param section - Which block to render: system, llm, or all (default all).
 */
export type SettingsManagementSection = 'system' | 'llm' | 'all';

interface SettingsManagementProps {
  section?: SettingsManagementSection;
}

export default function SettingsManagement({ section = 'all' }: SettingsManagementProps) {
  const { t } = useTranslation();
  // ---- System Settings State ----
  const [systemSettings, setSystemSettings] = useState<SystemSettingItem[]>([]);
  const [systemLoading, setSystemLoading] = useState(true);
  const [systemError, setSystemError] = useState<string | null>(null);
  const [systemSaving, setSystemSaving] = useState(false);
  const [editedSystemValues, setEditedSystemValues] = useState<Record<string, unknown>>({});

  // ---- LLM Settings State ----
  const [llmSettings, setLlmSettings] = useState<LLMSettingsResponse | null>(null);
  const [llmLoading, setLlmLoading] = useState(true);
  const [llmError, setLlmError] = useState<string | null>(null);
  const [llmSaving, setLlmSaving] = useState(false);
  const [editedLlmValues, setEditedLlmValues] = useState<Record<string, unknown>>({});

  /** Fetch system settings from Gateway and initialize edit state */
  const fetchSystemSettings = useCallback(async () => {
    console.info('[SettingsManagement] Fetching system settings...');
    setSystemLoading(true);
    setSystemError(null);
    try {
      const data = await adminService.getSystemSettings();
      // Backend returns flat object â€” convert to SystemSettingItem[] for display
      let settings: SystemSettingItem[];
      if (Array.isArray(data)) {
        settings = data as SystemSettingItem[];
      } else if (typeof data === 'object' && data !== null) {
        settings = flatObjectToSettingItems(data as Record<string, unknown>).filter(
          (s) => !s.key.startsWith('bug_report_')
        );
      } else {
        settings = [];
      }
      setSystemSettings(settings);
      // Initialize edited values
      const values: Record<string, unknown> = {};
      settings.forEach((s) => {
        values[s.key] = s.value;
      });
      setEditedSystemValues(values);
      console.info('[SettingsManagement] System settings loaded:', { count: settings.length });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load system settings';
      console.error('[SettingsManagement] System settings error:', err);
      setSystemError(msg);
    } finally {
      setSystemLoading(false);
    }
  }, []);

  /** Fetch LLM model settings from Gateway and initialize edit state */
  const fetchLlmSettings = useCallback(async () => {
    console.info('[SettingsManagement] Fetching LLM settings...');
    setLlmLoading(true);
    setLlmError(null);
    try {
      const data = await adminService.getLLMSettings();
      setLlmSettings(data);
      setEditedLlmValues({
        default_model: data.default_model,
        temperature: data.temperature ?? 0.7,
        max_tokens: data.max_tokens ?? 4096,
      });
      console.info('[SettingsManagement] LLM settings loaded:', {
        default_model: data.default_model,
        modelCount: (data.available_models || data.models)?.length,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load LLM settings';
      console.error('[SettingsManagement] LLM settings error:', err);
      setLlmError(msg);
    } finally {
      setLlmLoading(false);
    }
  }, []);

  useEffect(() => {
    if (section === 'all' || section === 'system') {
      fetchSystemSettings();
    }
    if (section === 'all' || section === 'llm') {
      fetchLlmSettings();
    }
  }, [fetchSystemSettings, fetchLlmSettings, section]);

  /** Save edited system settings to backend via PATCH /admin/settings */
  const handleSaveSystemSettings = async () => {
    console.info('[SettingsManagement] Saving system settings:', { keys: Object.keys(editedSystemValues) });
    setSystemSaving(true);
    try {
      await adminService.updateSystemSettings(editedSystemValues as Record<string, unknown>);
      toast.success(t('settingsPage.saveSystemSuccess'));
      console.info('[SettingsManagement] System settings saved');
      await fetchSystemSettings();
    } catch (err: unknown) {
      console.error('[SettingsManagement] Failed to save system settings:', err);
      toast.error(t('settingsPage.saveSystemError'));
    } finally {
      setSystemSaving(false);
    }
  };

  /** Save edited LLM settings to backend via PATCH /admin/settings/llm */
  const handleSaveLlmSettings = async () => {
    console.info('[SettingsManagement] Saving LLM settings:', editedLlmValues);
    setLlmSaving(true);
    try {
      await adminService.updateLLMSettings(editedLlmValues as Record<string, unknown>);
      toast.success(t('settingsPage.saveLlmSuccess'));
      console.info('[SettingsManagement] LLM settings saved');
      await fetchLlmSettings();
    } catch (err: unknown) {
      console.error('[SettingsManagement] Failed to save LLM settings:', err);
      toast.error(t('settingsPage.saveLlmError'));
    } finally {
      setLlmSaving(false);
    }
  };

  /**
   * Render a single system setting field based on its type.
   * Supports: boolean (Switch), select (Select), text (Input), number (Input).
   */
  const renderSettingField = (setting: SystemSettingItem) => {
    const currentValue = editedSystemValues[setting.key];

    switch (setting.type) {
      case 'boolean':
        return (
          <div
            key={setting.key}
            className="flex items-center justify-between rounded-lg border border-muted px-4 py-3"
          >
            <div>
              <Text className="text-sm font-medium">{setting.key}</Text>
              {setting.description && (
                <Text className="text-xs text-gray-500 dark:text-gray-400">
                  {setting.description}
                </Text>
              )}
            </div>
            <Switch
              checked={Boolean(currentValue)}
              onChange={() =>
                setEditedSystemValues((prev) => ({
                  ...prev,
                  [setting.key]: !prev[setting.key],
                }))
              }
            />
          </div>
        );
      case 'number':
        return (
          <div key={setting.key}>
            <Input
              label={setting.key}
              type="number"
              value={String(currentValue ?? '')}
              onChange={(e) =>
                setEditedSystemValues((prev) => ({
                  ...prev,
                  [setting.key]: Number(e.target.value),
                }))
              }
              helperText={setting.description}
            />
          </div>
        );
      case 'json':
        return (
          <div key={setting.key}>
            <Text className="mb-1 text-sm font-medium">{setting.key}</Text>
            {setting.description && (
              <Text className="mb-2 text-xs text-gray-500 dark:text-gray-400">
                {setting.description}
              </Text>
            )}
            <textarea
              className="w-full rounded-md border border-muted bg-gray-0 px-3 py-2 font-mono text-xs dark:bg-gray-50"
              rows={4}
              value={
                typeof currentValue === 'string'
                  ? currentValue
                  : JSON.stringify(currentValue, null, 2)
              }
              onChange={(e) =>
                setEditedSystemValues((prev) => {
                  try {
                    return { ...prev, [setting.key]: JSON.parse(e.target.value) };
                  } catch {
                    return { ...prev, [setting.key]: e.target.value };
                  }
                })
              }
            />
          </div>
        );
      default: // string
        return (
          <div key={setting.key}>
            <Input
              label={setting.key}
              value={String(currentValue ?? '')}
              onChange={(e) =>
                setEditedSystemValues((prev) => ({
                  ...prev,
                  [setting.key]: e.target.value,
                }))
              }
              helperText={setting.description}
            />
          </div>
        );
    }
  };

  return (
    <div className="space-y-8">
      {(section === 'all' || section === 'system') && (
        <>
          <section className="rounded-lg border border-muted p-6">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-950/30">
            <PiGearBold className="h-5 w-5 text-blue-500" />
          </div>
          <div>
            <Title as="h4" className="font-semibold text-gray-900 dark:text-gray-700">
              {t('settingsPage.systemSettings')}
            </Title>
            <Text className="text-sm text-gray-500 dark:text-gray-400">
              {t('settingsPage.systemSettingsDesc')}
            </Text>
          </div>
        </div>

        {systemLoading && (
          <div className="flex min-h-[120px] items-center justify-center">
            <Loader variant="spinner" size="lg" />
          </div>
        )}

        {systemError && (
          <div className="rounded-lg border border-dashed border-orange-300 bg-orange-50 p-4 dark:border-orange-800 dark:bg-orange-950/30">
            <div className="flex items-center gap-2">
              <PiWarningBold className="h-5 w-5 text-orange-500" />
              <Text className="text-sm text-orange-700 dark:text-orange-400">
                {systemError}
              </Text>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={fetchSystemSettings}
            >
              <PiArrowCounterClockwiseBold className="me-1 h-4 w-4" />
              {t('settingsPage.retry')}
            </Button>
          </div>
        )}

        {!systemLoading && !systemError && systemSettings.length === 0 && (
          <Text className="text-sm text-gray-400">{t('settingsPage.noSettings')}</Text>
        )}

        {!systemLoading && !systemError && systemSettings.length > 0 && (
          <>
            <div className="space-y-4">
              {systemSettings.map((setting) => renderSettingField(setting))}
            </div>
            <div className="mt-6 flex justify-end">
              <Button
                onClick={handleSaveSystemSettings}
                isLoading={systemSaving}
              >
                <PiFloppyDiskBold className="me-1.5 h-4 w-4" />
                {t('settingsPage.saveSystem')}
              </Button>
            </div>
          </>
        )}
      </section>

      <BugReportSettingsSection />
        </>
      )}

      {(section === 'all' || section === 'llm') && (
      <section className="rounded-lg border border-muted p-6">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-50 dark:bg-purple-950/30">
            <PiRobotBold className="h-5 w-5 text-purple-500" />
          </div>
          <div>
            <Title as="h4" className="font-semibold text-gray-900 dark:text-gray-700">
              {t('settingsPage.llmConfig')}
            </Title>
            <Text className="text-sm text-gray-500 dark:text-gray-400">
              {t('settingsPage.llmConfigDesc')}
            </Text>
          </div>
        </div>

        {llmLoading && (
          <div className="flex min-h-[120px] items-center justify-center">
            <Loader variant="spinner" size="lg" />
          </div>
        )}

        {llmError && (
          <div className="rounded-lg border border-dashed border-orange-300 bg-orange-50 p-4 dark:border-orange-800 dark:bg-orange-950/30">
            <div className="flex items-center gap-2">
              <PiWarningBold className="h-5 w-5 text-orange-500" />
              <Text className="text-sm text-orange-700 dark:text-orange-400">
                {llmError}
              </Text>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={fetchLlmSettings}
            >
              <PiArrowCounterClockwiseBold className="me-1 h-4 w-4" />
              {t('settingsPage.retry')}
            </Button>
          </div>
        )}

        {!llmLoading && !llmError && llmSettings && (
          <>
            <div className="space-y-5">
              {/* Default Model */}
              <Select
                label={t('settingsPage.defaultModel')}
                helperText={t('settingsPage.defaultModelLegacyHint')}
                options={(llmSettings.available_models || llmSettings.models || []).map((m) => ({ label: m, value: m }))}
                value={String(editedLlmValues.default_model ?? llmSettings.default_model)}
                onChange={(val: string) =>
                  setEditedLlmValues((prev) => ({ ...prev, default_model: val }))
                }
                getOptionValue={(option: { value: string }) => option.value}
                displayValue={(selected: string) => selected}
              />
              <Link
                href={`${routes.admin.pipeline}?tab=topology&view=list&section=routes`}
                className="text-sm text-primary underline"
              >
                {t('settingsPage.manageRoutesInstead')}
              </Link>

              {/* Temperature */}
              <div>
                <Text className="mb-1 text-sm font-medium">
                  {t('settingsPage.temperature')}: {Number(editedLlmValues.temperature ?? 0.7).toFixed(2)}
                </Text>
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.05"
                  value={Number(editedLlmValues.temperature ?? 0.7)}
                  onChange={(e) =>
                    setEditedLlmValues((prev) => ({
                      ...prev,
                      temperature: parseFloat(e.target.value),
                    }))
                  }
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-400">
                  <span>{t('settingsPage.temperatureMin')}</span>
                  <span>{t('settingsPage.temperatureMax')}</span>
                </div>
              </div>

              {/* Max Tokens */}
              <Input
                label={t('settingsPage.maxTokens')}
                type="number"
                value={String(editedLlmValues.max_tokens ?? 4096)}
                onChange={(e) =>
                  setEditedLlmValues((prev) => ({
                    ...prev,
                    max_tokens: parseInt(e.target.value, 10) || 4096,
                  }))
                }
                helperText={t('settingsPage.maxTokensHelper')}
              />

              {/* Available Models (read-only list) */}
              <div>
                <Text className="mb-2 text-sm font-medium">{t('settingsPage.availableModels')}</Text>
                <div className="flex flex-wrap gap-2">
                  {(llmSettings.available_models || llmSettings.models || []).map((model) => (
                    <span
                      key={model}
                      className={cn(
                        'rounded-md border px-3 py-1.5 text-xs font-medium',
                        model === editedLlmValues.default_model
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-muted text-gray-500 dark:text-gray-400'
                      )}
                    >
                      {model}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-6 flex justify-end">
              <Button
                onClick={handleSaveLlmSettings}
                isLoading={llmSaving}
              >
                <PiFloppyDiskBold className="me-1.5 h-4 w-4" />
                {t('settingsPage.saveLlm')}
              </Button>
            </div>
          </>
        )}
      </section>
      )}
    </div>
  );
}

