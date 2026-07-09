'use client';

import { Button } from 'rizzui';
import { useFilePreview } from '@/hooks/use-file-preview';
import { LabSection } from '@/platform/lab';
import {
  MOCK_ARTIFACT_IDS,
  SAMPLE_AUDIO,
  SAMPLE_VIDEO,
  mockGatewaySrc,
} from '../fixtures/sample-media';
import { SCENARIO_EXPLORER_CHECKLIST } from '../fixtures/qa-checklists';

export function ExplorerPreviewScenario() {
  const { openFilePreview } = useFilePreview();

  return (
    <LabSection
      id="scenario-explorer"
      title="S2 — Explorer / global file preview"
      description="Same useFilePreview hook as file explorer and thread files — opens FilePreviewModalView."
      checklist={SCENARIO_EXPLORER_CHECKLIST}
      moduleId="media-players"
    >
      <div className="flex flex-wrap gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            openFilePreview({
              src: mockGatewaySrc(MOCK_ARTIFACT_IDS.audio, 'female_02.mp3'),
              name: 'female_02.mp3',
              mimeType: SAMPLE_AUDIO.mimeType,
              fileSize: SAMPLE_AUDIO.fileSize,
              localPreviewUrl: SAMPLE_AUDIO.src,
              artifactId: MOCK_ARTIFACT_IDS.audio,
            })
          }
        >
          Open audio preview
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            openFilePreview({
              src: mockGatewaySrc(MOCK_ARTIFACT_IDS.video, 'test-video.mp4'),
              name: 'test-video.mp4',
              mimeType: SAMPLE_VIDEO.mimeType,
              fileSize: SAMPLE_VIDEO.fileSize,
              localPreviewUrl: SAMPLE_VIDEO.src,
              artifactId: MOCK_ARTIFACT_IDS.video,
              meta: {
                width: SAMPLE_VIDEO.width,
                height: SAMPLE_VIDEO.height,
                duration: SAMPLE_VIDEO.duration,
              },
            })
          }
        >
          Open video preview
        </Button>
      </div>
    </LabSection>
  );
}
