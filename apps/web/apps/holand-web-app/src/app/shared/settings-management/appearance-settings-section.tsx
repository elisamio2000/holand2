'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { Button, Loader, Select, Text, Title } from 'rizzui';
import {
  PiFloppyDiskBold,
  PiArrowCounterClockwiseBold,
  PiWarningBold,
} from 'react-icons/pi';
import { LAYOUT_OPTIONS } from '@/config/enums';
import { adminService } from '@/services/admin.service';
import type { AppearanceSettingsResponse } from '@/types/auth.types';

/**
 * Platform-wide default language, theme, and layout for new users.
 */
export default function AppearanceSettingsSection() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [values, setValues] = useState<AppearanceSettingsResponse | null>(null);

  const languageOptions = useMemo(
    () => [
      { value: 'fa', label: t('adminSettings.languageFa') },
      { value: 'en', label: t('adminSettings.languageEn') },
    ],
    [t]
  );

  const themeOptions = useMemo(
    () => [
      { value: 'light', label: t('adminSettings.themeLight') },
      { value: 'dark', label: t('adminSettings.themeDark') },
      { value: 'system', label: t('adminSettings.themeSystem') },
    ],
    [t]
  );

  const layoutOptions = useMemo(
    () =>
      Object.values(LAYOUT_OPTIONS).map((layout) => ({
        value: layout,
        label: t(`adminSettings.layout.${layout}`, { defaultValue: layout }),
      })),
    [t]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await adminService.getAppearanceSettings();
      setValues(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('adminSettings.loadError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = async () => {
    if (!values) return;
    setSaving(true);
    try {
      await adminService.updateAppearanceSettings(values);
      toast.success(t('adminSettings.appearanceSaveSuccess'));
    } catch (err: unknown) {
      console.error('[AppearanceSettingsSection] Save failed:', err);
      toast.error(t('adminSettings.appearanceSaveError'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center rounded-lg border border-muted p-6">
        <Loader variant="spinner" size="lg" />
      </div>
    );
  }

  if (error || !values) {
    return (
      <div className="rounded-lg border border-dashed border-orange-300 bg-orange-50 p-4 dark:border-orange-800 dark:bg-orange-950/30">
        <div className="flex items-center gap-2">
          <PiWarningBold className="h-5 w-5 text-orange-500" />
          <Text className="text-sm text-orange-700 dark:text-orange-400">
            {error ?? t('adminSettings.loadError')}
          </Text>
        </div>
        <Button variant="outline" size="sm" className="mt-3" onClick={load}>
          <PiArrowCounterClockwiseBold className="me-1 h-4 w-4" />
          {t('settingsPage.retry')}
        </Button>
      </div>
    );
  }

  return (
    <section className="space-y-6 rounded-lg border border-muted p-6">
      <div>
        <Title as="h4" className="font-semibold">
          {t('adminSettings.appearanceTitle')}
        </Title>
        <Text className="text-sm text-gray-500">{t('adminSettings.appearanceDesc')}</Text>
      </div>

      <Select
        label={t('adminSettings.defaultLanguage')}
        options={languageOptions}
        value={values.platform_default_language}
        onChange={(val: string) =>
          setValues((prev) => (prev ? { ...prev, platform_default_language: val } : prev))
        }
        getOptionValue={(o: { value: string }) => o.value}
        displayValue={(selected: string) =>
          languageOptions.find((o) => o.value === selected)?.label ?? selected
        }
      />

      <Select
        label={t('adminSettings.defaultTheme')}
        options={themeOptions}
        value={values.platform_default_theme}
        onChange={(val: string) =>
          setValues((prev) => (prev ? { ...prev, platform_default_theme: val } : prev))
        }
        getOptionValue={(o: { value: string }) => o.value}
        displayValue={(selected: string) =>
          themeOptions.find((o) => o.value === selected)?.label ?? selected
        }
      />

      <Select
        label={t('adminSettings.defaultLayout')}
        options={layoutOptions}
        value={values.platform_default_layout}
        onChange={(val: string) =>
          setValues((prev) => (prev ? { ...prev, platform_default_layout: val } : prev))
        }
        getOptionValue={(o: { value: string }) => o.value}
        displayValue={(selected: string) =>
          layoutOptions.find((o) => o.value === selected)?.label ?? selected
        }
      />

      <div className="flex justify-end">
        <Button onClick={handleSave} isLoading={saving}>
          <PiFloppyDiskBold className="me-1.5 h-4 w-4" />
          {t('adminSettings.appearanceSave')}
        </Button>
      </div>
    </section>
  );
}
