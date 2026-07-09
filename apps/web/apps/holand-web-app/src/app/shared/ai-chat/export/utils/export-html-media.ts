import { escapeHTML } from './markdown-helpers';

export type MediaPlayerMode = 'inline' | 'modal';

function esc(text: string): string {
  return escapeHTML(text);
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/** Unique id for wiring JS to a player instance. */
export function mediaPlayerId(seed: string): string {
  return 'mp-' + seed.replace(/[^a-zA-Z0-9_-]/g, '_');
}

function fileExt(filename: string): string {
  const dot = filename.lastIndexOf('.');
  return dot > 0 ? filename.slice(dot + 1).toUpperCase() : '';
}

/**
 * Custom audio player — mirrors chatInline / sticky bar layout
 * (progress strip, play/pause, seek, time, volume) without WaveSurfer.
 */
export function renderAudioPlayer(
  src: string,
  filename: string,
  mode: MediaPlayerMode,
  playerId: string
): string {
  const ext = fileExt(filename);
  const compact = mode === 'inline';
  const titleBlock = compact
    ? `<div class="export-audio-meta"><span class="export-audio-title">${esc(filename)}</span>${ext ? `<span class="export-audio-badge">${esc(ext)}</span>` : ''}</div>`
    : `<div class="export-audio-icon"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z"/></svg></div>
      <p class="export-audio-title">${esc(filename)}</p>
      ${ext ? `<span class="export-audio-badge">${esc(ext)}</span>` : ''}`;

  return `
    <div class="export-audio-player ${compact ? 'compact' : 'expanded'}" data-player-id="${esc(playerId)}" data-src="${esc(src)}">
      <audio preload="metadata" src="${esc(src)}" class="export-audio-el"></audio>
      <div class="export-audio-progress-strip"><div class="export-audio-progress-fill"></div></div>
      ${titleBlock}
      <div class="export-audio-controls">
        <button type="button" class="export-audio-play" aria-label="Play">
          <svg class="icon-play" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
          <svg class="icon-pause" viewBox="0 0 24 24" fill="currentColor" hidden><path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/></svg>
        </button>
        <span class="export-audio-time-inline"><span class="export-audio-cur">0:00</span> / <span class="export-audio-dur">0:00</span></span>
        <div class="export-audio-track">
          <input type="range" class="export-audio-seek" min="0" max="100" value="0" step="0.1" aria-label="Seek" />
        </div>
        <div class="export-audio-vol-wrap">
          <button type="button" class="export-audio-mute" aria-label="Mute">
            <svg class="icon-vol" viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0 0 14 7.97v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/></svg>
            <svg class="icon-muted" viewBox="0 0 24 24" fill="currentColor" hidden><path d="M16.5 12A4.5 4.5 0 0 0 14 7.97v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51A8.796 8.796 0 0 0 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3 3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06a8.99 8.99 0 0 0 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4 9.91 6.09 12 8.18V4z"/></svg>
          </button>
          <input type="range" class="export-audio-vol" min="0" max="100" value="80" aria-label="Volume" />
        </div>
      </div>
    </div>`;
}

/** Centered video player with poster-style chrome. */
export function renderVideoPlayer(
  src: string,
  filename: string,
  mode: MediaPlayerMode,
  playerId: string
): string {
  const compact = mode === 'inline';
  return `
    <div class="export-video-player ${compact ? 'compact' : 'expanded'}" data-player-id="${esc(playerId)}">
      <video preload="metadata" src="${esc(src)}" controls playsinline ${compact ? '' : 'class="export-video-el"'}></video>
      ${compact ? '' : `<p class="export-video-caption">${esc(filename)}</p>`}
    </div>`;
}

/** Image viewer with optional zoom in modal. */
export function renderImageViewer(src: string, filename: string, mode: MediaPlayerMode): string {
  if (mode === 'inline') {
    return `<img class="export-img-inline" src="${esc(src)}" alt="${esc(filename)}" loading="lazy" />`;
  }
  return `
    <div class="export-img-viewer">
      <img src="${esc(src)}" alt="${esc(filename)}" class="export-img-modal" />
      <div class="export-img-toolbar">
        <button type="button" data-zoom="out" aria-label="Zoom out">−</button>
        <span class="export-img-zoom-lbl">100%</span>
        <button type="button" data-zoom="in" aria-label="Zoom in">+</button>
        <button type="button" data-zoom="fit" aria-label="Fit">Fit</button>
      </div>
    </div>`;
}

export function renderMediaPreview(
  mime: string,
  src: string,
  filename: string,
  mode: MediaPlayerMode,
  playerId: string
): string {
  if (mime.startsWith('image/')) return renderImageViewer(src, filename, mode);
  if (mime.startsWith('audio/')) return renderAudioPlayer(src, filename, mode, playerId);
  if (mime.startsWith('video/')) return renderVideoPlayer(src, filename, mode, playerId);
  if (mime === 'application/pdf') {
    return `<iframe class="export-pdf-frame" src="${esc(src)}" title="${esc(filename)}" loading="lazy"></iframe>`;
  }
  return `<a class="export-artifact-dl" href="${esc(src)}" download="${esc(filename)}">${esc(filename)}</a>`;
}

export const EXPORT_MEDIA_CSS = `
  /* Inline file preview box — matches FilePreviewInline dashed pattern */
  .export-file-preview {
    margin-top: 10px; border: 1px dashed var(--export-border); border-radius: 10px;
    background: var(--export-muted); overflow: hidden;
  }
  .export-file-preview[open] { border-color: color-mix(in srgb, var(--export-primary) 35%, var(--export-border)); }
  .export-file-preview-head {
    display: flex; align-items: center; gap: 8px; padding: 10px 12px; cursor: pointer;
    list-style: none; font-size: 12px; font-weight: 600; color: var(--export-text);
  }
  .export-file-preview-head::-webkit-details-marker { display: none; }
  .export-file-preview-head svg { width: 16px; height: 16px; color: var(--export-primary); flex-shrink: 0; }
  .export-file-preview-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .export-file-preview-badge {
    font-size: 10px; font-weight: 700; text-transform: uppercase; color: var(--export-text-muted);
    background: var(--export-surface); border: 1px solid var(--export-border); border-radius: 4px; padding: 1px 5px;
  }
  .export-file-preview-actions { display: flex; gap: 6px; margin-inline-start: auto; }
  .export-file-preview-act {
    background: none; border: none; cursor: pointer; padding: 2px 6px; border-radius: 6px;
    color: var(--export-text-muted); font: inherit; font-size: 11px; display: inline-flex; align-items: center; gap: 3px;
  }
  .export-file-preview-act:hover { color: var(--export-primary); background: var(--export-surface); }
  .export-file-preview-act svg { width: 13px; height: 13px; }
  .export-file-preview-body { padding: 12px; border-top: 1px dashed var(--export-border); background: var(--export-surface); }

  /* Audio player — chatInline / sticky bar parity */
  .export-audio-player { width: 100%; position: relative; overflow: hidden; border-radius: 10px; border: 1px solid var(--export-border); background: var(--export-surface); }
  .export-audio-el { display: none; }
  .export-audio-progress-strip { height: 2px; width: 100%; background: var(--export-muted); }
  .export-audio-progress-fill { height: 100%; width: 0%; background: var(--export-primary); transition: width .15s linear; }
  .export-audio-player.expanded {
    display: flex; flex-direction: column; align-items: center; padding: 16px 16px 14px;
    max-width: 520px; margin: 0 auto;
  }
  .export-audio-player.compact { padding: 10px 12px; }
  .export-audio-meta { display: flex; align-items: center; gap: 6px; margin-bottom: 8px; min-width: 0; }
  .export-audio-player.compact .export-audio-meta { margin-bottom: 0; margin-top: 8px; }
  .export-audio-icon {
    width: 56px; height: 56px; border-radius: 50%; background: color-mix(in srgb, var(--export-primary) 12%, transparent);
    display: flex; align-items: center; justify-content: center; color: var(--export-primary); margin-bottom: 10px;
  }
  .export-audio-icon svg { width: 28px; height: 28px; }
  .export-audio-title { margin: 0; font-size: 13px; font-weight: 600; color: var(--export-text); word-break: break-word; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .export-audio-player.expanded .export-audio-title { text-align: center; margin-bottom: 4px; white-space: normal; }
  .export-audio-badge {
    font-size: 10px; font-weight: 700; text-transform: uppercase; color: var(--export-text-muted);
    background: var(--export-muted); padding: 2px 6px; border-radius: 4px; flex-shrink: 0;
  }
  .export-audio-player.expanded .export-audio-badge { margin-bottom: 12px; }
  .export-audio-controls {
    display: flex; align-items: center; gap: 10px; width: 100%;
  }
  .export-audio-play {
    width: 36px; height: 36px; flex-shrink: 0; border-radius: 50%; border: none; cursor: pointer;
    background: var(--export-primary); color: #fff; display: flex; align-items: center; justify-content: center;
    transition: transform .12s, opacity .12s;
  }
  .export-audio-play:hover { opacity: .9; transform: scale(1.04); }
  .export-audio-play svg { width: 16px; height: 16px; }
  .export-audio-time-inline {
    flex-shrink: 0; font-size: 11px; color: var(--export-text-muted); font-variant-numeric: tabular-nums; white-space: nowrap;
  }
  .export-audio-track { flex: 1; min-width: 0; display: flex; align-items: center; }
  .export-audio-seek {
    width: 100%; height: 4px; cursor: pointer; accent-color: var(--export-primary);
    -webkit-appearance: none; appearance: none; background: var(--export-border); border-radius: 2px;
  }
  .export-audio-vol-wrap { display: flex; align-items: center; gap: 4px; flex-shrink: 0; }
  .export-audio-mute { background: none; border: none; cursor: pointer; color: var(--export-text-muted); padding: 4px; display: flex; }
  .export-audio-mute svg { width: 16px; height: 16px; }
  .export-audio-vol { width: 52px; height: 3px; accent-color: var(--export-primary); cursor: pointer; }

  /* Video */
  .export-video-player.expanded { max-width: 100%; margin: 0 auto; text-align: center; }
  .export-video-player video, .export-video-el {
    width: 100%; max-height: 70vh; border-radius: 10px; background: #000;
  }
  .export-video-caption { margin: 10px 0 0; font-size: 12px; color: var(--export-text-muted); text-align: center; }
  .export-img-inline { max-width: 100%; border-radius: 8px; }
  .export-img-viewer { text-align: center; }
  .export-img-modal { max-width: 100%; max-height: 75vh; transition: transform .2s; border-radius: 8px; }
  .export-img-toolbar {
    display: flex; align-items: center; justify-content: center; gap: 8px; margin-top: 12px;
  }
  .export-img-toolbar button {
    background: var(--export-muted); border: 1px solid var(--export-border); border-radius: 8px;
    padding: 4px 12px; cursor: pointer; font-size: 14px; color: var(--export-text);
  }
  .export-img-zoom-lbl { font-size: 12px; color: var(--export-text-muted); min-width: 42px; text-align: center; }
  .export-pdf-frame { width: 100%; min-height: 70vh; border: none; border-radius: 8px; }

  /* Modal sizing per media type */
  .export-modal.audio-mode { max-width: 520px; }
  .export-modal.video-mode { max-width: 960px; }
  .export-modal.image-mode { max-width: 1000px; }
  .export-modal.pdf-mode { max-width: 960px; }
  .export-modal-body.audio-mode { display: flex; align-items: center; justify-content: center; min-height: 200px; }
`;

const EXPORT_AUDIO_EXPANDED_SHELL = renderAudioPlayer('__SRC__', '__NAME__', 'modal', '__PID__');
const EXPORT_AUDIO_COMPACT_SHELL = renderAudioPlayer('__SRC__', '__NAME__', 'inline', '__PID__');

export const EXPORT_MEDIA_SCRIPT = `
  function formatTime(s) {
    if (!isFinite(s) || s < 0) return '0:00';
    var m = Math.floor(s / 60), sec = Math.floor(s % 60);
    return m + ':' + (sec < 10 ? '0' : '') + sec;
  }
  var EXPORT_AUDIO_EXPANDED_SHELL = ${JSON.stringify(EXPORT_AUDIO_EXPANDED_SHELL)};
  var EXPORT_AUDIO_COMPACT_SHELL = ${JSON.stringify(EXPORT_AUDIO_COMPACT_SHELL)};
  function buildAudioPlayerHtml(src, filename, pid, mode) {
    var shell = mode === 'inline' ? EXPORT_AUDIO_COMPACT_SHELL : EXPORT_AUDIO_EXPANDED_SHELL;
    return shell.split('__SRC__').join(src).split('__NAME__').join(filename).split('__PID__').join(pid);
  }
  function initAudioPlayer(root) {
    var audio = root.querySelector('audio');
    if (!audio) return;
    var playBtn = root.querySelector('.export-audio-play');
    var seek = root.querySelector('.export-audio-seek');
    var cur = root.querySelector('.export-audio-cur');
    var dur = root.querySelector('.export-audio-dur');
    var progressFill = root.querySelector('.export-audio-progress-fill');
    var muteBtn = root.querySelector('.export-audio-mute');
    var vol = root.querySelector('.export-audio-vol');
    var iconPlay = root.querySelector('.icon-play');
    var iconPause = root.querySelector('.icon-pause');
    var iconVol = root.querySelector('.icon-vol');
    var iconMuted = root.querySelector('.icon-muted');
    if (!playBtn || !seek) return;

    function syncUI() {
      var d = audio.duration || 0;
      var t = audio.currentTime || 0;
      if (dur) dur.textContent = formatTime(d);
      if (cur) cur.textContent = formatTime(t);
      if (d > 0) seek.value = String((t / d) * 100);
      if (progressFill && d > 0) progressFill.style.width = String((t / d) * 100) + '%';
      var playing = !audio.paused && !audio.ended;
      if (iconPlay) iconPlay.hidden = playing;
      if (iconPause) iconPause.hidden = !playing;
    }
    playBtn.addEventListener('click', function () {
      if (audio.paused) audio.play().catch(function(){});
      else audio.pause();
    });
    seek.addEventListener('input', function () {
      var d = audio.duration;
      if (d > 0) audio.currentTime = (parseFloat(seek.value) / 100) * d;
    });
    audio.addEventListener('timeupdate', syncUI);
    audio.addEventListener('loadedmetadata', syncUI);
    audio.addEventListener('play', syncUI);
    audio.addEventListener('pause', syncUI);
    if (vol) {
      audio.volume = parseFloat(vol.value) / 100;
      vol.addEventListener('input', function () {
        audio.volume = parseFloat(vol.value) / 100;
        audio.muted = false;
        if (iconVol) iconVol.hidden = false;
        if (iconMuted) iconMuted.hidden = true;
      });
    }
    if (muteBtn) {
      muteBtn.addEventListener('click', function () {
        audio.muted = !audio.muted;
        if (iconVol) iconVol.hidden = audio.muted;
        if (iconMuted) iconMuted.hidden = !audio.muted;
      });
    }
    syncUI();
  }
  function initImageViewer(root) {
    var img = root.querySelector('.export-img-modal');
    var lbl = root.querySelector('.export-img-zoom-lbl');
    if (!img) return;
    var zoom = 100;
    function apply() { img.style.transform = 'scale(' + (zoom/100) + ')'; if (lbl) lbl.textContent = zoom + '%'; }
    root.querySelectorAll('[data-zoom]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var z = btn.getAttribute('data-zoom');
        if (z === 'in') zoom = Math.min(zoom + 25, 400);
        else if (z === 'out') zoom = Math.max(zoom - 25, 25);
        else zoom = 100;
        apply();
      });
    });
  }
  function initAllMedia(scope) {
    (scope || document).querySelectorAll('.export-audio-player').forEach(initAudioPlayer);
    (scope || document).querySelectorAll('.export-img-viewer').forEach(initImageViewer);
  }
`;
