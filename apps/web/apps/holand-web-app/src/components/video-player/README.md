# Video Player Module

Global `@/components/video-player` â€” multi-variant player with HLS/DASH, chat inlineâ†”modal handoff, and One Search integration.

## Variant selection guide

| Surface | Variant | Chrome | Notes |
|---------|---------|--------|-------|
| Messenger / thread file row | `ultraCompact` | â€” | Hybrid: row tap â†’ modal; play â†’ lazy inline |
| AI artifact cards | `ultraCompact` | â€” | Same hybrid |
| AI Chat inline preview | `chatInline` | mini shell | `syncVideoRef` + `mirrorPlayback` |
| Map-chat bubble | `compact` | barBelow | Inline mini + video stage |
| File preview modal | `expanded` â†” `advanced` | overlay / pro | Toggle pro mode |
| One Search watch | `expanded` | overlay + cinema FS | |
| Markdown / bug reporter | `full` | overlay + cinema FS | Header card |
| In-app PiP dock | `pip` | overlay | via `GlobalVideoPlayerHost` |

## Variants

| Variant | Use |
|---------|-----|
| `ultraCompact` | List rows (messenger, artifacts, thread files) |
| `compact` | Mini inline player (map-chat) |
| `chatInline` | Chat bubble + expand handoff |
| `expanded` | Modal / watch page (overlay controls) |
| `full` | Standalone with metadata header |
| `advanced` | Filmstrip + sidebar + quick settings (pro mode) |
| `pip` | Floating dock |

## Props (new)

- `chromeMode`: `'barBelow' | 'overlay'`
- `fullscreenLayout`: `'standard' | 'cinema' | 'pro'`
- `rowId`, `inlinePlaybackActive`, `onInlinePlaybackRequest`, `onRowPreview` â€” ultraCompact hybrid

## Sync patterns

- `syncVideoRef` â€” shared `<video>` for inline â†” modal
- `mirrorPlayback` â€” display-only while modal open
- `controlsRef` â€” imperative API
- Prefs: `video-player-store` (`Holand-video-player-prefs`)
- PiP session: `video-player-session-store` + `GlobalVideoPlayerHost` (MPS `mediaSessionId` handoff via `requestVideoPiP`)

## Playback URLs

| Surface | Strategy |
|---------|----------|
| Chat inline | blob-first (JWT) |
| Modal / One Search | `getPlaybackStrategy()` |

See [video-player-backend-handoff.md](../../../docs/backend-integration/03-frontend-pages/video-player-backend-handoff.md).

## QA

[VIDEO-PLAYER-MANUAL-QA.md](../../../docs/VIDEO-PLAYER-MANUAL-QA.md)

