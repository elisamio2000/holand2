'use client';

import { useEffect } from 'react';
import { useTheme } from 'next-themes';
import { useTranslation } from 'react-i18next';
import { LAYOUT_OPTIONS } from '@/config/enums';
import { useLayout } from '@/layouts/use-layout';
import { platformService } from '@/services/platform.service';

const LANGUAGE_KEY = 'preferred-language';
const THEME_APPLIED_KEY = 'platform-defaults-theme-applied';
const LAYOUT_APPLIED_KEY = 'platform-defaults-layout-applied';

/**
 * Apply platform defaults when the user has no saved preferences.
 */
export function usePlatformDefaults(): void {
  const { setTheme, theme, systemTheme } = useTheme();
  const { setLayout, layout } = useLayout();
  const { i18n } = useTranslation();

  useEffect(() => {
    let cancelled = false;

    async function applyDefaults() {
      try {
        const defaults = await platformService.getDefaults();
        if (cancelled) return;

        const storedLanguage =
          typeof window !== 'undefined' ? localStorage.getItem(LANGUAGE_KEY) : null;
        if (!storedLanguage && defaults.language) {
          await i18n.changeLanguage(defaults.language);
          localStorage.setItem(LANGUAGE_KEY, defaults.language);
        }

        const layoutStored =
          typeof window !== 'undefined' ? localStorage.getItem('holand-layout') : null;
        if (!layoutStored && defaults.layout) {
          const normalized = defaults.layout as LAYOUT_OPTIONS;
          if (Object.values(LAYOUT_OPTIONS).includes(normalized)) {
            setLayout(normalized);
            localStorage.setItem(LAYOUT_APPLIED_KEY, '1');
          }
        }

        const themeApplied =
          typeof window !== 'undefined' ? localStorage.getItem(THEME_APPLIED_KEY) : null;
        const currentTheme = theme === 'system' ? systemTheme : theme;
        if (!themeApplied && defaults.theme && !currentTheme) {
          setTheme(defaults.theme);
          localStorage.setItem(THEME_APPLIED_KEY, '1');
        }
      } catch (error) {
        console.warn('[usePlatformDefaults] Could not apply defaults:', error);
      }
    }

    applyDefaults();
    return () => {
      cancelled = true;
    };
  }, [i18n, layout, setLayout, setTheme, systemTheme, theme]);
}

/**
 * Mount once near app root to apply platform defaults for new visitors.
 */
export default function PlatformDefaultsApplier() {
  usePlatformDefaults();
  return null;
}
