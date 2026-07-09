'use client';

import { useLayoutEffect, useRef } from 'react';
import cn from '@core/utils/class-names';
import { ChatInlineControls } from '../components/chat-inline-controls';
import type { VariantProps } from '../types';

/**
 * ChatInline — controls matching audio chatInline.
 * MPS sessions reparent the shared &lt;video&gt; into an inline stage (VideoSurface pattern).
 */
export function ChatInlineVariant({
  playback,
  onExpand,
  onDownload,
  onShare,
  onDelete,
  moreMenuItems,
  duration: durationProp,
  mirrorPlayback,
  chatInlineLayout = 'card',
  className,
}: VariantProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const {
    containerRef,
    setIsFocused,
    videoRef,
    usesExternalVideo,
  } = playback;

  useLayoutEffect(() => {
    if (!usesExternalVideo || mirrorPlayback) return;
    const video = videoRef.current;
    const stage = stageRef.current;
    if (!video || !stage) return;
    if (video.parentElement !== stage) {
      stage.appendChild(video);
    }
    video.className = 'w-full max-h-[350px] rounded object-contain';
    video.style.outline = 'none';
  }, [usesExternalVideo, mirrorPlayback, videoRef]);

  return (
    <div
      ref={containerRef}
      tabIndex={-1}
      onMouseEnter={() => setIsFocused(true)}
      onMouseLeave={() => setIsFocused(false)}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      className={cn('min-w-0', className)}
    >
      {usesExternalVideo && !mirrorPlayback && (
        <div
          ref={stageRef}
          className="flex w-full items-center justify-center bg-gray-100/50 p-2 dark:bg-gray-200/10"
        />
      )}
      <ChatInlineControls
        playback={playback}
        duration={durationProp}
        mirrorPlayback={mirrorPlayback}
        layout={chatInlineLayout}
        onExpand={onExpand}
        onDownload={onDownload}
        onShare={onShare}
        onDelete={onDelete}
        moreMenuItems={moreMenuItems}
      />
    </div>
  );
}
