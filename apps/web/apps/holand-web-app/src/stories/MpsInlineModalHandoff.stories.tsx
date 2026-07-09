'use client';

import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Button } from 'rizzui';
import { AudioPlayer } from '@/components/audio-player';
import {
  MediaElementHost,
  MediaPreviewPlaceholder,
  useMediaPreview,
} from '@/components/media-playback';
import { LAB_AUDIO_PLAYER_PROPS } from '@/app/shared/media-player-lab/fixtures/sample-media';

function MpsHandoffDemo() {
  const [modalOpen, setModalOpen] = useState(false);
  const media = useMediaPreview({
    kind: 'audio',
    src: LAB_AUDIO_PLAYER_PROPS.src,
    title: LAB_AUDIO_PLAYER_PROPS.title,
    enabled: true,
    sessionKey: 'storybook-mps-handoff',
  });

  return (
    <div className="space-y-4 rounded-lg border border-muted p-4">
      <MediaElementHost sessionId={media.sessionId} kind="audio" src={media.playbackSrc} />
      {!modalOpen ? (
        <>
          <AudioPlayer
            mediaSessionId={media.sessionId}
            variant="chatInline"
            title={LAB_AUDIO_PLAYER_PROPS.title}
            src={LAB_AUDIO_PLAYER_PROPS.src}
            onExpand={() => {
              media.expandToModal();
              setModalOpen(true);
            }}
          />
          <p className="text-xs text-gray-500">Inline chrome — expand opens modal with same session.</p>
        </>
      ) : (
        <div className="space-y-3 rounded-md border border-primary/30 bg-primary/5 p-3">
          <p className="text-sm font-medium">Modal chrome (same MPS session)</p>
          <MediaPreviewPlaceholder sessionId={media.sessionId} kind="audio" />
          <AudioPlayer
            mediaSessionId={media.sessionId}
            variant="full"
            title={LAB_AUDIO_PLAYER_PROPS.title}
            src={LAB_AUDIO_PLAYER_PROPS.src}
          />
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              media.collapseToInline();
              setModalOpen(false);
            }}
          >
            Close modal
          </Button>
        </div>
      )}
    </div>
  );
}

const meta: Meta<typeof MpsHandoffDemo> = {
  title: 'Media/MPS Inline Modal Handoff',
  component: MpsHandoffDemo,
  parameters: {
    docs: {
      description: {
        component:
          'Demonstrates MPS invariant I5: expand/close is presentation change, not engine remount.',
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof MpsHandoffDemo>;

export const AudioChatExpand: Story = {};
