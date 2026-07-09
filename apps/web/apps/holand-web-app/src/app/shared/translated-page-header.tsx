// ============================================
// TranslatedPageHeader — i18n-aware page header wrapper
// Client component that translates title & breadcrumb keys
// using react-i18next before passing to PageHeader.
// Used by server-component page.tsx files that cannot
// call useTranslation() directly.
// ============================================

'use client';

import { useTranslation } from 'react-i18next';
import PageHeader from '@/app/shared/page-header';

/**
 * Props for TranslatedPageHeader.
 * Accepts translation keys instead of raw strings.
 */
export interface TranslatedBreadcrumbItem {
  /** i18n key for breadcrumb name, e.g. 'pages.dashboard' */
  nameKey: string;
  /** Optional href for breadcrumb link */
  href?: string;
}

export interface TranslatedPageHeaderProps {
  /** i18n key for page title, e.g. 'pages.messages' */
  titleKey: string;
  /** Array of breadcrumb items with translation keys */
  breadcrumb: TranslatedBreadcrumbItem[];
  /** Optional className for styling */
  className?: string;
  /** Optional children (e.g. action buttons) */
  children?: React.ReactNode;
}

/**
 * TranslatedPageHeader — Client-side wrapper for PageHeader with i18n support.
 *
 * Resolves translation keys via `t()` before passing to the
 * underlying PageHeader component. This enables server-component
 * page.tsx files to have translated headers without using
 * `useTranslation()` directly.
 *
 * @requires react-i18next — for `useTranslation` hook
 * @requires PageHeader — underlying page header component
 *
 * @example
 * ```tsx
 * <TranslatedPageHeader
 *   titleKey="pages.messages"
 *   breadcrumb={[
 *     { nameKey: 'pages.dashboard', href: '/' },
 *     { nameKey: 'pages.messages' },
 *   ]}
 * />
 * ```
 */
export default function TranslatedPageHeader({
  titleKey,
  breadcrumb,
  className,
  children,
}: TranslatedPageHeaderProps) {
  const { t } = useTranslation();

  return (
    <PageHeader
      title={t(titleKey)}
      breadcrumb={breadcrumb.map((item) => ({
        name: t(item.nameKey),
        ...(item.href && { href: item.href }),
      }))}
      className={className}
    >
      {children}
    </PageHeader>
  );
}
