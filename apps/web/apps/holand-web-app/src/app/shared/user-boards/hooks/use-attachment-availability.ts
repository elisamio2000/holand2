'use client';

import { useEffect, useState } from 'react';
import { checkArtifactAvailable } from '../lib/board-attachment-lifecycle';
import {
  getCachedAvailability,
  setCachedAvailability,
} from '../lib/artifact-availability-cache';
import type { BoardAttachmentRef } from '../lib/board-types';

export function useAttachmentAvailability(attachments: BoardAttachmentRef[]) {
  const [unavailable, setUnavailable] = useState<Set<string>>(new Set());
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const artifactIds = [...new Set(attachments.map((a) => a.artifactId))];
    if (!artifactIds.length) {
      setUnavailable(new Set());
      return;
    }

    const bad = new Set<string>();
    const toFetch: string[] = [];
    for (const id of artifactIds) {
      const cached = getCachedAvailability(id);
      if (cached === false) bad.add(id);
      else if (cached === undefined) toFetch.push(id);
    }
    if (!toFetch.length) {
      setUnavailable(bad);
      return;
    }

    setChecking(true);
    void (async () => {
      await Promise.all(
        toFetch.map(async (id) => {
          const ok = await checkArtifactAvailable(id);
          setCachedAvailability(id, ok);
          if (!ok) bad.add(id);
        })
      );
      if (!cancelled) {
        setUnavailable(new Set(bad));
        setChecking(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [attachments]);

  const isUnavailable = (ref: BoardAttachmentRef) => unavailable.has(ref.artifactId);

  return { unavailable, isUnavailable, checking };
}
