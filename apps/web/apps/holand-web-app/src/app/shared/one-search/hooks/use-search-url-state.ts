'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { routes } from '@/config/routes';
import type { OneSearchMode, OneSearchQueryImage } from '@/types/one-search.types';
import { parseVisualSearchFromUrl } from '../utils/visual-search-upload';
import { hydrateEphemeralQueryImage, clearPersistedEphemeralArtifact } from '../utils/ephemeral-visual-artifact';

export type OneSearchVariant = 'default' | 'advanced';

const MODE_LIST: OneSearchMode[] = ['all', 'text', 'image', 'audio', 'video', 'file'];

function isOneSearchMode(v: string | null): v is OneSearchMode {
  return v !== null && (MODE_LIST as string[]).includes(v);
}

export function appendVisualParams(p: URLSearchParams, visual: OneSearchQueryImage | null) {
  if (!visual?.artifact_id) return;
  p.set('visualArtifact', visual.artifact_id);
  if (visual.crop) {
    p.set(
      'crop',
      `${Math.round(visual.crop.x)},${Math.round(visual.crop.y)},${Math.round(visual.crop.width)},${Math.round(visual.crop.height)}`
    );
  }
}

export function useSearchUrlState(variant: OneSearchVariant = 'default') {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<OneSearchMode>('all');
  const [queryImage, setQueryImage] = useState<OneSearchQueryImage | null>(null);

  useEffect(() => {
    const q = searchParams.get('q') ?? '';
    const m = searchParams.get('mode');
    setQuery(q);
    if (isOneSearchMode(m)) setMode(m);
    else setMode('all');

    setQueryImage(
      hydrateEphemeralQueryImage(
        parseVisualSearchFromUrl(
          searchParams.get('visualArtifact'),
          searchParams.get('crop')
        )
      )
    );
  }, [searchParams]);

  const qParam = (searchParams.get('q') ?? '').trim();
  const modeParam: OneSearchMode = isOneSearchMode(searchParams.get('mode'))
    ? (searchParams.get('mode') as OneSearchMode)
    : 'all';

  const hasQuery = Boolean(qParam) || Boolean(queryImage);

  const applyToUrl = useCallback(
    (nextQuery: string, nextMode: OneSearchMode, visual?: OneSearchQueryImage | null) => {
      const p = new URLSearchParams();
      const trimmed = nextQuery.trim();
      if (trimmed) p.set('q', trimmed);
      if (nextMode !== 'all') p.set('mode', nextMode);
      appendVisualParams(p, visual ?? null);
      if (!visual?.artifact_id) {
        clearPersistedEphemeralArtifact();
      }
      const qs = p.toString();
      const base =
        variant === 'advanced' ? routes.oneSearch.advanced : routes.oneSearch.root;
      router.push(qs ? `${base}?${qs}` : base);
    },
    [router, variant]
  );

  const advancedHref = (() => {
    const p = new URLSearchParams();
    if (query.trim()) p.set('q', query.trim());
    if (mode !== 'all') p.set('mode', mode);
    appendVisualParams(p, queryImage);
    const qs = p.toString();
    return qs ? `${routes.oneSearch.advanced}?${qs}` : routes.oneSearch.advanced;
  })();

  const simpleHref = (() => {
    const p = new URLSearchParams();
    if (query.trim()) p.set('q', query.trim());
    if (mode !== 'all') p.set('mode', mode);
    appendVisualParams(p, queryImage);
    const qs = p.toString();
    return qs ? `${routes.oneSearch.root}?${qs}` : routes.oneSearch.root;
  })();

  return {
    query,
    setQuery,
    mode,
    setMode,
    queryImage,
    setQueryImage,
    qParam,
    modeParam,
    hasQuery,
    applyToUrl,
    advancedHref,
    simpleHref,
  };
}
