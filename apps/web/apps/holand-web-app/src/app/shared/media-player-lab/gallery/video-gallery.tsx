'use client';

import { Suspense, useRef } from 'react';
import VideoPlayer from '@/components/video-player';
import type { VideoPlaybackMode, VideoPlayerVariant } from '@/components/video-player/types';
import { useVideoPlayerSessionStore } from '@/components/video-player/store/video-player-session-store';
import { Button } from 'rizzui';
import { LabSection, LazyMount, VariantCard, VariantTabs } from '@/platform/lab';
import { MOCK_BOOKMARKS, MOCK_CHAPTERS, MOCK_SUBTITLES } from '../fixtures/mock-artifacts';
import { SAMPLE_VIDEO } from '../fixtures/sample-media';
import { VIDEO_GALLERY_CHECKLIST } from '../fixtures/qa-checklists';
import { useMediaLabProps } from '../hooks/use-media-lab-props';

function VideoChatInlineShell() {
  const videoRef = useRef<HTMLVideoElement>(null);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-center rounded bg-black/5 p-2 dark:bg-gray-200/10">
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video
          ref={videoRef}
          src={SAMPLE_VIDEO.src}
          preload="metadata"
          playsInline
          className="max-h-[200px] max-w-full rounded"
        />
      </div>
      <VideoPlayer
        src={SAMPLE_VIDEO.src}
        variant="chatInline"
        title={SAMPLE_VIDEO.title}
        syncVideoRef={videoRef}
        mimeType={SAMPLE_VIDEO.mimeType}
        onExpand={() => {}}
      />
    </div>
  );
}

function VideoPlayerInstance({
  variant,
  playbackMode,
  extra,
}: {
  variant: VideoPlayerVariant;
  playbackMode?: VideoPlaybackMode;
  extra?: Record<string, unknown>;
}) {
  return (
    <VideoPlayer
      src={SAMPLE_VIDEO.src}
      title={SAMPLE_VIDEO.title}
      mimeType={SAMPLE_VIDEO.mimeType}
      duration={SAMPLE_VIDEO.duration}
      width={SAMPLE_VIDEO.width}
      height={SAMPLE_VIDEO.height}
      fileSize={SAMPLE_VIDEO.fileSize}
      variant={variant}
      playbackMode={playbackMode}
      enableFullscreen
      enablePiP
      rowId={`lab-${variant}-${playbackMode ?? 'default'}`}
      {...extra}
    />
  );
}

function LiveVideoPropsPreview() {
  const { props } = useMediaLabProps();
  return (
    <VariantCard label="Live props preview" hint="Controlled via URL query / panel above">
      <VideoPlayerInstance
        variant={props.videoVariant}
        playbackMode={props.videoVariant === 'ultraCompact' ? props.playbackMode : undefined}
        extra={{
          chromeMode: props.chromeMode,
          fullscreenLayout: props.fullscreenLayout,
          showFilmstrip: props.showFilmstrip,
          ...(props.showFilmstrip
            ? {
                chapters: MOCK_CHAPTERS,
                subtitles: MOCK_SUBTITLES,
                bookmarks: MOCK_BOOKMARKS,
              }
            : {}),
        }}
      />
    </VariantCard>
  );
}

function LiveVideoPropsPreviewGate() {
  return (
    <Suspense fallback={null}>
      <LiveVideoPropsPreview />
    </Suspense>
  );
}

export function VideoGallery() {
  const openPip = useVideoPlayerSessionStore((s) => s.openPip);
  const closePip = useVideoPlayerSessionStore((s) => s.closePip);

  return (
    <LabSection
      id="gallery-video"
      title="Video Gallery"
      description="All VideoPlayer variants including ultraCompact playback modes. PiP uses GlobalVideoPlayerHost from layout."
      checklist={VIDEO_GALLERY_CHECKLIST}
      moduleId="media-players"
    >
      <div className="mb-4">
        <LiveVideoPropsPreviewGate />
      </div>
      <div className="mb-4 grid gap-4 md:grid-cols-3">
        {(['preview', 'inline', 'mini'] as const).map((mode) => (
          <VariantCard key={mode} label={`ultraCompact · ${mode}`}>
            <LazyMount minHeight={100}>
              <VideoPlayerInstance variant="ultraCompact" playbackMode={mode} />
            </LazyMount>
          </VariantCard>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <VariantCard label="compact">
          <LazyMount minHeight={120}>
            <VideoPlayerInstance variant="compact" />
          </LazyMount>
        </VariantCard>
        <VariantCard label="chatInline" hint="Shared &lt;video&gt; + controls (file-preview pattern)">
          <LazyMount minHeight={160}>
            <VideoChatInlineShell />
          </LazyMount>
        </VariantCard>
      </div>

      <div className="mt-6">
        <VariantCard label="expanded | full | advanced">
          <VariantTabs
            tabs={[
              {
                id: 'expanded-overlay',
                label: 'expanded · overlay',
                content: (
                  <VideoPlayerInstance
                    variant="expanded"
                    extra={{ chromeMode: 'overlay', fullscreenLayout: 'cinema' }}
                  />
                ),
              },
              {
                id: 'expanded-bar',
                label: 'expanded · barBelow',
                content: (
                  <VideoPlayerInstance variant="expanded" extra={{ chromeMode: 'barBelow' }} />
                ),
              },
              {
                id: 'full',
                label: 'full',
                content: (
                  <VideoPlayerInstance
                    variant="full"
                    extra={{ chromeMode: 'overlay', fullscreenLayout: 'cinema' }}
                  />
                ),
              },
              {
                id: 'advanced',
                label: 'advanced · pro',
                content: (
                  <VideoPlayerInstance
                    variant="advanced"
                    extra={{
                      chromeMode: 'overlay',
                      fullscreenLayout: 'pro',
                      showFilmstrip: true,
                      chapters: MOCK_CHAPTERS,
                      subtitles: MOCK_SUBTITLES,
                      bookmarks: MOCK_BOOKMARKS,
                    }}
                  />
                ),
              },
            ]}
          />
        </VariantCard>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            openPip({
              src: SAMPLE_VIDEO.src,
              title: SAMPLE_VIDEO.title,
              mimeType: SAMPLE_VIDEO.mimeType,
              initialCurrentTime: 0,
            })
          }
        >
          Open PiP (global host)
        </Button>
        <Button size="sm" variant="text" onClick={() => closePip()}>
          Close PiP
        </Button>
      </div>
    </LabSection>
  );
}
