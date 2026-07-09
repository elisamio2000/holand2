'use client';

import { useCallback, useRef, useState } from 'react';
import cn from '@core/utils/class-names';
import {
  AudioPlayer,
  type AudioPlayerControls,
  useAudioStickyAnchor,
  useStickyBarActive,
} from '@/components/audio-player';
import { LabSection } from '@/platform/lab';
import { MOCK_QUEUE_TITLES } from '../fixtures/mock-artifacts';
import { SAMPLE_AUDIO } from '../fixtures/sample-media';
import { SCENARIO_STICKY_CHECKLIST } from '../fixtures/qa-checklists';

const SESSION_ID = 'lab-sticky-session';

export function OneSearchAudioStickyScenario({ moduleId = 'media-players' }: { moduleId?: string }) {
  const anchorRef = useRef<HTMLDivElement>(null);
  const controlsRef = useRef<AudioPlayerControls | null>(null);
  const [queueIndex, setQueueIndex] = useState(0);
  const stickyActive = useStickyBarActive();

  const title = MOCK_QUEUE_TITLES[queueIndex] ?? SAMPLE_AUDIO.title;

  useAudioStickyAnchor({
    enabled: true,
    sessionId: SESSION_ID,
    anchorRef,
    stickyLayout: 'bar',
    queueIndex,
    queueLength: MOCK_QUEUE_TITLES.length,
    handlers: {
      togglePlay: () => controlsRef.current?.togglePlay(),
      seekTo: (s) => controlsRef.current?.seekTo(s),
      onPrev: () => setQueueIndex((i) => Math.max(0, i - 1)),
      onNext: () => setQueueIndex((i) => Math.min(MOCK_QUEUE_TITLES.length - 1, i + 1)),
    },
  });

  const onMediaStateChange = useCallback((time: number, playing: boolean) => {
    void time;
    void playing;
  }, []);

  return (
    <LabSection
      id="scenario-sticky"
      title="S3 — One Search audio sticky + queue"
      description="Scroll the tall column — when the card leaves view while playing, GlobalAudioPlayerHost sticky bar appears (from hydrogen layout)."
      checklist={SCENARIO_STICKY_CHECKLIST}
      moduleId={moduleId}
    >
      <div
        className={cn(
          'max-h-[70vh] overflow-y-auto rounded-lg border border-muted bg-gray-50/30 dark:bg-gray-100/5',
          stickyActive && 'pb-24'
        )}
      >
        <div className="space-y-[80vh] p-4">
          <p className="text-sm text-gray-500">Scroll down to move the player card out of view…</p>
          <div
            ref={anchorRef}
            className="rounded-xl border border-muted bg-gray-0 p-4 shadow-sm dark:bg-gray-50"
          >
            <p className="mb-3 text-sm font-medium text-gray-800 dark:text-gray-100">{title}</p>
            <AudioPlayer
              key={queueIndex}
              src={SAMPLE_AUDIO.src}
              title={title}
              mimeType={SAMPLE_AUDIO.mimeType}
              variant="full"
              showWaveform
              stickyEnabled
              sessionId={SESSION_ID}
              controlsRef={controlsRef}
              onMediaStateChange={onMediaStateChange}
            />
            <p className="mt-2 text-xs text-gray-400">
              Queue: {queueIndex + 1} / {MOCK_QUEUE_TITLES.length} — use sticky bar prev/next when scrolled away.
            </p>
          </div>
          <p className="text-sm text-gray-500">End of scroll area</p>
        </div>
      </div>
      {stickyActive && (
        <p className="mt-2 text-xs font-medium text-primary">Sticky bar is active (check bottom of viewport)</p>
      )}
    </LabSection>
  );
}
