'use client';

// ============================================
// TTS Result View — shows audio player + meta
// ============================================

import type { TtsTimings, TtsUiChannel } from '@/types/tts.types';
import TtsAudioPlayer from './tts-audio-player';

const MODE_LABELS: Record<string, string> = {
  tts:                'TTS',
  voice_design:       'Voice Design',
  controllable_clone: 'Voice Clone',
  ultimate_clone:     'Ultimate Clone',
};

interface Props {
  ui: TtsUiChannel;
  timings: TtsTimings;
}

/**
 * TtsResultView — displays synthesized audio result.
 *
 * Shows the audio player, mode badge, and metadata grid.
 *
 * @param ui      - The `channels.ui` object from TtsRunResponse
 * @param timings - The `timings_ms` object from TtsRunResponse
 */
export default function TtsResultView({ ui, timings }: Props) {
  return (
    <div className="space-y-4">
      {/* Player */}
      {ui.audio_base64 && (
        <TtsAudioPlayer
          audioBase64={ui.audio_base64}
          durationSec={ui.duration_sec}
        />
      )}

      {/* Meta */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Details
        </p>
        <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
          <MetaItem label="Mode" value={MODE_LABELS[ui.mode] ?? ui.mode} />
          {ui.duration_sec > 0 && (
            <MetaItem label="Duration" value={`${ui.duration_sec.toFixed(2)} s`} />
          )}
          {ui.sample_rate > 0 && (
            <MetaItem label="Sample Rate" value={`${ui.sample_rate} Hz`} />
          )}
          {ui.style_prompt && (
            <MetaItem label="Style" value={ui.style_prompt} />
          )}
          {ui.model && (
            <MetaItem label="Model" value={ui.model} />
          )}
          {ui.device && (
            <MetaItem label="Device" value={ui.device} />
          )}
          {timings.synthesis_ms != null && (
            <MetaItem label="Synthesis" value={`${timings.synthesis_ms} ms`} />
          )}
          {timings.total_ms != null && (
            <MetaItem label="Total Time" value={`${timings.total_ms} ms`} />
          )}
        </div>

        {/* Synthesized text */}
        {ui.text && (
          <>
            <hr className="my-4 border-gray-100 dark:border-gray-700" />
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Synthesized Text
            </p>
            <div className="max-h-44 overflow-y-auto rounded-lg border border-gray-100 bg-gray-50 p-3 text-sm leading-relaxed text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
              {ui.text}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-800">
      <p className="text-xs text-gray-400 dark:text-gray-500">{label}</p>
      <p className="truncate font-medium text-gray-800 dark:text-gray-200">{value}</p>
    </div>
  );
}
