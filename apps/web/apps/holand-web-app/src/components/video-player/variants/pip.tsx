'use client';

import cn from '@core/utils/class-names';
import { useTranslation } from 'react-i18next';
import { VideoSurface } from '../components/video-surface';
import { vpTokens } from '../helpers/variant-visual-tokens';
import type { VariantProps } from '../types';

/** PiP — in-app floating dock (native PiP via unified requestVideoPiP when supported). */
export function PiPVariant(props: VariantProps) {
  const { t } = useTranslation();
  const { title, playback, onClose, className, enablePiP, poster, mimeType } = props;

  const pipLabel = title
    ? `${title} — ${t('videoPlayer.pip', 'Picture in Picture')}`
    : t('videoPlayer.pip', 'Picture in Picture');

  return (
    <div
      className={cn(vpTokens.pipShell, className)}
      style={{ maxWidth: 'calc(100vw - 2rem)' }}
      role="region"
      aria-label={pipLabel}
    >
      <VideoSurface
        playback={playback}
        poster={poster}
        title={title}
        mimeType={mimeType}
        enablePiP={enablePiP}
        enableFullscreen={false}
        chromeMode="overlay"
        showHeader={false}
        showShortcutsHint={false}
        minVideoHeight="120px"
        maxVideoHeight="180px"
        onClose={onClose}
        className="border-0 shadow-none"
        videoClassName="aspect-video w-full object-cover"
      />
      {title && (
        <div className="border-t border-gray-800 px-2 py-1">
          <p className="truncate text-xs text-gray-300">{title}</p>
        </div>
      )}
    </div>
  );
}
