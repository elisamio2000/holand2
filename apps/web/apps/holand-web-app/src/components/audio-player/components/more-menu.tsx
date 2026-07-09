'use client';

import type { RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import cn from '@core/utils/class-names';
import {
  PiRepeatBold,
  PiSelectionAllBold,
  PiScissorsBold,
  PiMagnifyingGlassMinusBold,
  PiMagnifyingGlassPlusBold,
  PiSkipBackFill,
  PiSkipForwardFill,
  PiDownloadBold,
  PiShareNetworkBold,
  PiTrashBold,
} from 'react-icons/pi';
import { PLAYBACK_SPEEDS } from '../constants';
import { FloatingPopoverPortal } from './floating-popover-portal';
import type { UseAudioPlaybackReturn } from '../types';

type MoreMenuPlayback = Pick<
  UseAudioPlaybackReturn,
  | 'isLooping'
  | 'toggleLoop'
  | 'enableRegions'
  | 'isRegionMode'
  | 'toggleRegionMode'
  | 'userRegions'
  | 'clearRegions'
  | 'showZoom'
  | 'zoomIn'
  | 'zoomOut'
  | 'zoomLevel'
  | 'isReady'
  | 'showSkipEnds'
  | 'skipToStart'
  | 'skipToEnd'
  | 'showSpeedControl'
  | 'showSpeedMenu'
  | 'setShowSpeedMenu'
  | 'playbackRate'
  | 'handleSpeedChange'
  | 'setShowMoreMenu'
>;

export interface AudioPlayerMoreMenuProps {
  playback: MoreMenuPlayback;
  open: boolean;
  anchorRef: RefObject<HTMLElement | null>;
  placement?: 'above' | 'below';
  onDownload?: () => void;
  onShare?: () => void;
  onDelete?: () => void;
  moreMenuItems?: Array<{ icon: React.ReactNode; label: string; onClick: () => void }>;
  showSpeedInMenu?: boolean;
}

export function AudioPlayerMoreMenu({
  playback,
  open,
  anchorRef,
  placement = 'above',
  onDownload,
  onShare,
  onDelete,
  moreMenuItems,
  showSpeedInMenu = false,
}: AudioPlayerMoreMenuProps) {
  const { t } = useTranslation();
  const {
    isLooping,
    toggleLoop,
    enableRegions,
    isRegionMode,
    toggleRegionMode,
    userRegions,
    clearRegions,
    showZoom,
    zoomIn,
    zoomOut,
    zoomLevel,
    isReady,
    showSkipEnds,
    skipToStart,
    skipToEnd,
    showSpeedControl,
    showSpeedMenu,
    setShowSpeedMenu,
    playbackRate,
    handleSpeedChange,
    setShowMoreMenu,
  } = playback;

  if (!open) return null;

  const close = () => setShowMoreMenu(false);

  return (
    <FloatingPopoverPortal
      open={open}
      onClose={close}
      anchorRef={anchorRef}
      placement={placement}
      width={208}
      gap={6}
    >
        <div className="mb-1 border-b border-muted px-3 pb-1.5 pt-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
          {t('audioPlayer.options', 'Options')}
        </div>

        <button
          type="button"
          onClick={() => toggleLoop()}
          className="flex w-full items-center gap-2.5 px-3 py-2 text-xs transition-colors hover:bg-gray-100 dark:hover:bg-gray-200/20"
        >
          <PiRepeatBold className={cn('h-4 w-4', isLooping ? 'text-primary' : 'text-gray-500 dark:text-gray-400')} />
          <span className={isLooping ? 'font-medium text-primary' : 'text-gray-600 dark:text-gray-400'}>
            {t('audioPlayer.loop', 'Loop')}
          </span>
          {isLooping && <span className="ml-auto h-2 w-2 rounded-full bg-primary" />}
        </button>

        {showSpeedInMenu && showSpeedControl && (
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setShowSpeedMenu((p) => !p);
              }}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-xs text-gray-600 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-200/20"
            >
              <span>{t('audioPlayer.speed', 'Speed')}</span>
              <span className="ml-auto tabular-nums">{playbackRate === 1 ? '1×' : `${playbackRate}×`}</span>
            </button>
            {showSpeedMenu && (
              <div className="border-t border-muted py-1">
                {PLAYBACK_SPEEDS.map((speed) => (
                  <button
                    key={speed}
                    type="button"
                    onClick={() => handleSpeedChange(speed)}
                    className={cn(
                      'flex w-full items-center justify-between px-3 py-1.5 text-xs',
                      speed === playbackRate
                        ? 'bg-primary/5 font-semibold text-primary dark:bg-primary/10'
                        : 'text-gray-600 dark:text-gray-400'
                    )}
                  >
                    <span>{speed === 1 ? 'Normal' : `${speed}x`}</span>
                    {speed === playbackRate && <span className="text-[10px] text-primary">&bull;</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {enableRegions && (
          <button
            type="button"
            onClick={() => toggleRegionMode()}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-xs transition-colors hover:bg-gray-100 dark:hover:bg-gray-200/20"
          >
            <PiSelectionAllBold
              className={cn('h-4 w-4', isRegionMode ? 'text-primary' : 'text-gray-500 dark:text-gray-400')}
            />
            <span className={isRegionMode ? 'font-medium text-primary' : 'text-gray-600 dark:text-gray-400'}>
              {t('audioPlayer.selectRegion', 'Select Region')}
            </span>
            {isRegionMode && <span className="ml-auto h-2 w-2 rounded-full bg-primary" />}
          </button>
        )}

        {enableRegions && userRegions.length > 0 && (
          <button
            type="button"
            onClick={() => {
              clearRegions();
              close();
            }}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-xs transition-colors hover:bg-gray-100 dark:hover:bg-gray-200/20"
          >
            <PiScissorsBold className="h-4 w-4 text-gray-500 dark:text-gray-400" />
            <span className="text-gray-600 dark:text-gray-400">{t('audioPlayer.clearRegions', 'Clear All Regions')}</span>
            <span className="ml-auto rounded-full bg-gray-200 px-1.5 py-0.5 text-[10px] text-gray-500 dark:bg-gray-200/20">
              {userRegions.length}
            </span>
          </button>
        )}

        {showZoom && (
          <>
            <div className="my-1 border-t border-muted" />
            <div className="flex items-center gap-2 px-3 py-2">
              <PiMagnifyingGlassMinusBold className="h-4 w-4 text-gray-500 dark:text-gray-400" />
              <span className="flex-1 text-xs text-gray-600 dark:text-gray-400">Zoom</span>
              <div className="flex items-center gap-1.5 rounded-md border border-muted px-1">
                <button
                  type="button"
                  onClick={zoomOut}
                  disabled={!isReady || zoomLevel <= 50}
                  className="flex h-5 w-5 items-center justify-center rounded text-gray-500 hover:bg-gray-100 disabled:opacity-30 dark:hover:bg-gray-200/20"
                >
                  <PiMagnifyingGlassMinusBold className="h-3 w-3" />
                </button>
                <span className="min-w-[2.5rem] text-center text-[10px] tabular-nums text-gray-500">
                  {zoomLevel === 50 ? '1×' : `${Math.round(zoomLevel / 50)}×`}
                </span>
                <button
                  type="button"
                  onClick={zoomIn}
                  disabled={!isReady || zoomLevel >= 800}
                  className="flex h-5 w-5 items-center justify-center rounded text-gray-500 hover:bg-gray-100 disabled:opacity-30 dark:hover:bg-gray-200/20"
                >
                  <PiMagnifyingGlassPlusBold className="h-3 w-3" />
                </button>
              </div>
            </div>
          </>
        )}

        {showSkipEnds && (
          <>
            <div className="my-1 border-t border-muted" />
            <div className="flex gap-2 px-3 py-1.5">
              <button
                type="button"
                onClick={() => {
                  skipToStart();
                  close();
                }}
                disabled={!isReady}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-muted py-1.5 text-[11px] text-gray-600 hover:bg-gray-100 disabled:opacity-40 dark:text-gray-400 dark:hover:bg-gray-200/20"
              >
                <PiSkipBackFill className="h-3.5 w-3.5" />
                Start
              </button>
              <button
                type="button"
                onClick={() => {
                  skipToEnd();
                  close();
                }}
                disabled={!isReady}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-muted py-1.5 text-[11px] text-gray-600 hover:bg-gray-100 disabled:opacity-40 dark:text-gray-400 dark:hover:bg-gray-200/20"
              >
                End
                <PiSkipForwardFill className="h-3.5 w-3.5" />
              </button>
            </div>
          </>
        )}

        {(moreMenuItems?.length || onDownload || onShare || onDelete) && (
          <div className="my-1 border-t border-muted" />
        )}

        {moreMenuItems?.map((item, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => {
              item.onClick();
              close();
            }}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-xs text-gray-600 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-200/20"
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        ))}

        {onDownload && (
          <button
            type="button"
            onClick={() => {
              onDownload();
              close();
            }}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-xs text-gray-600 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-200/20"
          >
            <PiDownloadBold className="h-4 w-4 text-gray-500 dark:text-gray-400" />
            <span>{t('common.download', 'Download')}</span>
          </button>
        )}

        {onShare && (
          <button
            type="button"
            onClick={() => {
              onShare();
              close();
            }}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-xs text-gray-600 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-200/20"
          >
            <PiShareNetworkBold className="h-4 w-4 text-gray-500 dark:text-gray-400" />
            <span>{t('common.share', 'Share')}</span>
          </button>
        )}

        {onDelete && (
          <button
            type="button"
            onClick={() => {
              onDelete();
              close();
            }}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-xs text-red-500 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10"
          >
            <PiTrashBold className="h-4 w-4" />
            <span>{t('common.delete', 'Delete')}</span>
          </button>
        )}
    </FloatingPopoverPortal>
  );
}
