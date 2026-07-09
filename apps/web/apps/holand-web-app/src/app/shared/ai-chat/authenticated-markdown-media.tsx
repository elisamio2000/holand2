'use client';

import { useEffect, useState } from 'react';
import { PiWarningCircle } from 'react-icons/pi';
import cn from '@core/utils/class-names';
import { chatService } from '@/services/chat.service';
import { VideoPlayer } from '@/components/video-player';
import { MediaElementHost, MpsInlineAudioPlayer, useMediaPreview } from '@/components/media-playback';
import {
  extractArtifactIdFromGatewaySrc,
  normalizeGatewayArtifactSrc,
  shouldUseAuthenticatedMediaFetch,
} from '@/utils/gateway-media-url';

function useAuthBlobSrc(src: string | undefined): {
  url: string | null;
  status: 'idle' | 'loading' | 'ready' | 'error';
} {
  const resolved = src ? normalizeGatewayArtifactSrc(src) : '';
  const needs = shouldUseAuthenticatedMediaFetch(resolved);
  const [url, setUrl] = useState<string | null>(() => (!needs && resolved ? resolved : null));
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>(() =>
    !src ? 'error' : !needs ? 'ready' : 'loading'
  );

  useEffect(() => {
    if (!src) {
      setUrl(null);
      setStatus('error');
      return;
    }
    const r = normalizeGatewayArtifactSrc(src);
    if (!shouldUseAuthenticatedMediaFetch(r)) {
      setUrl(r);
      setStatus('ready');
      return;
    }
    let cancelled = false;
    setStatus('loading');
    void (async () => {
      const blob = await chatService.fetchAuthenticatedBlobUrl(r);
      if (cancelled) return;
      if (blob) {
        setUrl(blob);
        setStatus('ready');
      } else {
        setUrl(null);
        setStatus('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [src]);

  return { url, status };
}

/** Markdown `<img>` — uses authenticated fetch for gateway artifact URLs. */
export function MarkdownAuthImg(
  props: React.ImgHTMLAttributes<HTMLImageElement>
) {
  const { src, className, alt, ...rest } = props;
  const { url, status } = useAuthBlobSrc(typeof src === 'string' ? src : undefined);

  if (status === 'loading') {
    return (
      <div
        className={cn(
          'my-3 flex h-40 max-w-full items-center justify-center rounded-lg border border-muted bg-gray-50 dark:bg-gray-100/40',
          className
        )}
      >
        <span className="text-xs text-gray-400">Loading image…</span>
      </div>
    );
  }

  if (status === 'error' || !url) {
    return (
      <div
        className={cn(
          'my-3 flex max-w-full items-center gap-2 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-xs text-orange-800 dark:border-orange-800 dark:bg-orange-950/30 dark:text-orange-200',
          className
        )}
      >
        <PiWarningCircle className="h-4 w-4 shrink-0" />
        <span>Could not load image</span>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={alt ?? ''}
      className={cn('my-3 max-w-full rounded-lg', className)}
      loading="lazy"
      {...rest}
    />
  );
}

export function MarkdownAuthVideo(
  props: React.VideoHTMLAttributes<HTMLVideoElement> & { title?: string }
) {
  const { src, className, title, poster } = props;
  const { url, status } = useAuthBlobSrc(typeof src === 'string' ? src : undefined);
  const gatewaySrc = typeof src === 'string' ? src : undefined;
  const artifactId = gatewaySrc ? extractArtifactIdFromGatewaySrc(gatewaySrc) : undefined;

  const videoMedia = useMediaPreview({
    enabled: status === 'ready' && Boolean(url),
    kind: 'video',
    src: url ?? '',
    artifactId: artifactId ?? undefined,
    title,
    blobUrl: !artifactId ? url ?? undefined : undefined,
    sessionKey: artifactId ?? url ?? title,
  });

  if (status === 'loading') {
    return (
      <div
        className={cn(
          'my-3 rounded-lg border border-muted bg-gray-50 p-6 text-center text-xs text-gray-500 dark:bg-gray-100/40',
          className
        )}
      >
        Loading video…
      </div>
    );
  }
  if (!url) {
    return (
      <div
        className={cn(
          'my-3 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-xs text-orange-800',
          className
        )}
      >
        Could not load video
      </div>
    );
  }
  return (
    <div className={cn('my-3 max-w-full', className)}>
      {videoMedia.sessionId ? (
        <MediaElementHost
          sessionId={videoMedia.sessionId}
          kind="video"
          src={videoMedia.playbackSrc}
          className="hidden"
        />
      ) : null}
      <VideoPlayer
        src={videoMedia.playbackSrc ?? url}
        variant="full"
        title={title}
        poster={typeof poster === 'string' ? poster : undefined}
        artifactId={artifactId ?? undefined}
        mediaSessionId={videoMedia.sessionId}
        enableFullscreen
        enablePiP
      />
    </div>
  );
}

function MarkdownAudioPlayer({
  artifactId,
  src,
  gatewaySrc,
  className,
  title,
}: {
  artifactId?: string;
  src?: string;
  gatewaySrc?: string;
  className?: string;
  title?: string;
}) {
  return (
    <MpsInlineAudioPlayer
      artifactId={artifactId}
      src={gatewaySrc ?? src}
      blobUrl={!artifactId ? src : undefined}
      title={title || 'Audio'}
      className={cn('my-2 w-full max-w-md', className)}
      sessionKey={artifactId ?? src ?? title}
      stickySessionId={artifactId ?? src}
    />
  );
}

function MarkdownAuthAudioResolved({
  src,
  className,
  title,
}: {
  src: string;
  className?: string;
  title?: string;
}) {
  const needsAuth = shouldUseAuthenticatedMediaFetch(src);
  const { url, status } = useAuthBlobSrc(src);

  if (needsAuth && status === 'loading') {
    return (
      <div className={cn('my-2 text-xs text-gray-500', className)}>Loading audio…</div>
    );
  }

  if (needsAuth && (status === 'error' || !url)) {
    return (
      <div className={cn('my-2 text-xs text-orange-700', className)}>Could not load audio</div>
    );
  }

  return (
    <MarkdownAudioPlayer
      src={url ?? src}
      gatewaySrc={src}
      className={className}
      title={title}
    />
  );
}

export function MarkdownAuthAudio(
  props: React.AudioHTMLAttributes<HTMLAudioElement> & { title?: string }
) {
  const { src, className, title, ...rest } = props;
  const resolved = typeof src === 'string' ? normalizeGatewayArtifactSrc(src) : undefined;

  if (!resolved) {
    return (
      <div className={cn('my-2 text-xs text-orange-700', className)}>Could not load audio</div>
    );
  }

  const artifactId = extractArtifactIdFromGatewaySrc(resolved);
  if (artifactId) {
    return (
      <MarkdownAudioPlayer
        artifactId={artifactId}
        gatewaySrc={resolved}
        className={className}
        title={title ?? rest['aria-label']}
      />
    );
  }

  return (
    <MarkdownAuthAudioResolved
      src={resolved}
      className={className}
      title={title ?? rest['aria-label']}
    />
  );
}
