# Media Playback — Legacy Exceptions

These surfaces intentionally **do not** use the Media Playback Session (MPS) stack.
They keep local or synthetic playback because MPS would add no value or would conflict
with non-HTMLMediaElement engines.

| Area | File | Reason |
|------|------|--------|
| Voice note recorder preview | `app/shared/messages/voice-note-recorder.tsx` | Ephemeral `blob:` URL from `MediaRecorder`; no artifact handoff or modal expand. |
| TTS output | `app/shared/tts/tts-audio-player.tsx` | Inline `data:` URL from synthesis API; short-lived, no storage artifact. |
| Bug reporter session replay | `app/shared/bug-reporter/components/session-replay-viewer.tsx` | rrweb `Replayer` clock — not `<audio>` / `<video>`; uses a plain scrubber UI. |

When adding new media UI, prefer `MpsUltraCompactAudio` / `MpsUltraCompactVideo`, `AudioPlayer` + `mediaSessionId`, or `VideoPlayer` + `mediaSessionId` unless the playback source matches one of the cases above.
