'use client';



import { VideoSurface } from '../components/video-surface';

import type { VariantProps } from '../types';



/** Expanded — standard player with overlay chrome (mock expanded). */

export function ExpandedVariant(props: VariantProps) {

  const {

    playback,

    poster,

    title,

    mimeType,

    fileSize,

    width,

    height,

    subtitles,

    enableFullscreen,

    enablePiP,

    chromeMode = 'overlay',

    fullscreenLayout = 'cinema',

    onScreenshot,

    onDownload,

    moreMenuItems,

    className,

    spriteMeta,

  } = props;



  return (

    <VideoSurface

      playback={playback}

      poster={poster}

      title={title}

      mimeType={mimeType}

      fileSize={fileSize}

      width={width}

      height={height}

      subtitles={subtitles ?? playback.loadedSubtitles}

      enableFullscreen={enableFullscreen}

      enablePiP={enablePiP}

      chromeMode={chromeMode}

      fullscreenLayout={fullscreenLayout}

      spriteMeta={spriteMeta}

      onScreenshot={

        onScreenshot

          ? () => {

              void playback.takeScreenshot().then(() => onScreenshot());

            }

          : undefined

      }

      onDownload={onDownload}

      moreMenuItems={moreMenuItems}

      className={className}

    />

  );

}

