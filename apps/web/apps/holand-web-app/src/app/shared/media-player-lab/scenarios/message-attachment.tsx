'use client';

import MessageAttachmentRenderer from '@/app/shared/messages/message-attachment-renderer';
import type { AttachmentInfo } from '@/types/messages.types';
import { LabSection } from '@/platform/lab';
import { MOCK_ARTIFACT_IDS, SAMPLE_AUDIO, SAMPLE_VIDEO } from '../fixtures/sample-media';
import { SCENARIO_MESSAGES_CHECKLIST } from '../fixtures/qa-checklists';

const MOCK_AUDIO_ATTACHMENT: AttachmentInfo = {
  id: MOCK_ARTIFACT_IDS.audio,
  name: 'female_02.mp3',
  size: SAMPLE_AUDIO.fileSize,
  mime_type: SAMPLE_AUDIO.mimeType,
  url: SAMPLE_AUDIO.src,
};

const MOCK_VIDEO_ATTACHMENT: AttachmentInfo = {
  id: MOCK_ARTIFACT_IDS.video,
  name: 'clip-lab.mp4',
  size: SAMPLE_VIDEO.fileSize,
  mime_type: SAMPLE_VIDEO.mimeType,
  url: SAMPLE_VIDEO.src,
};

export function MessageAttachmentScenario({ moduleId = 'media-players' }: { moduleId?: string }) {
  return (
    <LabSection
      id="scenario-messages"
      title="S5 — Messages attachment row"
      description="Production MessageAttachmentRenderer — ultraCompact audio/video with MPS expand."
      checklist={SCENARIO_MESSAGES_CHECKLIST}
      moduleId={moduleId}
      dataTourId="scenario-messages"
    >
      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-lg border border-muted p-4">
          <p className="mb-3 text-xs font-medium uppercase text-gray-400">Audio attachment</p>
          <MessageAttachmentRenderer attachment={MOCK_AUDIO_ATTACHMENT} />
        </div>
        <div className="rounded-lg border border-muted p-4">
          <p className="mb-3 text-xs font-medium uppercase text-gray-400">Video attachment</p>
          <MessageAttachmentRenderer attachment={MOCK_VIDEO_ATTACHMENT} />
        </div>
      </div>
    </LabSection>
  );
}
