'use client';

import Link from 'next/link';
import cn from '@core/utils/class-names';
import { LabSection } from '@/platform/lab';

interface PatternRow {
  id: string;
  surface: string;
  do: string;
  dont: string;
  helper?: string;
  scenarioHref?: string;
}

const PATTERNS: PatternRow[] = [
  {
    id: 'mps-inline-modal',
    surface: 'Chat / explorer inline â†” modal',
    do: 'useMediaPreview + MediaElementHost + mirrorPlayback placeholder while modal open',
    dont: 'Second AudioPlayer/VideoPlayer with its own src on expand',
    helper: 'useMediaPreview',
    scenarioHref: '#scenario-chat',
  },
  {
    id: 'ultra-compact',
    surface: 'Messenger / artifacts / search grid',
    do: 'MpsUltraCompactAudio / MpsUltraCompactVideo with expand â†’ FilePreviewModal',
    dont: 'Custom attachment card with raw <audio controls> or duplicate engines',
    helper: 'MpsUltraCompact*',
    scenarioHref: '#scenario-artifacts',
  },
  {
    id: 'sticky-audio',
    surface: 'One Search / scroll-away audio',
    do: 'useAudioStickyAnchor + GlobalAudioPlayerHost (remote controls only)',
    dont: 'AudioPlayer variant="sticky" or a second full player in the sticky bar',
    helper: 'GlobalAudioPlayerHost',
    scenarioHref: '#scenario-sticky',
  },
  {
    id: 'pip-video',
    surface: 'Video PiP',
    do: 'requestVideoPiP â†’ native PiP, else in-app dock via mediaSessionId (no props clone)',
    dont: 'openPip with full player props duplicating the engine',
    helper: 'requestVideoPiP',
    scenarioHref: '#gallery-video',
  },
  {
    id: 'watch-page',
    surface: 'One Search watch page',
    do: 'Single MPS session for hero player; related rows via ultraCompact + row registry',
    dont: 'Independent full VideoPlayer per related row',
    helper: 'inline-row-registry',
    scenarioHref: '#scenario-watch',
  },
  {
    id: 'prefs-store',
    surface: 'Volume / speed / loop',
    do: 'Read/write Holand-*-player-prefs Zustand store from any surface',
    dont: 'Local useState audioSettings per page',
    helper: 'useAudioPlayerPrefs / useVideoSettings',
  },
  {
    id: 'legacy-exceptions',
    surface: 'Ephemeral local previews',
    do: 'Document voice-note, TTS, bug-reporter as intentional non-MPS blob previews',
    dont: 'Migrate ephemeral recorders to MPS (no stable session)',
  },
];

function PatternCard({ row }: { row: PatternRow }) {
  return (
    <article
      id={`pattern-${row.id}`}
      className="rounded-lg border border-muted bg-gray-0 p-4 dark:bg-gray-50"
    >
      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{row.surface}</h3>
      {row.helper && (
        <p className="mt-0.5 text-xs text-primary">{row.helper}</p>
      )}
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="rounded-md border border-emerald-200 bg-emerald-50/80 p-3 dark:border-emerald-900/40 dark:bg-emerald-950/20">
          <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
            Do
          </p>
          <p className="text-xs text-emerald-900 dark:text-emerald-100">{row.do}</p>
        </div>
        <div className="rounded-md border border-red-200 bg-red-50/80 p-3 dark:border-red-900/40 dark:bg-red-950/20">
          <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-red-700 dark:text-red-300">
            Don&apos;t
          </p>
          <p className="text-xs text-red-900 dark:text-red-100">{row.dont}</p>
        </div>
      </div>
      {row.scenarioHref && (
        <a href={row.scenarioHref} className="mt-2 inline-block text-xs text-gray-500 hover:text-primary">
          See live scenario â†’
        </a>
      )}
    </article>
  );
}

export function PatternsGallery() {
  return (
    <LabSection
      id="patterns"
      title="Integration patterns (DO / DON&apos;T)"
      description="Living reference aligned with docs/MEDIA-PLAYER-ARCHITECTURE.md (repo root). Fix call sites to match these patterns before shipping."
    >
      <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-100">
        <strong>MPS invariants (I1â€“I6):</strong> one HTMLMediaElement per session; only{' '}
        <code className="text-xs">mediaSessionController</code> issues transport when{' '}
        <code className="text-xs">mediaSessionId</code> is set; expand/close is presentation change,
        not engine remount.
      </div>
      <div className="grid gap-4">
        {PATTERNS.map((row) => (
          <PatternCard key={row.id} row={row} />
        ))}
      </div>
    </LabSection>
  );
}

