// ============================================
// Holand Platform â€” Language Provider
// Wraps app with react-i18next and syncs direction
// ============================================

'use client';

import { useEffect } from 'react';
import { I18nextProvider, useTranslation } from 'react-i18next';
import i18n, { LANGUAGES, getStoredLanguage, LanguageCode } from '@/config/i18n';

/**
 * LanguageSyncEffect â€” Syncs HTML dir/lang and font based on current language.
 *
 * - Sets `dir="rtl"` and `lang="fa"` for Persian
 * - Sets `dir="ltr"` and `lang="en"` for English
 * - Adds Vazirmatn font for RTL languages
 */
function LanguageSyncEffect() {
  const { i18n: i18nInstance } = useTranslation();
  const currentLang = i18nInstance.language as LanguageCode;
  const langConfig = LANGUAGES.find((l) => l.code === currentLang);

  useEffect(() => {
    const dir = langConfig?.dir || 'ltr';
    const lang = langConfig?.code || 'en';

    document.documentElement.setAttribute('dir', dir);
    document.documentElement.setAttribute('lang', lang);

    // Apply Persian font family when RTL
    if (dir === 'rtl') {
      document.documentElement.style.setProperty(
        '--font-family',
        'var(--font-vazirmatn), var(--font-inter), sans-serif'
      );
      document.body.classList.add('font-vazirmatn');
      document.body.classList.remove('font-inter');
    } else {
      document.documentElement.style.removeProperty('--font-family');
      document.body.classList.add('font-inter');
      document.body.classList.remove('font-vazirmatn');
    }
  }, [currentLang, langConfig]);

  return null;
}

/**
 * LanguageProvider â€” Top-level provider for i18n support.
 *
 * Wraps the app with I18nextProvider and syncs HTML attributes.
 *
 * @example
 * ```tsx
 * <LanguageProvider>
 *   <App />
 * </LanguageProvider>
 * ```
 */
export function LanguageProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // After hydration, restore the user's stored language preference.
    // This runs client-side only, after React has successfully matched
    // the server-rendered HTML (which was always 'en'), preventing
    // the hydration mismatch error.
    const stored = getStoredLanguage();
    if (stored !== i18n.language) {
      console.info('[LanguageProvider] Restoring stored language after hydration:', { stored });
      i18n.changeLanguage(stored);
    }
  }, []);

  return (
    <I18nextProvider i18n={i18n}>
      <LanguageSyncEffect />
      {children}
    </I18nextProvider>
  );
}

/**
 * useLanguage â€” Hook for language switching.
 *
 * Provides current language, direction, and changeLanguage function.
 * Persists selection to localStorage.
 *
 * @returns {object} Language state and controls
 *
 * @example
 * ```tsx
 * const { currentLanguage, changeLanguage, direction } = useLanguage();
 * ```
 */
export function useLanguage() {
  const { i18n: i18nInstance } = useTranslation();

  const currentLanguage = i18nInstance.language as LanguageCode;
  const langConfig = LANGUAGES.find((l) => l.code === currentLanguage);
  const direction = langConfig?.dir || 'ltr';
  const isRTL = direction === 'rtl';

  const changeLanguage = async (lang: LanguageCode) => {
    await i18nInstance.changeLanguage(lang);
    localStorage.setItem('Holand_language', lang);
  };

  return {
    currentLanguage,
    direction,
    isRTL,
    changeLanguage,
    languages: LANGUAGES,
  };
}

