'use client';

import { useTranslation } from 'react-i18next';
import {
  PiPhoneSlashBold,
  PiMicrophoneBold,
  PiMicrophoneSlashBold,
  PiVideoCameraBold,
  PiVideoCameraSlashBold,
  PiPhoneBold,
} from 'react-icons/pi';
import cn from '@core/utils/class-names';
import type { LiveCallStatus, LiveCallType } from './use-live-call';

type LiveCallPanelProps = {
  isOpen: boolean;
  callType: LiveCallType;
  partnerName?: string;
  status: LiveCallStatus;
  durationSec: number;
  isMuted: boolean;
  isCameraOff: boolean;
  onToggleMute: () => void;
  onToggleCamera: () => void;
  onEnd: () => void;
};

function formatDuration(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function LiveCallPanel({
  isOpen,
  callType,
  partnerName,
  status,
  durationSec,
  isMuted,
  isCameraOff,
  onToggleMute,
  onToggleCamera,
  onEnd,
}: LiveCallPanelProps) {
  const { t } = useTranslation();
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-muted bg-gray-0 p-6 shadow-2xl dark:bg-gray-50">
        <div className="text-center">
          <p className="text-sm text-gray-500">{t(`messages.call.${callType}`)}</p>
          <h3 className="mt-1 text-xl font-semibold">{partnerName ?? t('messages.call.unknown')}</h3>
          <p className="mt-2 text-sm text-primary">
            {status === 'connecting'
              ? t('messages.call.connecting')
              : formatDuration(durationSec)}
          </p>
        </div>

        {callType === 'video' && (
          <div className="mt-6 grid grid-cols-2 gap-3">
            <div
              className={cn(
                'flex aspect-video items-center justify-center rounded-xl bg-gray-900 text-xs text-white',
                isCameraOff && 'opacity-50'
              )}
            >
              {t('messages.call.localVideo')}
            </div>
            <div className="flex aspect-video items-center justify-center rounded-xl bg-gray-800 text-xs text-white">
              {t('messages.call.remoteVideo')}
            </div>
          </div>
        )}

        <p className="mt-4 text-center text-[10px] text-gray-400">{t('messages.call.mockHint')}</p>

        <div className="mt-6 flex items-center justify-center gap-4">
          <button
            type="button"
            onClick={onToggleMute}
            className={cn(
              'flex h-12 w-12 items-center justify-center rounded-full',
              isMuted ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-700'
            )}
            aria-label={t('messages.call.mute')}
          >
            {isMuted ? <PiMicrophoneSlashBold className="h-5 w-5" /> : <PiMicrophoneBold className="h-5 w-5" />}
          </button>
          {callType === 'video' && (
            <button
              type="button"
              onClick={onToggleCamera}
              className={cn(
                'flex h-12 w-12 items-center justify-center rounded-full',
                isCameraOff ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-700'
              )}
              aria-label={t('messages.call.camera')}
            >
              {isCameraOff ? (
                <PiVideoCameraSlashBold className="h-5 w-5" />
              ) : (
                <PiVideoCameraBold className="h-5 w-5" />
              )}
            </button>
          )}
          <button
            type="button"
            onClick={onEnd}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-red-600 text-white hover:bg-red-700"
            aria-label={t('messages.call.end')}
          >
            <PiPhoneSlashBold className="h-6 w-6" />
          </button>
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <PiPhoneBold className="h-5 w-5" />
          </div>
        </div>
      </div>
    </div>
  );
}
