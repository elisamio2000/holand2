'use client';

import { Tooltip } from '@/components/tooltip';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import cn from '@core/utils/class-names';
import { ActionIcon, Title } from 'rizzui';
import {
  PiXBold,
  PiDotsThreeBold,
  PiDownloadBold,
  PiShareNetworkBold,
} from 'react-icons/pi';
import { formatFileSize, formatResolution } from '../utils/format-time';
import { ExpandedVariant } from './expanded';
import type { VariantProps } from '../types';

export function FullVariant(props: VariantProps) {
  const { t } = useTranslation();
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
    chromeMode,
    fullscreenLayout,
    onScreenshot,
    onClose,
    onDownload,
    onShare,
    moreMenuItems,
    showHeader = true,
    className,
  } = props;
  const [menuOpen, setMenuOpen] = useState(false);

  const resolution = formatResolution(width, height);
  const overflow = [
    onShare && {
      icon: <PiShareNetworkBold className="h-3.5 w-3.5" />,
      label: t('videoPlayer.share', 'Share'),
      onClick: onShare,
    },
    ...(moreMenuItems ?? []),
  ].filter(Boolean) as Array<{ icon: React.ReactNode; label: string; onClick: () => void }>;

  return (
    <div className={cn('overflow-hidden rounded-xl border border-muted bg-gray-0 dark:bg-gray-50', className)}>
      {showHeader !== false && (
        <div className="flex items-center justify-between gap-2 border-b border-muted px-3 py-2">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <Title as="h4" className="truncate text-sm font-semibold text-gray-800 dark:text-gray-100">
              {title || t('videoPlayer.untitled', 'Untitled video')}
            </Title>
            {mimeType && (
              <span className="shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium uppercase text-gray-500 dark:bg-gray-200/30">
                {mimeType.split('/')[1]}
              </span>
            )}
            {resolution && <span className="shrink-0 text-xs text-gray-400">{resolution}</span>}
            {fileSize != null && (
              <span className="shrink-0 text-xs text-gray-400">{formatFileSize(fileSize)}</span>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-0.5">
            {onDownload && (
              <Tooltip content={t('videoPlayer.download', 'Download')} placement="top">
                <ActionIcon variant="text" size="sm" onClick={onDownload} aria-label={t('videoPlayer.download', 'Download')}>
                  <PiDownloadBold className="h-3.5 w-3.5" />
                </ActionIcon>
              </Tooltip>
            )}
            {overflow.length > 0 && (
              <div className="relative">
                <ActionIcon variant="text" size="sm" onClick={() => setMenuOpen(!menuOpen)} aria-label={t('common.more', 'More')}>
                  <PiDotsThreeBold className="h-3.5 w-3.5" />
                </ActionIcon>
                {menuOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                    <div className="absolute end-0 top-full z-20 mt-1 min-w-[140px] rounded-md border border-muted bg-gray-0 py-1 shadow-md dark:bg-gray-50">
                      {overflow.map((item) => (
                        <button
                          key={item.label}
                          type="button"
                          onClick={() => {
                            item.onClick();
                            setMenuOpen(false);
                          }}
                          className="flex w-full items-center gap-2 px-3 py-1.5 text-start text-xs text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-200/30"
                        >
                          {item.icon}
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
            {onClose && (
              <Tooltip content={t('common.close', 'Close')} placement="top">
                <ActionIcon variant="text" size="sm" onClick={onClose} aria-label={t('common.close', 'Close')}>
                  <PiXBold className="h-3.5 w-3.5" />
                </ActionIcon>
              </Tooltip>
            )}
          </div>
        </div>
      )}

      <ExpandedVariant
        src={props.src}
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
        chromeMode={chromeMode ?? 'overlay'}
        fullscreenLayout={fullscreenLayout ?? 'cinema'}
        onScreenshot={onScreenshot}
        onDownload={onDownload}
        moreMenuItems={moreMenuItems}
        className="rounded-none border-0"
        showHeader={false}
      />
    </div>
  );
}
