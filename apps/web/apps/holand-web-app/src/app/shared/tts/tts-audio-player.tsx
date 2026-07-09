'use client';

import AudioPlayer from '@/components/audio-player';

interface Props {
  audioBase64: string;
  durationSec: number;
}

/**
 * TTS output — uses global AudioPlayer (chatInline variant).
 * Legacy exception: synthetic data URL, not MPS (see media-playback/LEGACY-EXCEPTIONS.md).
 */
export default function TtsAudioPlayer({ audioBase64, durationSec }: Props) {
  const dataUrl = `data:audio/wav;base64,${audioBase64}`;

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
      <p className="mb-3 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
        Audio Output
      </p>
      <AudioPlayer
        src={dataUrl}
        variant="chatInline"
        duration={durationSec}
        showWaveform={false}
      />
      <a
        href={dataUrl}
        download="voxcpm2_output.wav"
        className="mt-3 inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-600 hover:border-primary hover:text-primary dark:border-gray-600 dark:text-gray-400"
      >
        Download WAV
      </a>
    </div>
  );
}
