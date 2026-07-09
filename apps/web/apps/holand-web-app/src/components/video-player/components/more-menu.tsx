'use client';

import { useTranslation } from 'react-i18next';
import cn from '@core/utils/class-names';
import {
  PiRepeatBold,
  PiDownloadBold,
  PiShareNetworkBold,
  PiTrashBold,
  PiArrowsOutSimple,
} from 'react-icons/pi';
import { PLAYBACK_SPEEDS } from '../constants';

export interface VideoMoreMenuProps {
  open: boolean;
  onClose: () => void;
  placement?: 'above' | 'below';
  loop: boolean;
  onLoopChange: (v: boolean) => void;
  playbackRate: number;
  onSpeedChange: (r: number) => void;
  showSpeedInMenu?: boolean;
  onExpand?: () => void;
  onDownload?: () => void;
  onShare?: () => void;
  onDelete?: () => void;
  moreMenuItems?: Array<{ icon: React.ReactNode; label: string; onClick: () => void }>;
}

export function VideoPlayerMoreMenu({
  open,
  onClose,
  placement = 'below',
  loop,
  onLoopChange,
  playbackRate,
  onSpeedChange,
  showSpeedInMenu = true,
  onExpand,
  onDownload,
  onShare,
  onDelete,
  moreMenuItems,
}: VideoMoreMenuProps) {
  const { t } = useTranslation();

  if (!open) return null;

  const panelClass =
    placement === 'below'
      ? 'absolute end-0 top-full z-50 mt-1.5 w-52'
      : 'absolute bottom-full end-0 z-50 mb-1.5 w-52';

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        className={cn(
          panelClass,
          'overflow-hidden rounded-lg border border-muted bg-gray-0 py-1.5 shadow-lg dark:bg-gray-50'
        )}
      >
        <div className="mb-1 border-b border-muted px-3 pb-1.5 pt-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
          {t('videoPlayer.options', 'Options')}
        </div>

        <button
          type="button"
          onClick={() => onLoopChange(!loop)}
          className="flex w-full items-center gap-2.5 px-3 py-2 text-xs transition-colors hover:bg-gray-100 dark:hover:bg-gray-200/20"
        >
          <PiRepeatBold className={cn('h-4 w-4', loop ? 'text-primary' : 'text-gray-500 dark:text-gray-400')} />
          <span className={loop ? 'font-medium text-primary' : 'text-gray-600 dark:text-gray-400'}>
            {t('videoPlayer.loop', 'Loop')}
          </span>
          {loop && <span className="ml-auto h-2 w-2 rounded-full bg-primary" />}
        </button>

        {showSpeedInMenu && (
          <div className="border-t border-muted py-1">
            <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
              {t('videoPlayer.speed', 'Speed')}
            </div>
            {PLAYBACK_SPEEDS.map((speed) => (
              <button
                key={speed}
                type="button"
                onClick={() => onSpeedChange(speed)}
                className={cn(
                  'flex w-full items-center justify-between px-3 py-1.5 text-xs',
                  speed === playbackRate
                    ? 'bg-primary/5 font-semibold text-primary dark:bg-primary/10'
                    : 'text-gray-600 dark:text-gray-400'
                )}
              >
                <span>{speed === 1 ? t('videoPlayer.normal', 'Normal') : `${speed}×`}</span>
                {speed === playbackRate && <span className="text-[10px] text-primary">&bull;</span>}
              </button>
            ))}
          </div>
        )}

        {(onExpand || onDownload || onShare || onDelete || moreMenuItems?.length) && (
          <div className="my-1 border-t border-muted" />
        )}

        {onExpand && (
          <button
            type="button"
            onClick={() => {
              onExpand();
              onClose();
            }}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-xs text-gray-600 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-200/20"
          >
            <PiArrowsOutSimple className="h-4 w-4 text-gray-500 dark:text-gray-400" />
            <span>{t('videoPlayer.expand', 'Expand')}</span>
          </button>
        )}

        {moreMenuItems?.map((item, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => {
              item.onClick();
              onClose();
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
              onClose();
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
              onClose();
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
              onClose();
            }}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-xs text-red-500 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10"
          >
            <PiTrashBold className="h-4 w-4" />
            <span>{t('common.delete', 'Delete')}</span>
          </button>
        )}
      </div>
    </>
  );
}
