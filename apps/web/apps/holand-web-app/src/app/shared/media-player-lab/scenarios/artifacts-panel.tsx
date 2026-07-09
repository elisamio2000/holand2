'use client';

import { MpsUltraCompactAudio, MpsUltraCompactVideo } from '@/components/media-playback';
import { LabSection } from '@/platform/lab';
import { MOCK_ARTIFACT_IDS, SAMPLE_AUDIO, SAMPLE_VIDEO } from '../fixtures/sample-media';
import { SCENARIO_ARTIFACTS_CHECKLIST } from '../fixtures/qa-checklists';

export function ArtifactsPanelScenario({ moduleId = 'media-players' }: { moduleId?: string }) {
  return (
    <LabSection
      id="scenario-artifacts"
      title="S6 — Artifacts panel inline media"
      description="Production MpsUltraCompact helpers — same ultraCompact + expand pattern as messenger."
      checklist={SCENARIO_ARTIFACTS_CHECKLIST}
      moduleId={moduleId}
    >
      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-lg border border-muted p-4">
          <p className="mb-3 text-xs font-medium uppercase text-gray-400">Audio artifact</p>
          <MpsUltraCompactAudio
            artifactId={MOCK_ARTIFACT_IDS.audio}
            src={SAMPLE_AUDIO.src}
            mimeType={SAMPLE_AUDIO.mimeType}
            fileSize={SAMPLE_AUDIO.fileSize}
            title="panel-audio.mp3"
            rowId="lab-artifacts-audio"
          />
        </div>
        <div className="rounded-lg border border-muted p-4">
          <p className="mb-3 text-xs font-medium uppercase text-gray-400">Video artifact</p>
          <MpsUltraCompactVideo
            artifactId={MOCK_ARTIFACT_IDS.video}
            src={SAMPLE_VIDEO.src}
            mimeType={SAMPLE_VIDEO.mimeType}
            fileSize={SAMPLE_VIDEO.fileSize}
            title="panel-video.mp4"
            rowId="lab-artifacts-video"
          />
        </div>
      </div>
    </LabSection>
  );
}
