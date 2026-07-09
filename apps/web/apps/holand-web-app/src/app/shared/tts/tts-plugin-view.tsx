'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import toast, { Toaster } from 'react-hot-toast';
import FloatingNativeAiChat from '@/app/shared/native-ai-chat/floating-native-ai-chat';
import type { TtsFormState, TtsTimings, TtsUiChannel } from '@/types/tts.types';
import { ttsService } from '@/services/tts.service';
import TtsInputPanel from '@/app/shared/tts/tts-input-panel';
import TtsResultView from '@/app/shared/tts/tts-result-view';

/**
 * TtsPluginView — Native UI for /plugins/internal-plugin/tts (same-origin /api/tts).
 */
export default function TtsPluginView() {
  const pathname = usePathname();
  const [backendOk, setBackendOk] = useState<boolean | null>(null);
  const [backendInfo, setBackendInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resultUi, setResultUi] = useState<TtsUiChannel | null>(null);
  const [resultTimings, setResultTimings] = useState<TtsTimings>({});

  useEffect(() => {
    ttsService
      .health()
      .then((data) => {
        setBackendOk(true);
        setBackendInfo(`${data.model} · ${data.device}`);
      })
      .catch(() => {
        setBackendOk(false);
      });
  }, []);

  function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        resolve(result.split(',')[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  const handleGenerate = useCallback(async (form: TtsFormState) => {
    setLoading(true);
    setError('');
    setResultUi(null);
    setResultTimings({});

    try {
      let refB64: string | undefined;
      if (form.refFile) {
        refB64 = await fileToBase64(form.refFile);
      }

      const result = await ttsService.run({
        text: form.text,
        style_prompt: form.stylePrompt || undefined,
        reference_wav_b64: refB64,
        prompt_wav_b64: refB64 && form.promptText.trim() ? refB64 : undefined,
        prompt_text: form.promptText.trim() || undefined,
        cfg_value: form.cfgValue,
        inference_timesteps: form.timesteps,
      });

      if (result.ok && result.channels?.ui) {
        setResultUi(result.channels.ui);
        setResultTimings(result.timings_ms ?? {});
        toast.success('Audio generated successfully!');
      } else {
        const msg = result.error ?? 'Unknown error from backend';
        setError(msg);
        toast.error('Synthesis failed');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Connection error';
      setError(msg);
      toast.error('Server connection error');
    } finally {
      setLoading(false);
    }
  }, []);

  const buildNativeAiChatContext = useCallback(
    () => ({
      pathname: pathname ?? '',
      backend_ok: backendOk,
      backend_info: backendInfo,
      loading,
      error,
      has_audio_result: !!resultUi,
      timings_ms: resultTimings,
    }),
    [pathname, backendOk, backendInfo, loading, error, resultUi, resultTimings]
  );

  return (
    <div className="rounded-xl border border-muted bg-gray-0 p-4 text-gray-900 shadow-sm dark:bg-gray-50 dark:text-gray-100">
      <Toaster position="top-right" />
      <header className="mb-6 border-b border-muted pb-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">VoxCPM2 TTS</h2>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          audio.tts · proxy via {typeof window !== 'undefined' ? location.origin : ''}/api/tts
        </p>
        {backendOk === null && (
          <span className="mt-2 inline-block rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-500 dark:bg-gray-800">
            Checking backend…
          </span>
        )}
        {backendOk === true && (
          <span className="mt-2 inline-block rounded-full bg-green-100 px-3 py-1 text-xs text-green-700 dark:bg-green-900/30 dark:text-green-400">
            ✓ Backend ready · {backendInfo}
          </span>
        )}
        {backendOk === false && (
          <span className="mt-2 inline-block rounded-full bg-red-100 px-3 py-1 text-xs text-red-700 dark:bg-red-900/30 dark:text-red-400">
            ✗ Backend offline — set TTS_BACKEND_URL or start Python service (see docs)
          </span>
        )}
      </header>

      {backendOk === false && (
        <div className="mb-6 rounded-lg border border-dashed border-orange-300 bg-orange-50 p-4 dark:border-orange-800 dark:bg-orange-950/30">
          <p className="text-sm text-orange-800 dark:text-orange-300">
            Ensure the TTS backend is running. Configure <code className="font-mono">TTS_BACKEND_URL</code> via <code className="font-mono">check-and-run.ps1</code>.
          </p>
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      <TtsInputPanel onGenerate={handleGenerate} loading={loading} />

      {resultUi && (
        <div className="mt-6">
          <TtsResultView ui={resultUi} timings={resultTimings} />
        </div>
      )}

      <FloatingNativeAiChat surface="tts_plugin" buildContext={buildNativeAiChatContext} />
    </div>
  );
}
