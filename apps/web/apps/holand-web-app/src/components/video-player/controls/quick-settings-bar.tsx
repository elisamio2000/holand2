'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import cn from '@core/utils/class-names';
import {
  PiCameraBold,
  PiBookmarkSimpleBold,
  PiNotePencilBold,
  PiDotsThreeBold,
  PiRepeatBold,
} from 'react-icons/pi';
import { PLAYBACK_SPEEDS } from '../constants';
import { vpTokens } from '../helpers/variant-visual-tokens';
import type {
  VideoAudioTrack,
  VideoQualityLevel,
  VideoSubtitleTrack,
} from '../types';

interface QuickSettingsBarProps {
  playbackRate: number;
  onSpeedChange: (r: number) => void;
  levels: VideoQualityLevel[];
  activeLevelId: string;
  autoLevel: boolean;
  onLevelChange: (id: string) => void;
  audioTracks: VideoAudioTrack[];
  activeAudioTrackId: string | null;
  onAudioTrackChange: (id: string) => void;
  subtitles: VideoSubtitleTrack[];
  activeSubtitleId: string | null;
  onSubtitleChange: (id: string | null) => void;
  loop: boolean;
  onLoopChange: (v: boolean) => void;
  onScreenshot?: () => void;
  onBookmark?: () => void;
  onAnnotate?: () => void;
  moreMenuItems?: Array<{ icon: React.ReactNode; label: string; onClick: () => void }>;
  className?: string;
  dark?: boolean;
}

/** Advanced/Pro quick settings chips (mock advanced options row). */
export function QuickSettingsBar({
  playbackRate,
  onSpeedChange,
  levels,
  activeLevelId,
  autoLevel,
  onLevelChange,
  audioTracks,
  activeAudioTrackId,
  onAudioTrackChange,
  subtitles,
  activeSubtitleId,
  onSubtitleChange,
  loop,
  onLoopChange,
  onScreenshot,
  onBookmark,
  onAnnotate,
  moreMenuItems,
  className,
  dark = false,
}: QuickSettingsBarProps) {
  const { t } = useTranslation();
  const [moreOpen, setMoreOpen] = useState(false);

  const speedLabel = playbackRate === 1 ? '1.0x' : `${playbackRate}x`;
  const qualityLabel = autoLevel
    ? t('videoPlayer.auto', 'Auto')
    : levels.find((l) => l.id === activeLevelId)?.label ?? '—';
  const audioLabel =
    audioTracks.find((a) => a.id === activeAudioTrackId)?.label ??
    t('videoPlayer.default', 'Default');
  const subtitleLabel = activeSubtitleId
    ? subtitles.find((s) => s.id === activeSubtitleId)?.label ?? '—'
    : t('videoPlayer.off', 'Off');

  const chipCls = cn(
    vpTokens.quickChip,
    dark && 'text-white/80 hover:bg-white/10 hover:text-white'
  );

  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-center gap-2 rounded-lg border border-muted px-3 py-2',
        dark ? 'border-white/10 bg-black/40' : 'bg-gray-0 dark:bg-gray-50',
        className
      )}
    >
      <div className={chipCls}>
        <span className="text-[10px] font-medium uppercase tracking-wide opacity-70">
          {t('videoPlayer.speed', 'Speed')}
        </span>
        <select
          value={playbackRate}
          onChange={(e) => onSpeedChange(Number(e.target.value))}
          className="cursor-pointer border-0 bg-transparent text-xs font-semibold text-inherit outline-none"
          aria-label={t('videoPlayer.speed', 'Speed')}
        >
          {PLAYBACK_SPEEDS.map((s) => (
            <option key={s} value={s}>
              {s === 1 ? '1.0x' : `${s}x`}
            </option>
          ))}
        </select>
      </div>

      <div className={chipCls}>
        <span className="text-[10px] font-medium uppercase tracking-wide opacity-70">
          {t('videoPlayer.quality', 'Quality')}
        </span>
        <select
          value={autoLevel ? 'auto' : activeLevelId}
          onChange={(e) => onLevelChange(e.target.value)}
          disabled={levels.length === 0}
          className="max-w-[72px] cursor-pointer truncate border-0 bg-transparent text-xs font-semibold text-inherit outline-none"
          aria-label={t('videoPlayer.quality', 'Quality')}
        >
          <option value="auto">{t('videoPlayer.auto', 'Auto')}</option>
          {levels.map((l) => (
            <option key={l.id} value={l.id}>
              {l.label}
            </option>
          ))}
        </select>
      </div>

      {audioTracks.length > 1 && (
        <div className={chipCls}>
          <span className="text-[10px] font-medium uppercase tracking-wide opacity-70">
            {t('videoPlayer.audioTrack', 'Audio')}
          </span>
          <select
            value={activeAudioTrackId ?? ''}
            onChange={(e) => onAudioTrackChange(e.target.value)}
            className="max-w-[72px] cursor-pointer truncate border-0 bg-transparent text-xs font-semibold text-inherit outline-none"
            aria-label={t('videoPlayer.audioTrack', 'Audio')}
          >
            {audioTracks.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {subtitles.length > 0 && (
        <div className={chipCls}>
          <span className="text-[10px] font-medium uppercase tracking-wide opacity-70">
            {t('videoPlayer.subtitles', 'Subtitles')}
          </span>
          <select
            value={activeSubtitleId ?? ''}
            onChange={(e) => onSubtitleChange(e.target.value || null)}
            className="max-w-[72px] cursor-pointer truncate border-0 bg-transparent text-xs font-semibold text-inherit outline-none"
            aria-label={t('videoPlayer.subtitles', 'Subtitles')}
          >
            <option value="">{t('videoPlayer.off', 'Off')}</option>
            {subtitles.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      )}

      <button
        type="button"
        onClick={() => onLoopChange(!loop)}
        className={cn(chipCls, loop && 'text-primary dark:text-primary')}
        aria-pressed={loop}
        aria-label={t('videoPlayer.loop', 'Loop')}
      >
        <PiRepeatBold className="h-4 w-4" />
        <span className="text-[10px] font-medium">{t('videoPlayer.loop', 'Loop')}</span>
      </button>

      {onScreenshot && (
        <button type="button" onClick={onScreenshot} className={chipCls}>
          <PiCameraBold className="h-4 w-4" />
          <span className="text-[10px] font-medium">{t('videoPlayer.screenshot', 'Screenshot')}</span>
        </button>
      )}
      {onBookmark && (
        <button type="button" onClick={onBookmark} className={chipCls}>
          <PiBookmarkSimpleBold className="h-4 w-4" />
          <span className="text-[10px] font-medium">{t('videoPlayer.bookmark', 'Bookmark')}</span>
        </button>
      )}
      {onAnnotate && (
        <button type="button" onClick={onAnnotate} className={chipCls}>
          <PiNotePencilBold className="h-4 w-4" />
          <span className="text-[10px] font-medium">{t('videoPlayer.annotate', 'Annotate')}</span>
        </button>
      )}

      {moreMenuItems && moreMenuItems.length > 0 && (
        <div className="relative">
          <button type="button" onClick={() => setMoreOpen(!moreOpen)} className={chipCls}>
            <PiDotsThreeBold className="h-4 w-4" />
            <span className="text-[10px] font-medium">{t('common.more', 'More')}</span>
          </button>
          {moreOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setMoreOpen(false)} />
              <div className="absolute bottom-full end-0 z-50 mb-1 min-w-[140px] rounded-md border border-muted bg-gray-0 py-1 shadow-md dark:bg-gray-50">
                {moreMenuItems.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => {
                      item.onClick();
                      setMoreOpen(false);
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

      {/* Screen-reader summary */}
      <span className="sr-only">
        {speedLabel}, {qualityLabel}, {audioLabel}, {subtitleLabel}
      </span>
    </div>
  );
}
