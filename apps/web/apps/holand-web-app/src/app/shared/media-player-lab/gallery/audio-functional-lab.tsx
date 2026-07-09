'use client';

import { AudioPlayer } from '@/components/audio-player';
import { LabSection, VariantCard, VariantTabs } from '@/platform/lab';
import { LAB_AUDIO_PLAYER_PROPS, SAMPLE_AUDIO } from '../fixtures/sample-media';

const FUNCTIONAL_CHECKLIST = [
  { id: 'f1', label: 'Play / pause works on live file' },
  { id: 'f2', label: 'Seek bar / waveform scrub updates time' },
  { id: 'f3', label: 'Simple vs waveform modes use same src' },
  { id: 'f4', label: 'Only one heavy engine active per tab' },
] as const;

/**
 * Single-file functional QA — tabbed modes so play + timeline can be tested
 * on `/test-media/female_02.mp3` without mock state or wrong duration props.
 */
export function AudioFunctionalLab() {
  return (
    <LabSection
      id="gallery-audio-functional"
      title="Play & Timeline — live QA"
      description={`All tabs use ${SAMPLE_AUDIO.src}. One player instance per tab — switch modes to test simple seek bar vs waveform vs timeline.`}
      checklist={[...FUNCTIONAL_CHECKLIST]}
    >
      <VariantCard label="shared sample" hint={SAMPLE_AUDIO.src}>
        <VariantTabs
          tabs={[
            {
              id: 'expanded',
              label: 'simple (expanded)',
              content: (
                <AudioPlayer
                  {...LAB_AUDIO_PLAYER_PROPS}
                  variant="expanded"
                  showShortcutsHint
                />
              ),
            },
            {
              id: 'full',
              label: 'waveform (full)',
              content: (
                <AudioPlayer
                  {...LAB_AUDIO_PLAYER_PROPS}
                  variant="full"
                  showWaveform
                  showShortcutsHint
                />
              ),
            },
            {
              id: 'advanced',
              label: 'timeline (advanced)',
              content: (
                <AudioPlayer
                  {...LAB_AUDIO_PLAYER_PROPS}
                  variant="advanced"
                  showWaveform
                  showTimeline
                  enableRegions
                  showShortcutsHint
                />
              ),
            },
            {
              id: 'chat-seek',
              label: 'chat — seek bar',
              content: (
                <AudioPlayer
                  {...LAB_AUDIO_PLAYER_PROPS}
                  variant="chatInline"
                  showWaveform={false}
                />
              ),
            },
            {
              id: 'chat-wave',
              label: 'chat — waveform',
              content: (
                <AudioPlayer
                  {...LAB_AUDIO_PLAYER_PROPS}
                  variant="chatInline"
                  showWaveform
                />
              ),
            },
          ]}
        />
      </VariantCard>
    </LabSection>
  );
}
