'use client';

import FilePreviewInline from '@/app/shared/ai-chat/file-preview-inline';
import { LabSection } from '@/platform/lab';
import {
  MOCK_ARTIFACT_IDS,
  SAMPLE_AUDIO,
  SAMPLE_VIDEO,
  mockGatewaySrc,
} from '../fixtures/sample-media';
import { SCENARIO_CHAT_CHECKLIST } from '../fixtures/qa-checklists';

export function ChatInlineExpandScenario({ moduleId = 'media-players' }: { moduleId?: string }) {
  return (
    <LabSection
      id="scenario-chat"
      title="S1 — Chat inline ↔ expand"
      description="Production FilePreviewInline + modal via Media Playback Session (one element, chrome-only expand)."
      checklist={SCENARIO_CHAT_CHECKLIST}
      moduleId={moduleId}
      dataTourId="scenario-chat"
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <h3 className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-200">Audio</h3>
          <FilePreviewInline
            src={mockGatewaySrc(MOCK_ARTIFACT_IDS.audio, 'female_02.mp3')}
            name="female_02.mp3"
            mimeType={SAMPLE_AUDIO.mimeType}
            fileSize={SAMPLE_AUDIO.fileSize}
            localPreviewUrl={SAMPLE_AUDIO.src}
            artifactId={MOCK_ARTIFACT_IDS.audio}
            onClose={() => {}}
          />
        </div>
        <div>
          <h3 className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-200">Video</h3>
          <FilePreviewInline
            src={mockGatewaySrc(MOCK_ARTIFACT_IDS.video, 'test-video.mp4')}
            name="test-video.mp4"
            mimeType={SAMPLE_VIDEO.mimeType}
            fileSize={SAMPLE_VIDEO.fileSize}
            localPreviewUrl={SAMPLE_VIDEO.src}
            artifactId={MOCK_ARTIFACT_IDS.video}
            onClose={() => {}}
          />
        </div>
      </div>
    </LabSection>
  );
}
