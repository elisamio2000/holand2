'use client';

import Link from 'next/link';
import { useCallback } from 'react';
import { useAudioPlayerStore } from '@/components/audio-player/store/audio-player-store';
import { useVideoPlayerSessionStore } from '@/components/video-player/store/video-player-session-store';
import { LabShell, DevBanner } from '@/platform/lab';
import { AudioGallery } from './gallery/audio-gallery';
import { VideoGallery } from './gallery/video-gallery';
import { StatesGallery } from './gallery/states-gallery';
import { ChatInlineExpandScenario } from './scenarios/chat-inline-expand';
import { ExplorerPreviewScenario } from './scenarios/explorer-preview';
import { OneSearchAudioStickyScenario } from './scenarios/one-search-audio-sticky';
import { OneSearchVideoWatchScenario } from './scenarios/one-search-video-watch';
import { MessageAttachmentScenario } from './scenarios/message-attachment';
import { ArtifactsPanelScenario } from './scenarios/artifacts-panel';
import { MediaLabPropsPanel } from './components/media-lab-props-panel';
import { MediaLabTour } from './components/media-lab-tour';

type LabTab = 'gallery' | 'states' | 'scenarios';

const ANCHORS: { href: string; label: string; tab: LabTab }[] = [
  { href: '#gallery-audio-functional', label: 'Audio QA', tab: 'gallery' },
  { href: '#gallery-audio', label: 'Audio', tab: 'gallery' },
  { href: '#gallery-video', label: 'Video', tab: 'gallery' },
  { href: '#gallery-states', label: 'States', tab: 'states' },
  { href: '#scenario-chat', label: 'Chat expand', tab: 'scenarios' },
  { href: '#scenario-explorer', label: 'Explorer', tab: 'scenarios' },
  { href: '#scenario-sticky', label: 'Sticky', tab: 'scenarios' },
  { href: '#scenario-watch', label: 'Watch', tab: 'scenarios' },
  { href: '#scenario-messages', label: 'Messages', tab: 'scenarios' },
  { href: '#scenario-artifacts', label: 'Artifacts', tab: 'scenarios' },
];

export function MediaPlayerLabPage() {
  const clearAudioSession = useAudioPlayerStore((s) => s.clearSession);
  const closePip = useVideoPlayerSessionStore((s) => s.closePip);

  const onUnmount = useCallback(() => {
    clearAudioSession();
    closePip();
  }, [clearAudioSession, closePip]);

  return (
    <div className="space-y-4">
      <MediaLabTour />
      <MediaLabPropsPanel />
      <LabShell<LabTab>
      moduleId="media-players"
      defaultTab="gallery"
      onUnmount={onUnmount}
      banner={
        <DevBanner>
          JWT, presigned URLs, and CORS must still be verified on real app surfaces:{' '}
          <Link href="/one-search" className="underline">
            One Search
          </Link>
          ,{' '}
          <Link href="/file-explorer" className="underline">
            File Explorer
          </Link>
          ,{' '}
          <Link href="/ai-chat" className="underline">
            AI Chat
          </Link>
          .
        </DevBanner>
      }
      anchors={ANCHORS}
      tabs={[
        {
          id: 'gallery',
          label: 'Gallery',
          dataTourId: 'lab-tab-gallery',
          content: (
            <div className="space-y-6">
              <AudioGallery />
              <VideoGallery />
            </div>
          ),
        },
        {
          id: 'states',
          label: 'States',
          content: <StatesGallery />,
        },
        {
          id: 'scenarios',
          label: 'Scenarios',
          dataTourId: 'lab-tab-scenarios',
          content: (
            <div className="space-y-6">
              <ChatInlineExpandScenario />
              <ExplorerPreviewScenario />
              <OneSearchAudioStickyScenario />
              <OneSearchVideoWatchScenario />
              <MessageAttachmentScenario />
              <ArtifactsPanelScenario />
            </div>
          ),
        },
      ]}
    />
    </div>
  );
}
