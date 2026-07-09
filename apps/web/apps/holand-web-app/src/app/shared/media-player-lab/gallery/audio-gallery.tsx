'use client';

import { Suspense } from 'react';
import { AudioPlayer } from '@/components/audio-player';
import { LabSection, LazyMount, VariantCard } from '@/platform/lab';
import { LAB_AUDIO_PLAYER_PROPS } from '../fixtures/sample-media';
import { AUDIO_GALLERY_CHECKLIST } from '../fixtures/qa-checklists';
import { useMediaLabProps } from '../hooks/use-media-lab-props';
import { AudioFunctionalLab } from './audio-functional-lab';
import { AudioGalleryGrid } from './audio-gallery-grid';

function LivePropsPreview() {
  const { props } = useMediaLabProps();
  return (
    <VariantCard label="Live props preview" hint="Controlled via URL query / panel above">
      <AudioPlayer
        {...LAB_AUDIO_PLAYER_PROPS}
        variant={props.audioVariant}
        showWaveform={props.showWaveform}
        enableRegions={props.enableRegions}
        stickyEnabled={props.stickyEnabled}
        playbackRate={props.playbackRate}
        showTimeline={props.audioVariant === 'advanced'}
        showShortcutsHint={props.audioVariant === 'full' || props.audioVariant === 'advanced'}
      />
    </VariantCard>
  );
}

function LivePropsPreviewGate() {
  return (
    <Suspense fallback={null}>
      <LivePropsPreview />
    </Suspense>
  );
}

export function AudioGallery() {
  return (
    <div className="space-y-6">
      <AudioFunctionalLab />

      <LabSection
        id="gallery-audio"
        title="Audio Gallery"
        description="All AudioPlayer variants on the same sample file. Heavy waveform variants are tabbed; compact variants lazy-load on scroll."
        checklist={AUDIO_GALLERY_CHECKLIST}
        moduleId="media-players"
      >
        <div className="mb-4">
          <LivePropsPreviewGate />
        </div>
        <AudioGalleryGrid />
      </LabSection>
    </div>
  );
}
