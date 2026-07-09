'use client';

import { useRef } from 'react';
import { Button } from 'rizzui';
import { PiArrowsOutBold, PiArrowRightBold } from 'react-icons/pi';
import VideoPlayer, { type VideoPlayerControls } from '@/components/video-player';
import {
  MediaElementHost,
  MediaPreviewPlaceholder,
  useMediaPreview,
} from '@/components/media-playback';
import { useFilePreview } from '@/hooks/use-file-preview';
import { LabSection } from '@/platform/lab';
import { MOCK_ARTIFACT_IDS, SAMPLE_VIDEO, mockGatewaySrc } from '../fixtures/sample-media';
import { SCENARIO_WATCH_CHECKLIST } from '../fixtures/qa-checklists';

export function OneSearchVideoWatchScenario({ moduleId = 'media-players' }: { moduleId?: string }) {
  const { openFilePreview } = useFilePreview();
  const controlsRef = useRef<VideoPlayerControls | null>(null);
  const gatewaySrc = mockGatewaySrc(MOCK_ARTIFACT_IDS.video, 'test-video.mp4');

  const videoMedia = useMediaPreview({
    enabled: true,
    kind: 'video',
    src: gatewaySrc,
    artifactId: MOCK_ARTIFACT_IDS.video,
    mimeType: SAMPLE_VIDEO.mimeType,
    fileSize: SAMPLE_VIDEO.fileSize,
    title: SAMPLE_VIDEO.title,
    blobUrl: SAMPLE_VIDEO.src,
    sessionKey: 'lab-watch',
  });

  const handleExpand = () => {
    videoMedia.expandToModal();
    openFilePreview({
      src: gatewaySrc,
      name: SAMPLE_VIDEO.title,
      mimeType: SAMPLE_VIDEO.mimeType,
      fileSize: SAMPLE_VIDEO.fileSize,
      localPreviewUrl: SAMPLE_VIDEO.src,
      artifactId: MOCK_ARTIFACT_IDS.video,
      mediaSessionId: videoMedia.sessionId,
      meta: {
        width: SAMPLE_VIDEO.width,
        height: SAMPLE_VIDEO.height,
        duration: SAMPLE_VIDEO.duration,
      },
      onPlaybackSync: () => videoMedia.collapseToInline(),
    });
  };

  return (
    <LabSection
      id="scenario-watch"
      title="S4 — One Search video watch (MPS)"
      description="Watch-page style layout with MPS expand → useFilePreview(mediaSessionId). Single video element across inline and modal."
      checklist={SCENARIO_WATCH_CHECKLIST}
      moduleId={moduleId}
    >
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="relative overflow-hidden rounded-lg bg-black" style={{ aspectRatio: '16/9' }}>
            {videoMedia.sessionId && (
              <MediaElementHost
                sessionId={videoMedia.sessionId}
                kind="video"
                src={videoMedia.playbackSrc}
                className="absolute inset-0 h-full w-full object-contain"
              />
            )}
            {!videoMedia.isModal && videoMedia.sessionId ? (
              <VideoPlayer
                src={SAMPLE_VIDEO.src}
                variant="expanded"
                title={SAMPLE_VIDEO.title}
                mimeType={SAMPLE_VIDEO.mimeType}
                fileSize={SAMPLE_VIDEO.fileSize}
                width={SAMPLE_VIDEO.width}
                height={SAMPLE_VIDEO.height}
                duration={SAMPLE_VIDEO.duration}
                artifactId={MOCK_ARTIFACT_IDS.video}
                mediaSessionId={videoMedia.sessionId}
                className="relative z-[1] h-full w-full"
                controlsRef={controlsRef}
                enableFullscreen
                enablePiP
              />
            ) : videoMedia.isModal && videoMedia.sessionId ? (
              <div className="flex h-full items-center p-4">
                <MediaPreviewPlaceholder
                  sessionId={videoMedia.sessionId}
                  kind="video"
                  title={SAMPLE_VIDEO.title}
                  className="w-full border-white/20 bg-black/40"
                />
              </div>
            ) : null}
          </div>
          <div className="mt-3 flex gap-2">
            <Button size="sm" variant="outline" onClick={handleExpand} disabled={videoMedia.isModal}>
              <PiArrowsOutBold className="me-1 h-4 w-4" />
              Expand (modal)
            </Button>
          </div>
        </div>
        <div className="rounded-lg border border-muted p-4">
          <h3 className="mb-2 font-semibold text-gray-800 dark:text-gray-100">{SAMPLE_VIDEO.title}</h3>
          <p className="text-sm text-gray-500">
            {SAMPLE_VIDEO.width}×{SAMPLE_VIDEO.height} · {Math.round(SAMPLE_VIDEO.duration)}s
          </p>
          <button
            type="button"
            className="mt-4 flex items-center gap-1 text-sm text-primary hover:underline"
          >
            Related videos
            <PiArrowRightBold className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </LabSection>
  );
}
