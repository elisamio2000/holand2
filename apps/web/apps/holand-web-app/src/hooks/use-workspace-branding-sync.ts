'use client';

import { useEffect, useRef } from 'react';
import { useTheme } from 'next-themes';
import { usePresets } from '@/config/color-presets';
import {
  captureGlobalThemeToWorkspace,
  getEffectiveWorkspaceBranding,
  getGlobalWorkspaceBranding,
} from '@/lib/workspace-branding';
import { useWorkspace } from '@/contexts/workspace-context';
import {
  useApplyColorPreset,
  useColorPresetName,
  useColorPresets,
} from '@/layouts/settings/use-theme-color';

/**
 * Persists theme when leaving a workspace and restores effective branding on enter.
 */
export function useWorkspaceBrandingSync() {
  const { activeWorkspace } = useWorkspace();
  const { setTheme } = useTheme();
  const presets = usePresets();
  const { colorPresetName, setColorPresetName } = useColorPresetName();
  const { colorPresets, setColorPresets } = useColorPresets();
  const prevIdRef = useRef<string | null>(null);

  const effective = activeWorkspace
    ? getEffectiveWorkspaceBranding(activeWorkspace.id)
    : getGlobalWorkspaceBranding();

  const colorsToApply =
    presets.find((p) => p.name === effective.colorPresetName)?.colors ??
    colorPresets ??
    presets[0].colors;

  useApplyColorPreset(colorsToApply);

  useEffect(() => {
    const prev = prevIdRef.current;
    if (prev && prev !== activeWorkspace?.id) {
      captureGlobalThemeToWorkspace(prev);
    }

    const branding = activeWorkspace
      ? getEffectiveWorkspaceBranding(activeWorkspace.id)
      : getGlobalWorkspaceBranding();

    const preset = presets.find((p) => p.name === branding.colorPresetName);
    if (preset) {
      setColorPresetName(preset.name);
      setColorPresets(preset.colors);
    }
    setTheme(branding.themeMode ?? 'system');

    prevIdRef.current = activeWorkspace?.id ?? null;
  }, [activeWorkspace?.id, presets, setColorPresetName, setColorPresets, setTheme]);
}
