// ============================================
// TTS Types — VoxCPM2 / audio.tts proxy (/api/tts/*)
// ============================================

export interface TtsRunArgs {
  text: string;
  style_prompt?: string;
  reference_wav_b64?: string;
  prompt_wav_b64?: string;
  prompt_text?: string;
  cfg_value?: number;
  inference_timesteps?: number;
  model_path?: string;
  load_denoiser?: boolean;
}

export interface TtsUiChannel {
  audio_base64: string;
  sample_rate: number;
  duration_sec: number;
  text: string;
  final_text: string;
  mode: TtsMode;
  reference_used: boolean;
  prompt_used: boolean;
  style_prompt: string;
  cfg_value: number;
  inference_timesteps: number;
  model: string;
  device: string;
  output_path: string;
}

export interface TtsTimings {
  model_load_ms?: number;
  synthesis_ms?: number;
  encoding_ms?: number;
  total_ms?: number;
}

export interface TtsRunResponse {
  ok: boolean;
  error?: string;
  channels?: {
    ui: TtsUiChannel;
    metadata: Record<string, unknown>;
    [key: string]: unknown;
  };
  timings_ms?: TtsTimings;
}

export interface TtsHealthResponse {
  ok: boolean;
  tool: string;
  model: string;
  device: string;
}

export type TtsMode =
  | 'tts'
  | 'voice_design'
  | 'controllable_clone'
  | 'ultimate_clone';

export interface TtsFormState {
  text: string;
  stylePrompt: string;
  refFile: File | null;
  promptFile: File | null;
  promptText: string;
  cfgValue: number;
  timesteps: number;
}
