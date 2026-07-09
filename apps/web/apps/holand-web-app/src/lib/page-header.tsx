'use client';
import { useTranslation } from 'react-i18next';
import cn from '@/lib/cn';
import Breadcrumb from '@/lib/breadcrumb';

// ── SimplePageHeader (raw strings) ────────────────────────────────────────
export type PageHeaderTypes = {
  title: string;
  breadcrumb: { name: string; href?: string }[];
  className?: string;
};
export default function PageHeader({ title, breadcrumb, children, className }: React.PropsWithChildren<PageHeaderTypes>) {
  return (
    <header className={cn('mb-6 @container xs:-mt-2 lg:mb-7', className)}>
      <div className="flex flex-col @lg:flex-row @lg:items-center @lg:justify-between">
        <div>
          <h2 className="mb-2 text-[22px] font-semibold lg:text-2xl">{title}</h2>
          <Breadcrumb className="flex-wrap">
            {breadcrumb.map((item) => (
              <Breadcrumb.Item key={item.name} href={item.href}>{item.name}</Breadcrumb.Item>
            ))}
          </Breadcrumb>
        </div>
        {children}
      </div>
    </header>
  );
}

// ── TranslatedPageHeader (i18n keys) ──────────────────────────────────────
export interface TranslatedBreadcrumbItem { nameKey: string; href?: string }
export interface TranslatedPageHeaderProps {
  titleKey: string;
  breadcrumb: TranslatedBreadcrumbItem[];
  className?: string;
}
export function TranslatedPageHeader({ titleKey, breadcrumb, className }: TranslatedPageHeaderProps) {
  const { t } = useTranslation();
  return (
    <PageHeader
      title={t(titleKey)}
      breadcrumb={breadcrumb.map((b) => ({ name: t(b.nameKey), href: b.href }))}
      className={className}
    />
  );
}
