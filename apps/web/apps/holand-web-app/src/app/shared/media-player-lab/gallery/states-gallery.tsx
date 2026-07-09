'use client';

import { useState } from 'react';
import { AudioPlayer } from '@/components/audio-player';
import VideoPlayer from '@/components/video-player';
import { StickyVariant } from '@/components/audio-player/variants/sticky';
import { LabSection, VariantCard } from '@/platform/lab';
import { SAMPLE_AUDIO, SAMPLE_VIDEO, LAB_AUDIO_PLAYER_PROPS } from '../fixtures/sample-media';
import { STATES_CHECKLIST } from '../fixtures/qa-checklists';

export function StatesGallery() {
  const [mirrorPlaying, setMirrorPlaying] = useState(true);

  return (
    <LabSection
      id="gallery-states"
      title="Edge States"
      description="Non-variant playback states for regression checks."
      checklist={STATES_CHECKLIST}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <VariantCard label="Audio · loading (empty src)">
          <AudioPlayer src="" title="Loading…" variant="compact" />
        </VariantCard>

        <VariantCard label="Video · loading (empty src)">
          <VideoPlayer src="" title="Loading…" variant="compact" />
        </VariantCard>

        <VariantCard label="Video · error (invalid src)">
          <VideoPlayer
            src="https://invalid.example.com/missing.mp4"
            title="Broken URL"
            variant="expanded"
          />
        </VariantCard>

        <VariantCard label="Video · unsupported format">
          <VideoPlayer
            src={SAMPLE_VIDEO.src}
            mimeType="video/x-matroska"
            title="MKV (unsupported)"
            variant="expanded"
          />
        </VariantCard>

        <VariantCard label="Audio · paused mid-track">
          <AudioPlayer
            {...LAB_AUDIO_PLAYER_PROPS}
            variant="chatInline"
            initialCurrentTime={3}
            initialIsPlaying={false}
          />
        </VariantCard>

        <VariantCard label="Video · mirror playback (chatInline)">
          <div className="space-y-2">
            <button
              type="button"
              className="text-xs text-primary underline"
              onClick={() => setMirrorPlaying((p) => !p)}
            >
              Toggle mirror isPlaying ({mirrorPlaying ? 'on' : 'off'})
            </button>
            <VideoPlayer
              src={SAMPLE_VIDEO.src}
              variant="chatInline"
              mirrorPlayback={{ currentTime: 12.5, isPlaying: mirrorPlaying }}
            />
          </div>
        </VariantCard>

        <VariantCard label="Sticky · queue context" className="md:col-span-2">
          <div className="relative overflow-hidden rounded-lg border border-dashed border-muted p-4">
            <StickyVariant
              title="Queue item 2 of 3"
              currentTime={55}
              duration={120}
              isPlaying
              stickyLayout="bar"
              queueIndex={1}
              queueLength={3}
              volume={0.7}
              isMuted={false}
              playbackRate={1.25}
              isLooping={false}
              className="!relative !inset-x-auto !bottom-auto !z-0 w-full"
              onTogglePlay={() => {}}
              onSeek={() => {}}
              onPrev={() => {}}
              onNext={() => {}}
              onVolumeChange={() => {}}
              onToggleLoop={() => {}}
              onSpeedChange={() => {}}
            />
          </div>
        </VariantCard>
      </div>
    </LabSection>
  );
}
