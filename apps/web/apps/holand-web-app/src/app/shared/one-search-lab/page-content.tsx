'use client';

import Link from 'next/link';
import { useCallback } from 'react';
import { useAudioPlayerStore } from '@/components/audio-player/store/audio-player-store';
import { useVideoPlayerSessionStore } from '@/components/video-player/store/video-player-session-store';
import { LabShell, DevBanner } from '@/platform/lab';
import { OneSearchAudioStickyScenario } from '@/app/shared/media-player-lab/scenarios/one-search-audio-sticky';
import { OneSearchVideoWatchScenario } from '@/app/shared/media-player-lab/scenarios/one-search-video-watch';
import { CompactBarScenario } from './scenarios/compact-bar';
import { OneSearchLabTour } from './components/one-search-lab-tour';

type LabTab = 'scenarios';

const ANCHORS = [
  { href: '#scenario-compact', label: 'Compact bar', tab: 'scenarios' as LabTab },
  { href: '#scenario-sticky', label: 'Audio sticky', tab: 'scenarios' as LabTab },
  { href: '#scenario-watch', label: 'Video watch', tab: 'scenarios' as LabTab },
];

export function OneSearchLabPage() {
  const clearAudioSession = useAudioPlayerStore((s) => s.clearSession);
  const closePip = useVideoPlayerSessionStore((s) => s.closePip);

  const onUnmount = useCallback(() => {
    clearAudioSession();
    closePip();
  }, [clearAudioSession, closePip]);

  return (
    <div className="space-y-4">
      <OneSearchLabTour />
      <LabShell<LabTab>
        moduleId="one-search"
        defaultTab="scenarios"
        onUnmount={onUnmount}
        banner={
          <DevBanner>
            Mock/local media only in this lab. Verify JWT, presigned URLs, and smart-search on{' '}
            <Link href="/one-search" className="underline" data-tour="lab-production-link">
              production One Search
            </Link>
            .
          </DevBanner>
        }
        anchors={ANCHORS}
        tabs={[
          {
            id: 'scenarios',
            label: 'Scenarios',
            dataTourId: 'lab-tab-scenarios',
            content: (
              <div className="space-y-6">
                <CompactBarScenario />
                <OneSearchAudioStickyScenario moduleId="one-search" />
                <OneSearchVideoWatchScenario moduleId="one-search" />
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}
