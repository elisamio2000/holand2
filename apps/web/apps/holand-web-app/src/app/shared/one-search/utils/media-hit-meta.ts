// ============================================
// One Search — audio/video hit metadata helpers
// ============================================

import type { OneSearchHit } from '@/types/one-search.types';
import { artifactIdFromHit } from '@/utils/storage-artifact-media';

export type MediaMatchKind = 'filename' | 'transcript' | 'metadata';

export interface TranscriptMatch {
  start_sec: number;
  end_sec: number;
  text: string;
}

export interface AudioVideoHitMeta {
  artifact_id?: string;
  mime?: string;
  duration?: number;
  size_bytes?: number;
  match?: MediaMatchKind;
  has_transcript?: boolean;
  transcript_match?: TranscriptMatch;
  uploaded_by?: string;
  session_id?: string;
}

function parseTranscriptMatch(raw: unknown): TranscriptMatch | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const o = raw as Record<string, unknown>;
  const start = Number(o.start_sec);
  const end = Number(o.end_sec);
  const text = typeof o.text === 'string' ? o.text : '';
  if (!Number.isFinite(start) || !Number.isFinite(end)) return undefined;
  return { start_sec: start, end_sec: end, text };
}

export function hitMediaMeta(hit: OneSearchHit): AudioVideoHitMeta {
  const meta = hit.meta ?? {};
  const matchRaw = String(meta.match ?? '').toLowerCase();
  const match: MediaMatchKind | undefined =
    matchRaw === 'transcript' || matchRaw === 'filename' || matchRaw === 'metadata'
      ? matchRaw
      : undefined;
  return {
    artifact_id: artifactIdFromHit(meta),
    mime: typeof meta.mime === 'string' ? meta.mime : undefined,
    duration: Number.isFinite(Number(meta.duration)) ? Number(meta.duration) : undefined,
    size_bytes: Number.isFinite(Number(meta.size_bytes)) ? Number(meta.size_bytes) : undefined,
    match,
    has_transcript: meta.has_transcript === true,
    transcript_match: parseTranscriptMatch(meta.transcript_match),
    uploaded_by: typeof meta.uploaded_by === 'string' ? meta.uploaded_by : undefined,
    session_id: typeof meta.session_id === 'string' ? meta.session_id : undefined,
  };
}

export function hitDurationSec(hit: OneSearchHit): number {
  const d = hitMediaMeta(hit).duration;
  return d != null && d > 0 ? d : 0;
}

export function hitMatchKind(hit: OneSearchHit): MediaMatchKind {
  const explicit = hitMediaMeta(hit).match;
  if (explicit) return explicit;
  if (hitMediaMeta(hit).transcript_match) return 'transcript';
  if (hitMediaMeta(hit).has_transcript && hit.snippet) return 'transcript';
  return 'filename';
}

export function dedupeHitsByArtifactId(hits: OneSearchHit[]): OneSearchHit[] {
  const seen = new Set<string>();
  const out: OneSearchHit[] = [];
  for (const hit of hits) {
    const id = artifactIdFromHit(hit.meta);
    const key = id ? `artifact:${id}` : `id:${hit.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(hit);
  }
  return out;
}

export function formatHitDuration(seconds: number | undefined): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) return '—';
  const s = Math.max(0, seconds);
  const mins = Math.floor(s / 60);
  const secs = Math.floor(s % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function collectUploadedByValues(hits: OneSearchHit[]): string[] {
  const set = new Set<string>();
  for (const hit of hits) {
    const v = hitMediaMeta(hit).uploaded_by;
    if (v) set.add(v);
  }
  return [...set].sort();
}
