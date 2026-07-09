'use client';

import { useEffect, useState } from 'react';
import { storageService } from '@/services/storage.service';

export interface WaveformPeaksState {
  peaks: number[] | null;
  durationSec: number;
  loading: boolean;
  error: boolean;
}

/** Fetch precomputed waveform peaks; falls back to empty (WaveSurfer decode). */
export function useWaveformPeaks(
  artifactId: string | undefined,
  enabled = true,
  bins = 128
): WaveformPeaksState {
  const [peaks, setPeaks] = useState<number[] | null>(null);
  const [durationSec, setDurationSec] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!artifactId || !enabled) {
      setPeaks(null);
      setLoading(false);
      setError(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(false);

    void storageService
      .fetchWaveformPeaks(artifactId, bins)
      .then((res) => {
        if (cancelled) return;
        setPeaks(res.peaks);
        setDurationSec(res.duration_sec);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setPeaks(null);
          setLoading(false);
          setError(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [artifactId, enabled, bins]);

  return { peaks, durationSec, loading, error };
}
