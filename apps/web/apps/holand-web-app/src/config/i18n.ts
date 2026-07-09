// ============================================
// Holand Platform â€” i18n Configuration
// Bilingual support: English (en) + Persian/Farsi (fa)
// Uses react-i18next with Jotai atom for persistence
// ============================================

'use client';

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from '@/locales/en';
import fa from '@/locales/fa';

/**
 * Supported languages in the platform.
 */
export const LANGUAGES = [
  { code: 'fa', name: 'ÙØ§Ø±Ø³ÛŒ', dir: 'rtl', mark: 'flag', flag: 'ðŸ‡®ðŸ‡·' },
  /** English â€” globe icon (international), not a country flag. */
  { code: 'en', name: 'English', dir: 'ltr', mark: 'international' },
] as const;

export type LanguageCode = (typeof LANGUAGES)[number]['code'];

/**
 * Get the stored language from localStorage.
 * Returns 'en' during SSR â€” the actual stored language is applied
 * client-side via the LanguageProvider useEffect to prevent
 * SSR/client hydration mismatch.
 *
 * NOTE: Keep this as a separate export so LanguageProvider can
 * call it after hydration to restore the user's preferred language.
 */
export function getStoredLanguage(): LanguageCode {
  if (typeof window === 'undefined') return 'en';
  return (localStorage.getItem('Holand_language') as LanguageCode) || 'en';
}

// Always initialize with 'en' so server and client render the same content.
// The LanguageProvider's useEffect switches to the stored language
// after hydration, preventing React hydration mismatch errors.
i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    fa: { translation: fa },
  },
  lng: 'en',
  fallbackLng: 'en',
  /** i18next v25+ â€” hide Locize sponsorship line in the browser console */
  showSupportNotice: false,
  interpolation: {
    escapeValue: false,
  },
  react: {
    useSuspense: false,
  },
});

export default i18n;

