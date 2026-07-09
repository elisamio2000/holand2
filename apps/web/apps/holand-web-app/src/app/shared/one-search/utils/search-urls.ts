import { routes } from '@/config/routes';
import type { OneSearchLaneId } from '@/types/one-search.types';
import { buildFileExplorerArtifactHref } from './normalize-search-hits';

export type OneSearchPageVariant = 'default' | 'advanced';

export { buildFileExplorerArtifactHref, buildMessagesChatHref } from './normalize-search-hits';

export function buildOneSearchUrl(opts: {
  q?: string;
  mode?: string;
  variant?: OneSearchPageVariant;
  visualArtifact?: string;
  crop?: string;
}): string {
  const p = new URLSearchParams();
  const trimmed = (opts.q ?? '').trim();
  if (trimmed) p.set('q', trimmed);
  const mode = opts.mode ?? 'all';
  if (mode !== 'all') p.set('mode', mode);
  if (opts.visualArtifact?.trim()) p.set('visualArtifact', opts.visualArtifact.trim());
  if (opts.crop?.trim()) p.set('crop', opts.crop.trim());
  const qs = p.toString();
  const base =
    opts.variant === 'advanced' ? routes.oneSearch.advanced : routes.oneSearch.root;
  return qs ? `${base}?${qs}` : base;
}

/**
 * Canonical “see all in this lane” targets — aligned with existing app routes where possible.
 */
export function laneExploreHref(
  lane: OneSearchLaneId,
  q: string,
  variant: OneSearchPageVariant = 'default'
): string {
  const trimmed = q.trim();
  switch (lane) {
    case 'files':
      return buildOneSearchUrl({ q: trimmed, mode: 'file', variant });
    case 'storage':
      return buildOneSearchUrl({ q: trimmed, mode: 'all', variant });
    case 'chat':
      return buildOneSearchUrl({ q: trimmed, mode: 'text', variant });
    case 'cases': {
      const p = new URLSearchParams();
      if (trimmed) p.set('q', trimmed);
      const qs = p.toString();
      return qs ? `${routes.cases.search}?${qs}` : routes.cases.search;
    }
    case 'graph':
      return trimmed
        ? `${routes.graphExplorer}?q=${encodeURIComponent(trimmed)}`
        : routes.graphExplorer;
    case 'users':
    default:
      return buildOneSearchUrl({ q: trimmed, mode: 'all', variant });
  }
}

export function isImageThumbnailHit(hit: { meta?: Record<string, unknown> }): boolean {
  const mime = String(hit.meta?.mime ?? '');
  return mime.startsWith('image/') && typeof hit.meta?.thumb_url === 'string' && hit.meta.thumb_url.length > 0;
}
