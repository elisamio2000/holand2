'use client';

// ============================================
// TTS Input Panel — form for text/audio inputs
// Handles all 4 synthesis modes automatically
// ============================================

import { useRef, useState } from 'react';
import { Loader } from 'rizzui';
import type { TtsFormState, TtsMode } from '@/types/tts.types';

/**
 * Detects synthesis mode from current form state.
 * Mirrors the same logic in tool.py and tool.js.
 */
function detectMode(state: TtsFormState): TtsMode {
  if (state.refFile && state.promptText.trim()) return 'ultimate_clone';
  if (state.refFile) return 'controllable_clone';
  if (state.text.trim().startsWith('(')) return 'voice_design';
  return 'tts';
}

const MODE_LABELS: Record<TtsMode, string> = {
  tts:                'TTS',
  voice_design:       'Voice Design',
  controllable_clone: 'Voice Clone',
  ultimate_clone:     'Ultimate Clone',
};

const MODE_COLORS: Record<TtsMode, string> = {
  tts:                'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
  voice_design:       'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  controllable_clone: 'bg-primary/10 text-primary dark:bg-blue-900/40 dark:text-blue-300',
  ultimate_clone:     'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
};

interface Props {
  onGenerate: (state: TtsFormState) => void;
  loading: boolean;
}

/**
 * TtsInputPanel — form for all TTS synthesis parameters.
 *
 * Detects mode automatically based on inputs:
 * - Text only → TTS
 * - Text starting with "(" → Voice Design
 * - + Reference WAV → Voice Clone
 * - + Reference WAV + Transcript → Ultimate Clone
 *
 * @requires TtsFormState
 * @example
 * <TtsInputPanel onGenerate={handleGenerate} loading={false} />
 */
export default function TtsInputPanel({ onGenerate, loading }: Props) {
  const [text, setText] = useState('');
  const [stylePrompt, setStylePrompt] = useState('');
  const [refFile, setRefFile] = useState<File | null>(null);
  const [promptFile, setPromptFile] = useState<File | null>(null);
  const [promptText, setPromptText] = useState('');
  const [cfgValue, setCfgValue] = useState(2.0);
  const [timesteps, setTimesteps] = useState(10);
  const [refDrag, setRefDrag] = useState(false);

  const refInputRef = useRef<HTMLInputElement>(null);
  const promptInputRef = useRef<HTMLInputElement>(null);

  const formState: TtsFormState = { text, stylePrompt, refFile, promptFile, promptText, cfgValue, timesteps };
  const mode = detectMode(formState);
  const canGenerate = text.trim().length > 0 && !loading;

  function handlePromptFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setPromptFile(f);
    const reader = new FileReader();
    reader.onload = (ev) => setPromptText((ev.target?.result as string) || '');
    reader.readAsText(f, 'UTF-8');
  }

  function handleRefDrop(e: React.DragEvent) {
    e.preventDefault();
    setRefDrag(false);
    const f = e.dataTransfer.files?.[0];
    if (f) setRefFile(f);
  }

  function removeRef() {
    setRefFile(null);
    setPromptFile(null);
    setPromptText('');
    if (refInputRef.current) refInputRef.current.value = '';
    if (promptInputRef.current) promptInputRef.current.value = '';
  }

  function removePrompt() {
    setPromptFile(null);
    setPromptText('');
    if (promptInputRef.current) promptInputRef.current.value = '';
  }

  // CFG fill percentage for the range track background
  const cfgFill = (((cfgValue - 0.5) / (10 - 0.5)) * 100).toFixed(1) + '%';
  const stepsFill = (((timesteps - 5) / (50 - 5)) * 100).toFixed(1) + '%';

  return (
    <div className="space-y-4">

      {/* ── Header ─────────────────────────────────────────── */}
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-xs font-semibold text-primary">
          TTS
        </div>
        <div className="flex-1">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            VoxCPM2 — Text to Speech
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            30 Languages · 48 kHz · Voice Clone · Voice Design
          </p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-medium ${MODE_COLORS[mode]}`}>
          {MODE_LABELS[mode]}
        </span>
      </div>

      {/* ── Text Input ─────────────────────────────────────── */}
      <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
        Input Text
      </label>
      <textarea
        rows={4}
        className="w-full resize-y rounded-lg border border-muted bg-gray-0 p-3 text-sm text-gray-900 placeholder-gray-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:bg-gray-50 dark:text-gray-100 dark:placeholder-gray-500"
        placeholder={'Plain text, long paragraph, or voice design prefix e.g.:\n(A young woman, gentle and sweet voice)Hello, welcome.'}
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={loading}
      />
      <p className="mb-4 mt-1 text-right text-xs text-gray-400">{text.length} characters</p>

      {/* ── Style Prompt ───────────────────────────────────── */}
      <div className="mb-4 flex items-center gap-2 rounded-lg border border-muted bg-gray-0 px-3 py-2 dark:bg-gray-50">
        <input
          type="text"
          className="flex-1 bg-transparent text-sm text-gray-900 placeholder-gray-400 focus:outline-none dark:text-gray-100 dark:placeholder-gray-500"
          placeholder="Style (optional): e.g. slightly faster, cheerful tone or calm and formal"
          value={stylePrompt}
          onChange={(e) => setStylePrompt(e.target.value)}
          disabled={loading}
        />
      </div>

      <hr className="mb-4 border-gray-100 dark:border-gray-700" />

      {/* ── Reference Audio ────────────────────────────────── */}
      <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
        Voice Reference - optional, for voice cloning
      </label>

      {refFile ? (
        <div className="mb-3 flex items-center justify-between rounded-lg border border-green-200 bg-green-50 px-3 py-2 dark:border-green-800 dark:bg-green-900/20">
            <span className="text-sm text-green-700 dark:text-green-300">{refFile.name}</span>
          <button
            type="button"
            onClick={removeRef}
            disabled={loading}
            className="rounded px-2 py-1 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
          >
            ✕ Remove
          </button>
        </div>
      ) : (
        <div
          className={`mb-3 cursor-pointer rounded-lg border-2 border-dashed p-5 text-center transition-colors ${
            refDrag
              ? 'border-primary bg-primary/10 dark:bg-primary/20'
              : 'border-gray-200 hover:border-primary dark:border-gray-600'
          }`}
          onDragOver={(e) => { e.preventDefault(); setRefDrag(true); }}
          onDragLeave={() => setRefDrag(false)}
          onDrop={handleRefDrop}
          onClick={() => refInputRef.current?.click()}
        >
          <input
            ref={refInputRef}
            type="file"
            accept=".wav,.flac,.mp3,.ogg,.m4a"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) setRefFile(f); }}
          />
          <div className="mb-1 text-sm font-medium text-primary">Upload</div>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            <span className="font-medium">Choose File</span> or drag & drop
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500">WAV, MP3, FLAC, OGG, M4A</p>
        </div>
      )}

      {/* ── Ultimate Clone: prompt transcript ──────────────── */}
      {refFile && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
            Ultimate Cloning — transcript of reference audio
          </p>
          <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
            Transcript file
          </label>
          {promptFile ? (
            <div className="mb-2 flex items-center justify-between rounded-lg border border-green-200 bg-green-50 px-3 py-2 dark:border-green-800 dark:bg-green-900/20">
            <span className="text-sm text-green-700 dark:text-green-300">{promptFile.name}</span>
              <button
                type="button"
                onClick={removePrompt}
                disabled={loading}
                className="rounded px-2 py-1 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
              >
                ✕ Remove
              </button>
            </div>
          ) : (
            <div
              className="mb-2 cursor-pointer rounded-lg border-2 border-dashed border-amber-200 p-3 text-center hover:border-amber-400 dark:border-amber-700"
              onClick={() => promptInputRef.current?.click()}
            >
              <input
                ref={promptInputRef}
                type="file"
                accept=".txt,.md"
                className="hidden"
                onChange={handlePromptFileChange}
              />
              <p className="text-xs text-gray-500 dark:text-gray-400">
                <span className="font-medium">Upload .txt/.md</span> — or type directly below
              </p>
            </div>
          )}
          <textarea
            rows={2}
            className="w-full resize-y rounded-lg border border-amber-200 bg-white p-2 text-sm text-gray-900 placeholder-gray-400 focus:border-amber-400 focus:outline-none dark:border-amber-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
            placeholder="Exactly what is said in the reference audio — for ultimate cloning"
            value={promptText}
            onChange={(e) => setPromptText(e.target.value)}
            disabled={loading}
          />
        </div>
      )}

      {/* ── Advanced Params ─────────────────────────────────── */}
      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2">

        {/* CFG Scale */}
        <div>
          <div className="mb-1 flex items-center justify-between">
            <span className="text-xs font-medium text-gray-600 dark:text-gray-400">CFG Scale</span>
            <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-mono text-gray-700 dark:bg-gray-700 dark:text-gray-300">
              {cfgValue}
            </span>
          </div>
          <input
            type="range" min="0.5" max="10" step="0.5"
            value={cfgValue}
            onChange={(e) => setCfgValue(parseFloat(e.target.value))}
            disabled={loading}
            className="h-2 w-full cursor-pointer accent-primary"
            style={{ '--fill-pct': cfgFill } as React.CSSProperties}
          />
          <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
            Guidance strength —{' '}
            <span className="text-gray-500 dark:text-gray-400">Suggested: 1.5–3.0</span>
          </p>
        </div>

        {/* Timesteps */}
        <div>
          <div className="mb-1 flex items-center justify-between">
            <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Timesteps</span>
            <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-mono text-gray-700 dark:bg-gray-700 dark:text-gray-300">
              {timesteps}
            </span>
          </div>
          <input
            type="range" min="5" max="50" step="5"
            value={timesteps}
            onChange={(e) => setTimesteps(parseInt(e.target.value, 10))}
            disabled={loading}
            className="h-2 w-full cursor-pointer accent-primary"
            style={{ '--fill-pct': stepsFill } as React.CSSProperties}
          />
          <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
            Diffusion steps —{' '}
            <span className="text-gray-500 dark:text-gray-400">Fast: 10 | Quality: 20–30</span>
          </p>
        </div>
      </div>

      {/* ── Generate Button ─────────────────────────────────── */}
      <button
        type="button"
        onClick={() => canGenerate && onGenerate(formState)}
        disabled={!canGenerate}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-white transition-all hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? (
          <>
            <Loader size="sm" />
            Generating audio…
          </>
        ) : (
          <>Generate Audio</>
        )}
      </button>
    </div>
  );
}
