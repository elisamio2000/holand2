'use client';

import { Tooltip } from '@/components/tooltip';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import cn from '@core/utils/class-names';
import { ActionIcon } from 'rizzui';
import {
  PiSlidersHorizontalBold,
  PiCaretRightBold,
  PiCaretLeftBold,
  PiCheckBold,
} from 'react-icons/pi';
import { PLAYBACK_SPEEDS } from '../constants';
import type {
  VideoAudioTrack,
  VideoQualityLevel,
  VideoSubtitleTrack,
} from '../types';

type Page = 'root' | 'quality' | 'speed' | 'audio' | 'subtitles';

interface SettingsMenuProps {
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
  /** White icon styling for overlay chrome. */
  overlay?: boolean;
}

/**
 * Consolidated settings popover (quality / speed / audio / subtitles / loop),
 * navigated as YouTube-style sub-pages. Fully theme-consistent and RTL-aware.
 */
export function SettingsMenu({
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
  overlay = false,
}: SettingsMenuProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState<Page>('root');

  const close = () => {
    setOpen(false);
    setPage('root');
  };

  const activeLevelLabel = autoLevel
    ? t('videoPlayer.auto', 'Auto')
    : levels.find((l) => l.id === activeLevelId)?.label ?? t('videoPlayer.auto', 'Auto');
  const speedLabel = playbackRate === 1 ? t('videoPlayer.normal', 'Normal') : `${playbackRate}x`;
  const activeSubtitleLabel = activeSubtitleId
    ? subtitles.find((s) => s.id === activeSubtitleId)?.label ?? t('videoPlayer.subtitlesOff', 'Off')
    : t('videoPlayer.subtitlesOff', 'Off');
  const activeAudioLabel =
    audioTracks.find((a) => a.id === activeAudioTrackId)?.label ?? '';

  const rowCls =
    'flex w-full items-center justify-between gap-3 px-3 py-2 text-start text-xs transition-colors hover:bg-gray-100 dark:hover:bg-gray-200/30';
  const optionCls = (active: boolean) =>
    cn(
      'flex w-full items-center justify-between gap-3 px-3 py-2 text-start text-xs transition-colors hover:bg-gray-100 dark:hover:bg-gray-200/30',
      active ? 'font-semibold text-primary' : 'text-gray-600 dark:text-gray-300'
    );

  return (
    <div className="relative">
      <Tooltip content={t('videoPlayer.settings', 'Settings')} placement="top">
        <ActionIcon
          variant="text"
          size="sm"
          onClick={() => setOpen((o) => !o)}
          className={cn(
            open && (overlay ? 'text-white' : 'text-primary dark:text-primary'),
            overlay
              ? 'text-white/80 hover:text-white'
              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
          )}
          aria-label={t('videoPlayer.settings', 'Settings')}
          aria-haspopup="menu"
          aria-expanded={open}
        >
          <PiSlidersHorizontalBold className="h-4 w-4" />
        </ActionIcon>
      </Tooltip>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={close} />
          <div
            role="menu"
            className="absolute bottom-full end-0 z-20 mb-1.5 max-h-72 w-56 overflow-y-auto rounded-lg border border-muted bg-gray-0 py-1 shadow-lg dark:bg-gray-50"
          >
            {page === 'root' && (
              <>
                <button type="button" className={rowCls} onClick={() => setPage('quality')} disabled={levels.length === 0}>
                  <span className="text-gray-700 dark:text-gray-200">{t('videoPlayer.quality', 'Quality')}</span>
                  <span className="flex items-center gap-1 text-gray-400">
                    {levels.length ? activeLevelLabel : t('videoPlayer.notAvailable', 'N/A')}
                    {levels.length > 0 && <PiCaretRightBold className="h-3 w-3 rtl:rotate-180" />}
                  </span>
                </button>

                <button type="button" className={rowCls} onClick={() => setPage('speed')}>
                  <span className="text-gray-700 dark:text-gray-200">{t('videoPlayer.speed', 'Speed')}</span>
                  <span className="flex items-center gap-1 text-gray-400">
                    {speedLabel}
                    <PiCaretRightBold className="h-3 w-3 rtl:rotate-180" />
                  </span>
                </button>

                {audioTracks.length > 1 && (
                  <button type="button" className={rowCls} onClick={() => setPage('audio')}>
                    <span className="text-gray-700 dark:text-gray-200">{t('videoPlayer.audioTrack', 'Audio')}</span>
                    <span className="flex items-center gap-1 text-gray-400">
                      {activeAudioLabel}
                      <PiCaretRightBold className="h-3 w-3 rtl:rotate-180" />
                    </span>
                  </button>
                )}

                {subtitles.length > 0 && (
                  <button type="button" className={rowCls} onClick={() => setPage('subtitles')}>
                    <span className="text-gray-700 dark:text-gray-200">{t('videoPlayer.subtitles', 'Subtitles')}</span>
                    <span className="flex items-center gap-1 text-gray-400">
                      {activeSubtitleLabel}
                      <PiCaretRightBold className="h-3 w-3 rtl:rotate-180" />
                    </span>
                  </button>
                )}

                <button type="button" className={rowCls} onClick={() => onLoopChange(!loop)}>
                  <span className="text-gray-700 dark:text-gray-200">{t('videoPlayer.loop', 'Loop')}</span>
                  <span
                    className={cn(
                      'relative h-4 w-7 rounded-full transition-colors',
                      loop ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-200/40'
                    )}
                  >
                    <span
                      className={cn(
                        'absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all',
                        loop ? 'start-3.5' : 'start-0.5'
                      )}
                    />
                  </span>
                </button>
              </>
            )}

            {page !== 'root' && (
              <button
                type="button"
                onClick={() => setPage('root')}
                className="flex w-full items-center gap-2 border-b border-muted px-3 py-2 text-start text-xs font-semibold text-gray-700 dark:text-gray-200"
              >
                <PiCaretLeftBold className="h-3 w-3 rtl:rotate-180" />
                {page === 'quality' && t('videoPlayer.quality', 'Quality')}
                {page === 'speed' && t('videoPlayer.speed', 'Speed')}
                {page === 'audio' && t('videoPlayer.audioTrack', 'Audio')}
                {page === 'subtitles' && t('videoPlayer.subtitles', 'Subtitles')}
              </button>
            )}

            {page === 'quality' && (
              <>
                <button type="button" className={optionCls(autoLevel)} onClick={() => { onLevelChange('auto'); close(); }}>
                  <span>{t('videoPlayer.auto', 'Auto')}</span>
                  {autoLevel && <PiCheckBold className="h-3.5 w-3.5" />}
                </button>
                {levels.map((lvl) => (
                  <button key={lvl.id} type="button" className={optionCls(!autoLevel && lvl.id === activeLevelId)} onClick={() => { onLevelChange(lvl.id); close(); }}>
                    <span>{lvl.label}</span>
                    {!autoLevel && lvl.id === activeLevelId && <PiCheckBold className="h-3.5 w-3.5" />}
                  </button>
                ))}
              </>
            )}

            {page === 'speed' && (
              <>
                {PLAYBACK_SPEEDS.map((s) => (
                  <button key={s} type="button" className={optionCls(s === playbackRate)} onClick={() => { onSpeedChange(s); close(); }}>
                    <span>{s === 1 ? t('videoPlayer.normal', 'Normal') : `${s}x`}</span>
                    {s === playbackRate && <PiCheckBold className="h-3.5 w-3.5" />}
                  </button>
                ))}
              </>
            )}

            {page === 'audio' && (
              <>
                {audioTracks.map((tr) => (
                  <button key={tr.id} type="button" className={optionCls(tr.id === activeAudioTrackId)} onClick={() => { onAudioTrackChange(tr.id); close(); }}>
                    <span>
                      {tr.label}
                      {tr.language ? <span className="ms-1 text-gray-400">({tr.language})</span> : null}
                    </span>
                    {tr.id === activeAudioTrackId && <PiCheckBold className="h-3.5 w-3.5" />}
                  </button>
                ))}
              </>
            )}

            {page === 'subtitles' && (
              <>
                <button type="button" className={optionCls(activeSubtitleId === null)} onClick={() => { onSubtitleChange(null); close(); }}>
                  <span>{t('videoPlayer.subtitlesOff', 'Off')}</span>
                  {activeSubtitleId === null && <PiCheckBold className="h-3.5 w-3.5" />}
                </button>
                {subtitles.map((s) => (
                  <button key={s.id} type="button" className={optionCls(s.id === activeSubtitleId)} onClick={() => { onSubtitleChange(s.id); close(); }}>
                    <span>
                      {s.label}
                      {s.language ? <span className="ms-1 text-gray-400">({s.language})</span> : null}
                    </span>
                    {s.id === activeSubtitleId && <PiCheckBold className="h-3.5 w-3.5" />}
                  </button>
                ))}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
