'use client';

import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { Badge, Text, Title } from 'rizzui';
import cn from '@core/utils/class-names';
import { routes } from '@/config/routes';
import {
  LEGAL_DOCUMENT_SECTION_KEYS,
  type LegalDocumentType,
} from '@/app/shared/legal/legal-document-types';

const LEGAL_NAV_ITEMS: { type: LegalDocumentType; labelKey: string }[] = [
  { type: 'help', labelKey: 'authPages.footer.help' },
  { type: 'privacy', labelKey: 'authPages.footer.privacy' },
  { type: 'terms', labelKey: 'authPages.footer.terms' },
];

/**
 * LegalDocumentView — Full legal/help document with TOC, breadcrumbs, and cross-links.
 *
 * @param type - Document slug (`terms`, `privacy`, `help`)
 */
export default function LegalDocumentView({
  type,
}: {
  type: LegalDocumentType;
}) {
  const { t } = useTranslation();
  const prefix = `legal.${type}`;
  const sectionKeys = LEGAL_DOCUMENT_SECTION_KEYS[type];

  return (
    <article className="w-full text-start">
      <nav
        aria-label={t('legal.breadcrumbLabel')}
        className="mb-5 flex flex-wrap items-center gap-1.5 text-sm text-gray-500"
      >
        <Link href={routes.legal.help} className="transition-colors hover:text-primary">
          {t('legal.breadcrumbLegalHub')}
        </Link>
        <span aria-hidden="true">/</span>
        <span className="font-medium text-gray-700">{t(`${prefix}.title`)}</span>
      </nav>

      <div className="lg:grid lg:grid-cols-[minmax(200px,240px)_minmax(0,1fr)] lg:gap-10 xl:gap-12">
        <aside className="mb-6 lg:mb-0">
          <div className="lg:sticky lg:top-6">
            <Text className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
              {t('legal.tocTitle')}
            </Text>
            <nav
              aria-label={t('legal.tocTitle')}
              className="rounded-xl border border-gray-100 bg-white p-3 shadow-sm"
            >
              <ol className="space-y-1">
                {sectionKeys.map((key) => (
                  <li key={key}>
                    <a
                      href={`#legal-section-${key}`}
                      className="block rounded-lg px-2.5 py-2 text-sm text-gray-600 transition-colors hover:bg-gray-50 hover:text-primary"
                    >
                      {t(`${prefix}.sections.${key}.title`)}
                    </a>
                  </li>
                ))}
              </ol>
            </nav>

            <div className="mt-4 hidden rounded-xl border border-gray-100 bg-white p-3 shadow-sm lg:block">
              <Text className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                {t('legal.relatedDocuments')}
              </Text>
              <ul className="space-y-1">
                {LEGAL_NAV_ITEMS.map((item) => (
                  <li key={item.type}>
                    <Link
                      href={routes.legal[item.type]}
                      className={cn(
                        'block rounded-lg px-2.5 py-2 text-sm transition-colors hover:bg-gray-50 hover:text-primary',
                        item.type === type
                          ? 'bg-gray-50 font-semibold text-gray-900'
                          : 'text-gray-600'
                      )}
                      aria-current={item.type === type ? 'page' : undefined}
                    >
                      {t(item.labelKey)}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </aside>

        <div className="min-w-0">
          <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
            <header className="border-b border-gray-100 bg-gradient-to-b from-gray-50/80 to-white px-5 py-6 md:px-8 md:py-8">
              <Badge variant="flat" color="secondary" className="mb-3">
                {t('legal.documentBadge')}
              </Badge>
              <Title as="h1" className="text-2xl font-bold text-gray-900 md:text-3xl">
                {t(`${prefix}.title`)}
              </Title>
              <Text className="mt-2 text-sm text-gray-500">{t(`${prefix}.lastUpdated`)}</Text>
              <Text className="mt-4 max-w-3xl leading-relaxed text-gray-600">
                {t(`${prefix}.intro`)}
              </Text>
            </header>

            <div className="px-5 md:px-8">
              {sectionKeys.map((key) => (
                <section
                  key={key}
                  id={`legal-section-${key}`}
                  className="scroll-mt-24 border-b border-gray-100 py-7 last:border-b-0 md:py-8"
                >
                  <Title
                    as="h2"
                    className="mb-3 text-base font-semibold text-gray-900 md:text-lg"
                  >
                    {t(`${prefix}.sections.${key}.title`)}
                  </Title>
                  <Text className="max-w-3xl whitespace-pre-line leading-relaxed text-gray-600">
                    {t(`${prefix}.sections.${key}.body`)}
                  </Text>
                </section>
              ))}
            </div>

            <footer className="border-t border-gray-100 bg-gray-50/60 px-5 py-5 md:px-8">
              <Text className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                {t('legal.relatedDocuments')}
              </Text>
              <div className="flex flex-wrap gap-2">
                {LEGAL_NAV_ITEMS.filter((item) => item.type !== type).map((item) => (
                  <Link
                    key={item.type}
                    href={routes.legal[item.type]}
                    className="inline-flex items-center rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:border-primary hover:text-primary"
                  >
                    {t(item.labelKey)}
                  </Link>
                ))}
              </div>
            </footer>
          </div>
        </div>
      </div>
    </article>
  );
}
