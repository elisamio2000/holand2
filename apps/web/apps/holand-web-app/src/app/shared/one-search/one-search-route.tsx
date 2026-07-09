'use client';

import TranslatedPageHeader from '@/app/shared/translated-page-header';
import OneSearchView, {
  type OneSearchVariant,
} from '@/app/shared/one-search/one-search-view';
import { useSearchUrlState } from '@/app/shared/one-search/hooks/use-search-url-state';
import type { OneSearchProviderId } from '@/types/one-search.types';

export interface OneSearchRouteProps {
  variant?: OneSearchVariant;
  providerId?: OneSearchProviderId;
  titleKey: string;
  breadcrumb: Array<{ nameKey: string; href?: string }>;
}

/** One Search page shell — Google-style landing; page header only on advanced. */
export default function OneSearchRoute({
  variant = 'default',
  providerId,
  titleKey,
  breadcrumb,
}: OneSearchRouteProps) {
  const { hasQuery } = useSearchUrlState(variant);

  return (
    <>
      {!hasQuery && variant === 'advanced' && (
        <TranslatedPageHeader titleKey={titleKey} breadcrumb={breadcrumb} />
      )}
      <OneSearchView variant={variant} providerId={providerId} />
    </>
  );
}
