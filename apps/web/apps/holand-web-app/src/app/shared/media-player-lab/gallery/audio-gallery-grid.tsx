'use client';

import { useEffect, useState } from 'react';
import { AudioPlayer, AudioPlayerVariant } from '@/components/audio-player';
import { useAudioPlayerStore } from '@/components/audio-player/store/audio-player-store';
import { LazyMount, VariantCard, VariantTabs } from '@/platform/lab';
import { LAB_AUDIO_PLAYER_PROPS } from '../fixtures/sample-media';

const STICKY_PREVIEW_SESSION = 'lab-gallery-sticky-preview';

const LIGHT_VARIANTS: AudioPlayerVariant[] = [
  'ultraCompact',
  'compact',
  'mini',
  'chatInline',
];

function AudioPlayerInstance({
  variant,
  showWaveform,
  enableRegions,
}: {
  variant: AudioPlayerVariant;
  showWaveform?: boolean;
  enableRegions?: boolean;
}) {
  return (
    <AudioPlayer
      {...LAB_AUDIO_PLAYER_PROPS}
      variant={variant}
      showWaveform={showWaveform}
      enableRegions={enableRegions}
      showTimeline={variant === 'advanced'}
      showShortcutsHint={variant === 'full' || variant === 'advanced'}
    />
  );
}

function StickyLivePreview() {
  const [layout, setLayout] = useState<'bar' | 'dock'>('bar');
  const updatePrefs = useAudioPlayerStore((s) => s.updatePrefs);

  useEffect(() => {
    updatePrefs({ stickyLayout: layout });
  }, [layout, updatePrefs]);

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        {(['bar', 'dock'] as const).map((l) => (
          <button
            key={l}
            type="button"
            onClick={() => setLayout(l)}
            className={`rounded px-2 py-1 text-xs ${layout === l ? 'bg-primary text-primary-foreground' : 'bg-gray-100 dark:bg-gray-200/20'}`}
          >
            {l}
          </button>
        ))}
      </div>
      <div className="max-h-72 overflow-y-auto rounded-lg border border-dashed border-muted bg-gray-100/50 dark:bg-gray-200/10">
        <div className="space-y-[40vh] p-4">
          <p className="text-xs text-gray-500">
            Play below, then scroll this card out of view — sticky bar uses the same live file.
          </p>
          <AudioPlayer
            {...LAB_AUDIO_PLAYER_PROPS}
            variant="compact"
            stickyEnabled
            sessionId={STICKY_PREVIEW_SESSION}
            stickyLayout={layout}
          />
          <p className="text-xs text-gray-400">End of scroll area</p>
        </div>
      </div>
    </div>
  );
}

export function AudioGalleryGrid() {
  return (
    <>
      <div className="grid gap-4 md:grid-cols-2">
        {LIGHT_VARIANTS.map((variant) => (
          <VariantCard key={variant} label={variant}>
            <LazyMount minHeight={variant === 'chatInline' ? 56 : 80}>
              <AudioPlayerInstance variant={variant} />
            </LazyMount>
          </VariantCard>
        ))}
      </div>

      <div className="mt-6">
        <VariantCard label="expanded | full | advanced" hint="One WaveSurfer instance at a time">
          <VariantTabs
            tabs={[
              {
                id: 'expanded',
                label: 'expanded',
                content: <AudioPlayerInstance variant="expanded" />,
              },
              {
                id: 'full',
                label: 'full',
                content: <AudioPlayerInstance variant="full" showWaveform />,
              },
              {
                id: 'advanced',
                label: 'advanced',
                content: (
                  <AudioPlayerInstance variant="advanced" showWaveform enableRegions />
                ),
              },
            ]}
          />
        </VariantCard>
      </div>

      <div className="mt-4">
        <VariantCard label="sticky (live preview)">
          <StickyLivePreview />
        </VariantCard>
      </div>
    </>
  );
}
