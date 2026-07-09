'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { useTheme } from 'next-themes';
import { useTranslation } from 'react-i18next';
import { Button, Switch, Text, Title } from 'rizzui';
import cn from '@core/utils/class-names';
import { PiArrowRightBold, PiCheckBold } from 'react-icons/pi';
import { routes } from '@/config/routes';
import LightMode from '@core/components/icons/light-mode';
import DarkMode from '@core/components/icons/dark-mode';
import { usePresets } from '@/config/color-presets';
import {
  getEffectiveWorkspaceBranding,
  getGlobalWorkspaceBranding,
  getWorkspaceBranding,
  setGlobalWorkspaceBranding,
  setWorkspaceBranding,
  type WorkspaceBranding,
  type WorkspaceThemeMode,
} from '@/lib/workspace-branding';
import AppDirection from '@/layouts/settings/app-direction';
import LayoutSwitcher from '@/layouts/layout-switcher';
import { workspaceService } from '@/services/workspace.service';
import {
  useColorPresetName,
  useColorPresets,
} from '@/layouts/settings/use-theme-color';
import WorkspaceSettingsStickyFooter from '@/app/shared/workspace/components/workspace-settings-sticky-footer';

interface WorkspaceAppearancePanelProps {
  workspaceId?: string;
  mode: 'global' | 'workspace';
}

function resolvePresetName(presets: ReturnType<typeof usePresets>, name: string) {
  return presets.find((p) => p.name.toLowerCase() === name.toLowerCase())?.name ?? name;
}

export default function WorkspaceAppearancePanel({
  workspaceId,
  mode,
}: WorkspaceAppearancePanelProps) {
  const { t } = useTranslation();
  const { theme, setTheme } = useTheme();
  const presets = usePresets();
  const { colorPresetName, setColorPresetName } = useColorPresetName();
  const { setColorPresets } = useColorPresets();

  const readSaved = useCallback((): WorkspaceBranding => {
    if (mode === 'global') return getGlobalWorkspaceBranding();
    return getEffectiveWorkspaceBranding(workspaceId!);
  }, [mode, workspaceId]);

  const savedRef = useRef(readSaved());
  const [branding, setBranding] = useState<WorkspaceBranding>(() => readSaved());
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const applyToUi = useCallback(
    (b: WorkspaceBranding) => {
      setTheme(b.themeMode);
      const preset = presets.find(
        (p) => p.name.toLowerCase() === b.colorPresetName.toLowerCase()
      );
      if (preset) {
        setColorPresetName(preset.name);
        setColorPresets(preset.colors);
      }
    },
    [presets, setColorPresetName, setColorPresets, setTheme]
  );

  useEffect(() => {
    const saved = readSaved();
    savedRef.current = saved;
    setBranding(saved);
    if (mode === 'global' || !saved.useGlobalAppearance) {
      applyToUi(saved);
    }
  }, [applyToUi, mode, readSaved, workspaceId]);

  const disabled = mode === 'workspace' && branding.useGlobalAppearance;

  const currentSnapshot = useMemo((): WorkspaceBranding => {
    const resolvedName = resolvePresetName(presets, colorPresetName ?? branding.colorPresetName);
    const themeMode = (theme ?? branding.themeMode) as WorkspaceThemeMode;
    return {
      ...branding,
      colorPresetName: resolvedName,
      themeMode,
    };
  }, [branding, colorPresetName, presets, theme]);

  useEffect(() => {
    const saved = savedRef.current;
    const changed =
      currentSnapshot.themeMode !== saved.themeMode ||
      currentSnapshot.colorPresetName.toLowerCase() !== saved.colorPresetName.toLowerCase() ||
      currentSnapshot.useGlobalAppearance !== saved.useGlobalAppearance;
    setDirty(changed);
  }, [currentSnapshot]);

  const previewChange = (partial: Partial<WorkspaceBranding>) => {
    if (disabled) return;
    const next = { ...currentSnapshot, ...partial, useGlobalAppearance: false };
    setBranding(next);
    applyToUi(next);
    if (mode === 'workspace' && workspaceId) {
      setWorkspaceBranding(workspaceId, {
        ...partial,
        useGlobalAppearance: false,
      });
    } else if (mode === 'global') {
      setGlobalWorkspaceBranding(next);
    }
  };

  const handleThemeMode = (value: WorkspaceThemeMode) => {
    previewChange({ themeMode: value });
  };

  const handleColorPreset = (name: string) => {
    const preset = presets.find((p) => p.name === name);
    if (!preset) return;
    setColorPresetName(preset.name);
    setColorPresets(preset.colors);
    previewChange({ colorPresetName: preset.name });
  };

  const handleUseGlobal = (checked: boolean) => {
    if (mode !== 'workspace' || !workspaceId) return;
    const next = { ...getWorkspaceBranding(workspaceId), useGlobalAppearance: checked };
    setWorkspaceBranding(workspaceId, { useGlobalAppearance: checked });
    setBranding(next);
    if (checked) {
      const global = getGlobalWorkspaceBranding();
      applyToUi(global);
      savedRef.current = { ...next, ...global };
      setDirty(false);
    } else {
      applyToUi(getEffectiveWorkspaceBranding(workspaceId));
      savedRef.current = readSaved();
    }
  };

  const handleSave = async () => {
    setSaving(true);
    const next: WorkspaceBranding = {
      ...currentSnapshot,
      useGlobalAppearance: mode === 'workspace' ? branding.useGlobalAppearance : false,
    };
    try {
      if (mode === 'global') {
        setGlobalWorkspaceBranding(next);
        await workspaceService.saveGlobalWorkspaceDefaults(next);
      } else if (workspaceId) {
        setWorkspaceBranding(workspaceId, next);
        await workspaceService.saveWorkspaceBranding(workspaceId, next);
      }
      applyToUi(next);
      savedRef.current = next;
      setBranding(next);
      toast.success(t('workspace.branding.saved'));
      setDirty(false);
    } catch {
      toast.error(t('workspace.branding.saveError'));
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    const saved = savedRef.current;
    setBranding(saved);
    applyToUi(saved);
    if (mode === 'workspace' && workspaceId) {
      setWorkspaceBranding(workspaceId, saved);
    } else if (mode === 'global') {
      setGlobalWorkspaceBranding(saved);
    }
    setDirty(false);
  };

  const themeModes: { value: WorkspaceThemeMode; label: string }[] = [
    { value: 'system', label: t('workspace.branding.themeSystem') },
    { value: 'light', label: t('workspace.branding.themeLight') },
    { value: 'dark', label: t('workspace.branding.themeDark') },
  ];

  return (
    <div className="space-y-6">
      {mode === 'workspace' && workspaceId && (
        <Link
          href={routes.workspace.settings(workspaceId, 'general')}
          className="flex w-fit items-center gap-1 text-xs text-primary hover:underline"
        >
          {t('workspace.appearance.seeBrandingHint')}
          <PiArrowRightBold className="h-3 w-3 rtl:rotate-180" />
        </Link>
      )}

      {mode === 'workspace' && (
        <div className="flex items-center justify-between rounded-lg border border-muted bg-gray-50/80 p-4 dark:bg-gray-100/40">
          <div>
            <Text className="text-sm font-medium">{t('workspace.appearance.useGlobal')}</Text>
            <Text className="text-xs text-gray-500">{t('workspace.appearance.useGlobalHint')}</Text>
          </div>
          <Switch
            checked={branding.useGlobalAppearance}
            onChange={(e) => handleUseGlobal(e.target.checked)}
          />
        </div>
      )}

      <div className={cn(disabled && 'pointer-events-none opacity-50')}>
        <div className="grid gap-6 @3xl:grid-cols-2">
          <div className="rounded-lg border border-muted bg-gray-50/50 p-5 dark:bg-gray-100/30">
            <Title as="h5" className="mb-1 text-sm font-semibold">
              {t('workspace.appearance.themeSection')}
            </Title>
            <Text className="mb-4 text-xs text-gray-500">{t('workspace.appearance.themeHint')}</Text>
            <div className="grid grid-cols-2 gap-3">
              {(['light', 'dark'] as const).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => handleThemeMode(item)}
                  className={cn(
                    'flex flex-col items-center rounded-lg border-2 p-2 transition-colors',
                    currentSnapshot.themeMode === item
                      ? 'border-primary bg-primary/5'
                      : 'border-muted hover:border-primary/40'
                  )}
                >
                  <span className="mb-2 inline-flex rounded-lg">
                    {item === 'light' ? (
                      <LightMode aria-label="Light" className="h-auto w-full max-w-[120px]" />
                    ) : (
                      <DarkMode aria-label="Dark" className="h-auto w-full max-w-[120px]" />
                    )}
                  </span>
                  <span className="text-xs font-medium capitalize">{item}</span>
                </button>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {themeModes.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => handleThemeMode(m.value)}
                  className={cn(
                    'rounded-md border px-3 py-1.5 text-xs font-medium',
                    currentSnapshot.themeMode === m.value
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-muted text-gray-600 hover:bg-gray-50'
                  )}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-muted bg-gray-50/50 p-5 dark:bg-gray-100/30">
            <Title as="h5" className="mb-1 text-sm font-semibold">
              {t('workspace.appearance.colorSection')}
            </Title>
            <Text className="mb-4 text-xs text-gray-500">{t('workspace.appearance.colorHint')}</Text>
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 @xl:grid-cols-5">
              {presets.map((preset) => {
                const selected =
                  currentSnapshot.colorPresetName.toLowerCase() === preset.name.toLowerCase();
                return (
                  <button
                    key={preset.name}
                    type="button"
                    title={preset.name}
                    onClick={() => handleColorPreset(preset.name)}
                    className={cn(
                      'flex flex-col items-center gap-1.5 rounded-lg border-2 p-2 transition-colors',
                      selected ? 'border-primary ring-2 ring-primary/20' : 'border-transparent hover:border-primary/30'
                    )}
                  >
                    <span
                      className="grid h-10 w-full place-content-center rounded-md"
                      style={{ backgroundColor: preset.colors.default }}
                    >
                      <PiCheckBold
                        className={cn('h-5 w-5', selected ? 'text-white' : 'text-transparent')}
                      />
                    </span>
                    <span className="text-[10px] font-medium text-gray-600">{preset.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-lg border border-muted bg-gray-50/50 p-5 dark:bg-gray-100/30">
            <Title as="h5" className="mb-3 text-sm font-semibold">
              {t('workspace.appearance.layoutSection')}
            </Title>
            <LayoutSwitcher />
          </div>

          <div className="rounded-lg border border-muted bg-gray-50/50 p-5 dark:bg-gray-100/30">
            <Title as="h5" className="mb-3 text-sm font-semibold">
              {t('workspace.appearance.directionSection')}
            </Title>
            <AppDirection />
          </div>
        </div>
      </div>

      <WorkspaceSettingsStickyFooter
        hint={
          mode === 'global'
            ? t('workspace.appearance.globalHint')
            : t('workspace.appearance.workspaceHint')
        }
        dirty={dirty}
        saving={saving}
        cancelLabel={t('common.cancel')}
        saveLabel={t('workspace.general.save')}
        onCancel={handleCancel}
        onSave={() => void handleSave()}
      />
    </div>
  );
}
