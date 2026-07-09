import type {
  MediaHitFilterState,
  MediaSortField,
} from '@/app/shared/one-search/utils/image-hit-filters';

/** Toolbar + pagination state lifted to OneSearchView for server refetch. */
export interface MediaSearchControlsProps {
  sort: MediaSortField;
  onSortChange: (sort: MediaSortField) => void;
  filters: MediaHitFilterState;
  onFiltersChange: (filters: MediaHitFilterState) => void;
  searchQuery?: string;
  onLoadMore?: () => void;
  hasMore?: boolean;
  paginationLoading?: boolean;
  totalCount?: number;
  /** When false, show filename-only degraded banner. */
  serverMetadataReady?: boolean;
}
