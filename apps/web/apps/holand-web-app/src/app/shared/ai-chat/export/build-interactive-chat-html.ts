import type {
  ConversationExportData,
  ExportLabels,
  ExportOptions,
  EmbeddedAsset,
} from './export-types';
import { CHAT_EXPORT_CSS } from './utils/export-design-tokens';
import { escapeHTML, markdownToHTML } from './utils/markdown-helpers';
import {
  enhanceExportHtmlOffline,
  HLJS_THEME_CSS,
} from './utils/export-offline-enhance';
import {
  EXPORT_MEDIA_CSS,
  EXPORT_MEDIA_SCRIPT,
  mediaPlayerId,
  renderMediaPreview,
} from './utils/export-html-media';
import {
  ARC_NAV_EXPORT_CSS,
  ARC_NAV_EXPORT_SCRIPT,
  arcMessageAnchorId,
  renderArcNavigatorHtml,
} from './build-export-arc-navigator';

export interface ChatHtmlBuildOptions extends ExportOptions {
  labels: ExportLabels;
}

function defaultLabels(): ExportLabels {
  return {
    user: 'User',
    assistant: 'Assistant',
    thinking: 'Thinking',
    tools: 'Tools',
    attachments: 'Attachments',
    sessionFiles: 'Session files',
    exportedAt: 'Exported',
    model: 'Model',
    totalMessages: 'Messages',
    footer: 'Exported from AI Chat',
  };
}

function esc(text: string): string {
  return escapeHTML(text);
}

function fileDomId(id: string): string {
  return 'file-' + id.replace(/[^a-zA-Z0-9_-]/g, '_');
}

/** Consistent DOM id for modal preview targets. */
function sourceDomId(id?: string, filename?: string): string {
  if (id) return fileDomId(id);
  return mediaPlayerId(filename || 'file');
}

function formatBytes(bytes: number): string {
  if (!bytes) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  let val = bytes;
  let u = 0;
  while (val >= 1024 && u < units.length - 1) {
    val /= 1024;
    u++;
  }
  return `${val.toFixed(val < 10 && u > 0 ? 1 : 0)} ${units[u]}`;
}

/** Neutral inline SVG icon per file category (design-system aligned, no emoji). */
function fileIcon(mime: string): string {
  const stroke = 'currentColor';
  if (mime.startsWith('image/')) {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="1.6"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>`;
  }
  if (mime.startsWith('audio/')) {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="1.6"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>`;
  }
  if (mime.startsWith('video/')) {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="1.6"><rect x="2" y="5" width="14" height="14" rx="2"/><path d="m22 8-6 4 6 4V8Z"/></svg>`;
  }
  if (mime === 'application/pdf') {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="1.6"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/></svg>`;
  }
  return `<svg viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="1.6"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/><path d="M9 13h6M9 17h6"/></svg>`;
}

interface AssetLike {
  filename: string;
  mimeType: string;
  dataUri?: string;
  relPath?: string;
  url: string;
}

function assetHref(asset: AssetLike): string {
  return asset.dataUri || asset.relPath || asset.url || '';
}

/** Short, human category label derived from the MIME type. */
function categoryLabel(mime: string, mediaType?: string): string {
  if (mediaType) return mediaType;
  if (mime.startsWith('image/')) return 'Image';
  if (mime.startsWith('audio/')) return 'Audio';
  if (mime.startsWith('video/')) return 'Video';
  if (mime === 'application/pdf') return 'PDF';
  if (mime.includes('word') || mime.includes('document')) return 'Document';
  if (mime.includes('sheet') || mime.includes('excel') || mime === 'text/csv') return 'Sheet';
  if (mime.startsWith('text/') || mime.includes('json')) return 'Text';
  return 'File';
}

function formatAssetDate(iso?: string): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

function renderAssetPreview(asset: AssetLike, mode: 'inline' | 'modal' = 'inline', seed?: string): string {
  const src = assetHref(asset);
  const pid = mediaPlayerId(seed || asset.filename);
  return renderMediaPreview(asset.mimeType || '', src, asset.filename, mode, pid);
}

/** Thumbnail used by the sidebar file card — image preview or category icon. */
function renderThumb(asset: AssetLike): string {
  const src = assetHref(asset);
  if (asset.mimeType.startsWith('image/') && src) {
    return `<span class="export-file-thumb has-img"><img src="${src}" alt="${esc(asset.filename)}" loading="lazy" /></span>`;
  }
  return `<span class="export-file-thumb">${fileIcon(asset.mimeType)}</span>`;
}

function renderInlineArtifact(
  asset: AssetLike,
  labels: { preview: string; download: string },
  domId?: string
): string {
  const href = assetHref(asset);
  const cat = categoryLabel(asset.mimeType);
  const ext = asset.filename.includes('.')
    ? asset.filename.split('.').pop()?.toUpperCase() || ''
    : '';
  const targetId = domId || sourceDomId(undefined, asset.filename);
  return `
    <details class="export-file-preview" open>
      <summary class="export-file-preview-head">
        ${fileIcon(asset.mimeType)}
        <span class="export-file-preview-name">${esc(asset.filename)}</span>
        ${ext ? `<span class="export-file-preview-badge">${esc(ext)}</span>` : ''}
        <span class="export-file-preview-badge">${esc(cat)}</span>
        <span class="export-file-preview-actions">
          <button type="button" class="export-file-preview-act" data-file-target="${targetId}" data-expand onclick="event.preventDefault();event.stopPropagation();">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>
            ${esc(labels.preview)}
          </button>
          <a class="export-file-preview-act" href="${href}" download="${esc(asset.filename)}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/></svg>
          </a>
        </span>
      </summary>
      <div class="export-file-preview-body">${renderAssetPreview(asset, 'inline', targetId)}</div>
    </details>`;
}

interface SidebarLabels {
  sessionFiles: string;
  aiMemory: string;
  preview: string;
  download: string;
  totalSuffix: string;
}

/** Right-rail Session Files panel — faithful to the AiChat ArtifactsPanel. */
function renderSidebar(assets: EmbeddedAsset[], L: SidebarLabels): string {
  const items = assets
    .map((a) => {
      const meta = [
        formatBytes(a.sizeBytes),
        categoryLabel(a.mimeType, a.mediaType),
        formatAssetDate(a.createdAt),
      ]
        .filter(Boolean)
        .map((m) => `<span>${esc(m)}</span>`)
        .join('<i class="export-dot">·</i>');
      const href = assetHref({ ...a, url: a.href || a.dataUri || a.relPath || '' });
      return `
      <div class="export-file-card">
        ${renderThumb({ filename: a.filename, mimeType: a.mimeType, dataUri: a.dataUri, relPath: a.relPath, url: href })}
        <div class="export-file-info">
          <p class="export-file-name" title="${esc(a.filename)}">${esc(a.filename)}</p>
          <div class="export-file-sub">${meta}</div>
          <div class="export-file-actions">
            <button type="button" class="export-file-act" data-file-target="${fileDomId(a.id)}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
              <span>${esc(L.preview)}</span>
            </button>
            <span class="export-dot">·</span>
            <a class="export-file-act" href="${href}" download="${esc(a.filename)}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/></svg>
              <span>${esc(L.download)}</span>
            </a>
          </div>
        </div>
      </div>`;
    })
    .join('');

  const totalBytes = assets.reduce((s, a) => s + (a.sizeBytes || 0), 0);

  return `
    <aside class="export-sidebar" id="export-sidebar">
      <div class="export-sidebar-tabs">
        <button type="button" class="export-tab active" data-tab="files">
          ${esc(L.sessionFiles)}
        </button>
        <button type="button" class="export-tab" data-tab="memory">
          ${esc(L.aiMemory)}
        </button>
        <button type="button" class="export-sidebar-collapse" id="export-sidebar-collapse" aria-label="Collapse sidebar" title="Collapse">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
      </div>
      <div class="export-tabpanel" data-panel="files">
        <div class="export-sidebar-list">${items}</div>
        <div class="export-sidebar-foot">${assets.length} — ${esc(formatBytes(totalBytes))} ${esc(L.totalSuffix)}</div>
      </div>
      <div class="export-tabpanel" data-panel="memory" hidden>
        <div class="export-memory-empty">${esc(L.aiMemory)}</div>
      </div>
    </aside>`;
}

interface FileSourceEntry {
  id: string;
  filename: string;
  mimeType: string;
  href: string;
}

/** Hidden metadata nodes — modal builds fresh players from data-* (no broken clone). */
function renderFileSources(entries: FileSourceEntry[]): string {
  if (!entries.length) return '';
  const cards = entries
    .map(
      (a) => `
      <div id="${esc(a.id)}" class="export-file-source" hidden
        data-filename="${esc(a.filename)}"
        data-mime="${esc(a.mimeType)}"
        data-src="${esc(a.href)}"></div>`
    )
    .join('');
  return `<div class="export-file-sources">${cards}</div>`;
}

function collectFileSources(
  assets: EmbeddedAsset[],
  messages: ConversationExportData['messages']
): FileSourceEntry[] {
  const map = new Map<string, FileSourceEntry>();
  for (const a of assets) {
    const id = fileDomId(a.id);
    map.set(id, {
      id,
      filename: a.filename,
      mimeType: a.mimeType,
      href: a.href || a.dataUri || a.relPath || '',
    });
  }
  for (const msg of messages) {
    for (const art of msg.artifacts || []) {
      const id = sourceDomId(art.id, art.filename);
      if (!map.has(id)) {
        map.set(id, {
          id,
          filename: art.filename,
          mimeType: art.mimeType,
          href: art.dataUri || art.relPath || art.url || '',
        });
      }
    }
  }
  return [...map.values()];
}

function renderMessage(
  msg: ConversationExportData['messages'][number],
  labels: ExportLabels,
  options: Partial<ChatHtmlBuildOptions>
): string {
  const isUser = msg.role === 'user';
  const roleLabel = isUser ? labels.user : labels.assistant;
  const avatarLetter = isUser ? 'U' : 'A';
  const ts = new Date(msg.timestamp).toLocaleString();

  let block = `
    <article class="export-message ${msg.role}" id="${esc(arcMessageAnchorId(msg.id))}" style="scroll-margin-top:24px">
      <div class="export-avatar" aria-hidden="true">${avatarLetter}</div>
      <div class="export-bubble">
        <div class="export-bubble-inner">
          <div class="export-role-row">
            <span>${esc(roleLabel)}</span>
            <time datetime="${esc(msg.timestamp)}">${esc(ts)}</time>
          </div>
          <div class="export-content" dir="auto">${markdownToHTML(msg.content)}</div>`;

  if (options.includeThinking && msg.thinking) {
    block += `
          <details class="export-panel">
            <summary>${esc(labels.thinking)}</summary>
            <div class="export-panel-body" dir="auto">${markdownToHTML(msg.thinking)}</div>
          </details>`;
  }

  if (options.includeToolRuns && msg.toolRuns?.length) {
    const items = msg.toolRuns
      .map(
        (t) =>
          `<li><strong>${esc(t.name)}</strong> — ${esc(String(t.status))}</li>`
      )
      .join('');
    block += `
          <details class="export-panel">
            <summary>${esc(labels.tools)} (${msg.toolRuns.length})</summary>
            <div class="export-panel-body"><ul>${items}</ul></div>
          </details>`;
  }

  if (options.includeArtifacts && msg.artifacts?.length) {
    const actLabels = {
      preview: labels.preview || 'Preview',
      download: labels.download || 'Download',
    };
    block += `
          <div class="export-artifacts">
            <div class="export-role-row" style="margin-bottom:4px">${esc(labels.attachments)}</div>
            ${msg.artifacts
              .map((a) =>
                renderInlineArtifact(a, actLabels, sourceDomId(a.id, a.filename))
              )
              .join('')}
          </div>`;
  }

  block += `
        </div>
      </div>
    </article>`;

  return block;
}

const LAYOUT_CSS = `
  html, body { height: 100%; }
  body { background: var(--export-muted); }
  .export-app {
    display: flex; min-height: 100vh; max-width: 1320px; margin: 0 auto;
    background: var(--export-surface, #fff); box-shadow: 0 0 0 1px var(--export-border);
  }

  /* Main column */
  .export-body { flex: 1; min-width: 0; display: flex; flex-direction: column; }
  .export-topbar {
    position: sticky; top: 0; z-index: 5;
    display: flex; align-items: center; justify-content: space-between; gap: 12px;
    padding: 10px 18px; background: var(--export-surface, #fff);
    border-bottom: 1px solid var(--export-border); min-height: 56px;
  }
  .export-model-badge {
    display: inline-flex; align-items: center; gap: 6px;
    font-size: 13px; font-weight: 600; color: var(--export-text);
    background: var(--export-muted); border: 1px solid var(--export-border);
    border-radius: 9999px; padding: 6px 12px;
  }
  .export-model-badge svg { width: 14px; height: 14px; color: var(--export-primary); }
  .export-topbar-start { display: flex; align-items: center; gap: 8px; min-width: 0; }
  .export-topbar-meta { display: flex; flex-wrap: wrap; gap: 4px 14px; font-size: 11.5px; color: var(--export-text-muted); }
  .export-topbar-end { display: flex; align-items: center; gap: 8px; }
  .export-rail-toggle, .export-sidebar-reopen {
    display: inline-flex; align-items: center; justify-content: center;
    width: 34px; height: 34px; border-radius: 8px; border: 1px solid var(--export-border);
    background: var(--export-surface); color: var(--export-text-muted); cursor: pointer;
    transition: background .15s, color .15s, border-color .15s;
  }
  .export-rail-toggle:hover, .export-sidebar-reopen:hover { color: var(--export-primary); border-color: color-mix(in srgb, var(--export-primary) 30%, var(--export-border)); background: var(--export-muted); }
  .export-rail-toggle svg, .export-sidebar-reopen svg { width: 16px; height: 16px; }
  .export-search-wrap { display: flex; align-items: center; gap: 6px; }
  .export-search {
    width: min(200px, 28vw); padding: 6px 10px; border-radius: 8px; border: 1px solid var(--export-border);
    font: inherit; font-size: 12px; background: var(--export-muted); color: var(--export-text);
  }
  .export-search:focus { outline: none; border-color: var(--export-primary); box-shadow: 0 0 0 2px color-mix(in srgb, var(--export-primary) 20%, transparent); }
  .export-search-count {
    font-size: 11px; color: var(--export-text-muted); white-space: nowrap; min-width: 2.5rem;
  }
  .export-message.hidden-by-search { display: none !important; }
  .export-message.search-hit .export-bubble-inner {
    outline: 2px solid color-mix(in srgb, var(--export-primary) 35%, transparent);
    outline-offset: 2px;
  }

  .export-main { flex: 1; min-width: 0; overflow-x: hidden; padding: 22px clamp(14px, 4vw, 48px); }
  .export-thread { max-width: 860px; margin: 0 auto; }
  .export-title { font-size: 1.15rem; font-weight: 700; margin: 0 0 20px; color: var(--export-text); }
  .export-footer { padding: 14px 18px; border-top: 1px solid var(--export-border); text-align: center; font-size: 12px; color: var(--export-text-muted); }

  /* Sidebar — matches AiChat ArtifactsPanel, collapsible like main app */
  .export-app.sidebar-collapsed .export-sidebar { width: 0; min-width: 0; opacity: 0; pointer-events: none; border: none; overflow: hidden; }
  .export-sidebar {
    width: 320px; flex-shrink: 0; border-inline-start: 1px solid var(--export-border);
    background: var(--export-surface, #fff); position: sticky; top: 0; align-self: flex-start;
    height: 100vh; display: flex; flex-direction: column; overflow: hidden;
    transition: width .25s ease, opacity .2s ease;
  }
  .export-sidebar-tabs { display: flex; border-bottom: 1px solid var(--export-border); flex-shrink: 0; align-items: stretch; }
  .export-sidebar-collapse {
    flex-shrink: 0; width: 36px; border: none; background: none; cursor: pointer;
    color: var(--export-text-muted); display: flex; align-items: center; justify-content: center;
    transition: color .15s, background .15s;
  }
  .export-sidebar-collapse:hover { color: var(--export-primary); background: var(--export-muted); }
  .export-sidebar-collapse svg { width: 16px; height: 16px; }
  html[dir="rtl"] .export-sidebar-collapse svg { transform: scaleX(-1); }
  .export-sidebar-reopen {
    position: fixed; bottom: 88px; inset-inline-end: 20px; z-index: 40;
    box-shadow: 0 4px 14px rgba(0,0,0,.12); display: none;
  }
  .export-app.sidebar-collapsed .export-sidebar-reopen { display: inline-flex; }
  .export-tab {
    flex: 1; background: none; border: none; cursor: pointer; font: inherit;
    padding: 14px 10px; font-size: 13px; font-weight: 600; color: var(--export-text-muted);
    border-bottom: 2px solid transparent; transition: color .15s, border-color .15s;
  }
  .export-tab:hover { color: var(--export-text); }
  .export-tab.active { color: var(--export-primary); border-bottom-color: var(--export-primary); }
  .export-tabpanel { display: flex; flex-direction: column; min-height: 0; flex: 1; overflow: hidden; }
  .export-tabpanel[hidden] { display: none; }
  .export-sidebar-list { overflow-y: auto; padding: 12px; display: flex; flex-direction: column; gap: 8px; }
  .export-sidebar-foot {
    flex-shrink: 0; border-top: 1px solid var(--export-border);
    padding: 8px 14px; font-size: 11px; color: var(--export-text-muted);
  }
  .export-memory-empty { padding: 40px 16px; text-align: center; font-size: 13px; color: var(--export-text-muted); }

  .export-file-card {
    display: flex; gap: 12px; align-items: flex-start;
    border: 1px solid var(--export-border); border-radius: 10px; padding: 12px;
    transition: border-color .15s, background .15s;
  }
  .export-file-card:hover { border-color: color-mix(in srgb, var(--export-primary) 30%, transparent); background: var(--export-muted); }
  .export-file-thumb {
    width: 40px; height: 40px; flex-shrink: 0; border-radius: 8px; overflow: hidden;
    display: flex; align-items: center; justify-content: center;
    border: 1px solid var(--export-border); background: var(--export-muted); color: var(--export-primary);
  }
  .export-file-thumb svg { width: 20px; height: 20px; }
  .export-file-thumb.has-img { background: none; }
  .export-file-thumb img { width: 100%; height: 100%; object-fit: cover; }
  .export-file-info { min-width: 0; flex: 1; }
  .export-file-name { margin: 0; font-size: 13px; font-weight: 600; color: var(--export-text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .export-file-sub { margin-top: 3px; display: flex; flex-wrap: wrap; align-items: center; gap: 5px; font-size: 11px; color: var(--export-text-muted); }
  .export-dot { color: var(--export-border); font-style: normal; }
  .export-file-actions { margin-top: 8px; display: flex; align-items: center; gap: 8px; font-size: 12px; }
  .export-file-act {
    display: inline-flex; align-items: center; gap: 4px; background: none; border: none;
    cursor: pointer; font: inherit; font-size: 12px; color: var(--export-text-muted);
    text-decoration: none; padding: 0; transition: color .15s;
  }
  .export-file-act:hover { color: var(--export-primary); }
  .export-file-act svg { width: 14px; height: 14px; }

  .export-artifact-name { display: flex; align-items: center; gap: 8px; }
  .export-artifact-name svg { width: 16px; height: 16px; color: var(--export-primary); flex-shrink: 0; }
  .export-artifact-preview iframe { width: 100%; min-height: 360px; border: 1px solid var(--export-border); border-radius: 8px; }
  .export-artifact-preview img, .export-artifact-preview video { max-width: 100%; height: auto; border-radius: 8px; }

  /* Preview modal */
  .export-modal-overlay {
    position: fixed; inset: 0; background: rgba(15,23,42,.66); display: none;
    align-items: center; justify-content: center; padding: 24px; z-index: 1000;
    backdrop-filter: blur(2px);
  }
  .export-modal-overlay.open { display: flex; }
  .export-modal {
    background: var(--export-surface, #fff); border-radius: 14px; max-width: 920px; width: 100%;
    max-height: 90vh; display: flex; flex-direction: column; overflow: hidden;
    box-shadow: 0 24px 60px rgba(0,0,0,.35);
  }
  .export-modal-head { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; border-bottom: 1px solid var(--export-border); font-weight: 600; font-size: 14px; }
  .export-modal-close { background: none; border: none; cursor: pointer; font-size: 22px; line-height: 1; color: var(--export-text-muted); padding: 2px 8px; border-radius: 8px; }
  .export-modal-close:hover { background: var(--export-muted); }
  .export-modal-body { padding: 16px; overflow: auto; }
  .export-modal-body img, .export-modal-body video { max-width: 100%; height: auto; display: block; margin: 0 auto; }
  .export-modal-body iframe { width: 100%; min-height: 70vh; border: none; }

  /* Scroll FABs */
  .export-fab-group {
    position: fixed; bottom: 24px; inset-inline-start: 50%; transform: translateX(-50%);
    display: flex; gap: 8px; z-index: 30;
  }
  html[dir="rtl"] .export-fab-group { transform: translateX(50%); }
  .export-fab {
    width: 40px; height: 40px; border-radius: 50%; border: 1px solid var(--export-border);
    background: var(--export-surface); color: var(--export-text-muted); cursor: pointer;
    box-shadow: 0 4px 12px rgba(0,0,0,.1); display: flex; align-items: center; justify-content: center;
    transition: color .15s, border-color .15s;
  }
  .export-fab:hover { color: var(--export-primary); border-color: var(--export-primary); }
  .export-fab svg { width: 18px; height: 18px; }

  @media (max-width: 980px) {
    .export-app { flex-direction: column; }
    .export-sidebar { width: 100%; height: auto; position: static; border-inline-start: none; border-top: 1px solid var(--export-border); max-height: 360px; order: 2; }
  }
  ${ARC_NAV_EXPORT_CSS}
`;

const APP_SCRIPT = `
  <script>
    ${EXPORT_MEDIA_SCRIPT}
    (function () {
      var app = document.querySelector('.export-app');
      var STORAGE_KEY = 'export-sidebar-open';

      function syncArcNavLayout() {
        var main = document.querySelector('.export-main');
        var arc = document.getElementById('export-arc-nav');
        if (main && arc) main.classList.add('has-arc-nav');
      }

      // Restore sidebar state
      try {
        var saved = localStorage.getItem(STORAGE_KEY);
        if (saved === 'false' && app) app.classList.add('sidebar-collapsed');
      } catch (e) {}
      syncArcNavLayout();

      function setSidebarOpen(open) {
        if (!app) return;
        app.classList.toggle('sidebar-collapsed', !open);
        try { localStorage.setItem(STORAGE_KEY, String(open)); } catch (e) {}
      }

      var collapseBtn = document.getElementById('export-sidebar-collapse');
      if (collapseBtn) collapseBtn.addEventListener('click', function () { setSidebarOpen(false); });
      var reopenBtn = document.getElementById('export-sidebar-reopen');
      if (reopenBtn) reopenBtn.addEventListener('click', function () { setSidebarOpen(true); });
      var topToggle = document.getElementById('export-rail-toggle');
      if (topToggle) topToggle.addEventListener('click', function () {
        setSidebarOpen(app && app.classList.contains('sidebar-collapsed'));
      });

      // Tab switching
      document.querySelectorAll('.export-tab').forEach(function (tab) {
        tab.addEventListener('click', function () {
          var name = tab.getAttribute('data-tab');
          document.querySelectorAll('.export-tab').forEach(function (t) {
            t.classList.toggle('active', t === tab);
          });
          document.querySelectorAll('.export-tabpanel').forEach(function (p) {
            p.hidden = p.getAttribute('data-panel') !== name;
          });
        });
      });

      // Build modal preview HTML from data attributes
      function buildModalPreview(filename, mime, src) {
        var pid = 'modal-' + Math.random().toString(36).slice(2, 8);
        if (mime.indexOf('image/') === 0) {
          return '<div class="export-img-viewer"><img src="' + src + '" alt="' + filename + '" class="export-img-modal" /><div class="export-img-toolbar"><button type="button" data-zoom="out">−</button><span class="export-img-zoom-lbl">100%</span><button type="button" data-zoom="in">+</button><button type="button" data-zoom="fit">Fit</button></div></div>';
        }
        if (mime.indexOf('audio/') === 0) {
          return buildAudioPlayerHtml(src, filename, pid, 'expanded');
        }
        if (mime.indexOf('video/') === 0) {
          return '<div class="export-video-player expanded"><video preload="metadata" src="' + src + '" controls playsinline class="export-video-el"></video><p class="export-video-caption">' + filename + '</p></div>';
        }
        if (mime === 'application/pdf') {
          return '<iframe class="export-pdf-frame" src="' + src + '" title="' + filename + '"></iframe>';
        }
        return '<a class="export-artifact-dl" href="' + src + '" download="' + filename + '">' + filename + '</a>';
      }

      function modalModeClass(mime) {
        if (mime.indexOf('audio/') === 0) return 'audio-mode';
        if (mime.indexOf('video/') === 0) return 'video-mode';
        if (mime.indexOf('image/') === 0) return 'image-mode';
        if (mime === 'application/pdf') return 'pdf-mode';
        return '';
      }

      var overlay = document.getElementById('export-modal-overlay');
      var modalEl = overlay && overlay.querySelector('.export-modal');
      var modalBody = document.getElementById('export-modal-body');
      var modalTitle = document.getElementById('export-modal-title');

      function openFile(targetId) {
        var node = document.getElementById(targetId);
        if (!node || !overlay || !modalBody) return;
        var filename = node.getAttribute('data-filename') || '';
        var mime = node.getAttribute('data-mime') || '';
        var src = node.getAttribute('data-src') || '';
        if (!src) return;
        modalBody.innerHTML = buildModalPreview(filename, mime, src);
        modalBody.className = 'export-modal-body ' + modalModeClass(mime);
        if (modalEl) modalEl.className = 'export-modal ' + modalModeClass(mime);
        if (modalTitle) modalTitle.textContent = filename;
        initAllMedia(modalBody);
        overlay.classList.add('open');
        var audio = modalBody.querySelector('audio');
        if (audio && mime.indexOf('audio/') === 0) audio.play().catch(function(){});
      }

      function closeModal() {
        if (!overlay || !modalBody) return;
        overlay.classList.remove('open');
        modalBody.innerHTML = '';
        if (modalEl) modalEl.className = 'export-modal';
        modalBody.className = 'export-modal-body';
      }

      document.querySelectorAll('[data-file-target]').forEach(function (btn) {
        btn.addEventListener('click', function (e) {
          e.preventDefault();
          e.stopPropagation();
          openFile(btn.getAttribute('data-file-target'));
        });
      });
      if (overlay) overlay.addEventListener('click', function (e) { if (e.target === overlay) closeModal(); });
      var closeBtn = document.getElementById('export-modal-close');
      if (closeBtn) closeBtn.addEventListener('click', closeModal);
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') closeModal();
      });

      // Message search — register early; normalize Persian/Arabic variants
      function normalizeSearchText(s) {
        return (s || '')
          .toLowerCase()
          .replace(/[\u064A\u0649]/g, '\u06CC')
          .replace(/[\u0643\u06A9]/g, '\u06A9')
          .replace(/[\u200C\u200D\uFEFF]/g, '')
          .replace(/\\s+/g, ' ')
          .trim();
      }

      function runMessageSearch() {
        var search = document.getElementById('export-search');
        var countEl = document.getElementById('export-search-count');
        if (!search) return;
        var q = normalizeSearchText(search.value);
        var messages = document.querySelectorAll('.export-message');
        var hits = 0;
        var firstHit = null;
        messages.forEach(function (msg) {
          msg.classList.remove('search-hit');
          var content = msg.querySelector('.export-content');
          var text = normalizeSearchText(content ? content.textContent : msg.textContent);
          var match = q.length === 0 || text.indexOf(q) !== -1;
          if (q.length > 0) {
            msg.classList.toggle('hidden-by-search', !match);
            if (match) {
              hits++;
              if (!firstHit) firstHit = msg;
              msg.classList.add('search-hit');
            }
          } else {
            msg.classList.remove('hidden-by-search');
          }
        });
        if (countEl) {
          countEl.textContent = q.length > 0 ? (hits + '/' + messages.length) : '';
        }
        if (firstHit && q.length > 0) {
          firstHit.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }

      var searchInput = document.getElementById('export-search');
      if (searchInput) {
        searchInput.addEventListener('input', runMessageSearch);
        searchInput.addEventListener('search', runMessageSearch);
        searchInput.addEventListener('keydown', function (e) {
          if (e.key === 'Escape') { searchInput.value = ''; runMessageSearch(); }
        });
      }

      // Init inline players (non-blocking for search)
      try { initAllMedia(document); } catch (e) {}
      syncArcNavLayout();

      // Scroll FABs
      var fabTop = document.getElementById('export-fab-top');
      var fabBottom = document.getElementById('export-fab-bottom');
      if (fabTop) fabTop.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: 'smooth' }); });
      if (fabBottom) fabBottom.addEventListener('click', function () { window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }); });

      // Copy code buttons
      document.querySelectorAll('pre code').forEach(function (code) {
        var pre = code.parentElement;
        if (!pre || pre.querySelector('.export-copy-code')) return;
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'export-copy-code';
        btn.textContent = 'Copy';
        btn.addEventListener('click', function () {
          navigator.clipboard.writeText(code.textContent || '').catch(function(){});
        });
        pre.style.position = 'relative';
        pre.appendChild(btn);
      });

      ${ARC_NAV_EXPORT_SCRIPT}
    })();
  </script>`;

/** Heuristic text direction from localized labels (Persian/Arabic → rtl). */
function detectDir(labels: ExportLabels): 'rtl' | 'ltr' {
  return /[\u0600-\u06FF]/.test(labels.sessionFiles + labels.user) ? 'rtl' : 'ltr';
}

function sidebarLabels(labels: ExportLabels): SidebarLabels {
  return {
    sessionFiles: labels.sessionFiles,
    aiMemory: labels.aiMemory || 'AI Memory',
    preview: labels.preview || 'Preview',
    download: labels.download || 'Download',
    totalSuffix: labels.totalSuffix || 'total',
  };
}

function assembleDocument(
  data: ConversationExportData,
  labels: ExportLabels,
  options: Partial<ChatHtmlBuildOptions>,
  messagesHtml: string
): string {
  const assets = data.embeddedAssets || [];
  const hasFiles = assets.length > 0;
  const dir = detectDir(labels);
  const fileSources = renderFileSources(collectFileSources(assets, data.messages));

  const metaBlock =
    options.includeMetadata !== false
      ? `
      <div class="export-topbar-meta">
        <span>${esc(labels.exportedAt)}: ${esc(new Date(data.metadata.exportedAt).toLocaleString())}</span>
        <span>${esc(labels.totalMessages)}: ${data.metadata.totalMessages}</span>
      </div>`
      : '';

  const sidebar = hasFiles ? renderSidebar(assets, sidebarLabels(labels)) : '';
  const railToggle = hasFiles
    ? `<button type="button" class="export-rail-toggle" id="export-rail-toggle" aria-label="Toggle files panel" title="${esc(labels.sessionFiles)}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
      </button>`
    : '';

  const modal = `
    <div class="export-modal-overlay" id="export-modal-overlay" role="dialog" aria-modal="true">
      <div class="export-modal">
        <div class="export-modal-head">
          <span id="export-modal-title"></span>
          <button type="button" class="export-modal-close" id="export-modal-close" aria-label="Close">×</button>
        </div>
        <div class="export-modal-body" id="export-modal-body"></div>
      </div>
    </div>`;

  const fabGroup = `
    <div class="export-fab-group">
      <button type="button" class="export-fab" id="export-fab-top" aria-label="Scroll to top">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 19V5M5 12l7-7 7 7"/></svg>
      </button>
      <button type="button" class="export-fab" id="export-fab-bottom" aria-label="Scroll to bottom">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12l7 7 7-7"/></svg>
      </button>
    </div>`;

  const sidebarReopen = hasFiles
    ? `<button type="button" class="export-sidebar-reopen" id="export-sidebar-reopen" aria-label="${esc(labels.sessionFiles)}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
      </button>`
    : '';

  const arcNavigator = renderArcNavigatorHtml(data.messages, hasFiles);

  return `<!DOCTYPE html>
<html lang="${dir === 'rtl' ? 'fa' : 'en'}" dir="${dir}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(data.title)}</title>
  <style>
    ${CHAT_EXPORT_CSS}${HLJS_THEME_CSS}${EXPORT_MEDIA_CSS}${LAYOUT_CSS}
    pre { position: relative; }
    .export-copy-code {
      position: absolute; top: 8px; inset-inline-end: 8px; font-size: 10px; padding: 2px 8px;
      border-radius: 4px; border: 1px solid var(--export-border); background: var(--export-muted);
      color: var(--export-text-muted); cursor: pointer; opacity: 0; transition: opacity .15s;
    }
    pre:hover .export-copy-code { opacity: 1; }
  </style>
</head>
<body>
  <div class="export-app${hasFiles ? ' has-sidebar' : ''}">
    <div class="export-body">
      <header class="export-topbar">
        <div class="export-topbar-start">
          ${railToggle}
          <span class="export-model-badge">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M9 9h6v6H9z"/></svg>
            ${esc(data.metadata.model || labels.model)}
          </span>
        </div>
        ${metaBlock}
        <div class="export-topbar-end">
          <div class="export-search-wrap">
            <input type="search" class="export-search" id="export-search" placeholder="${dir === 'rtl' ? 'جستجو در پیام‌ها…' : 'Search messages…'}" aria-label="Search messages" autocomplete="off" />
            <span class="export-search-count" id="export-search-count" aria-live="polite"></span>
          </div>
        </div>
      </header>
      <main class="export-main${arcNavigator ? ' has-arc-nav' : ''}">
        ${arcNavigator}
        <div class="export-thread">
          <h1 class="export-title">${esc(data.title)}</h1>
          ${messagesHtml}
        </div>
      </main>
      <footer class="export-footer">${esc(labels.footer)} — ${esc(data.metadata.exportedAt)}</footer>
    </div>
    ${sidebar}
  </div>
  ${fileSources}
  ${modal}
  ${fabGroup}
  ${sidebarReopen}
  ${APP_SCRIPT}
</body>
</html>`;
}

/**
 * Self-contained chat HTML export — offline app shell.
 * Sidebar lists all embedded session files; clicking opens a preview modal.
 * Code highlighted + Mermaid rendered to inline SVG at export time (no CDN).
 */
export async function buildInteractiveChatHtml(
  data: ConversationExportData,
  options: Partial<ChatHtmlBuildOptions> = {}
): Promise<string> {
  const labels = options.labels || defaultLabels();
  let messagesHtml = data.messages
    .map((msg) => renderMessage(msg, labels, options))
    .join('');

  messagesHtml = await enhanceExportHtmlOffline(messagesHtml);

  return assembleDocument(data, labels, options, messagesHtml);
}

/** Static HTML for DOCX / print — same content, same offline enhancement. */
export async function buildStaticChatHtml(
  data: ConversationExportData,
  options: Partial<ChatHtmlBuildOptions> = {}
): Promise<string> {
  return buildInteractiveChatHtml(data, {
    ...options,
    interactiveHtml: false,
  });
}

// ============================================
// Print report (PDF via browser print) — clean A4 pagination, single column,
// light code theme, no sidebar/modal. Tables/code/cards never split across pages.
// ============================================

const PRINT_CSS = `
  @page {
    size: A4;
    margin: 16mm 14mm 18mm 14mm;
  }

  :root {
    --rp-primary: #2563eb;
    --rp-user: #7c3aed;
    --rp-border: #e5e7eb;
    --rp-text: #111827;
    --rp-muted: #6b7280;
    --rp-font: 'Vazirmatn', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  }

  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #fff; }
  body {
    font-family: var(--rp-font);
    font-size: 11pt;
    line-height: 1.6;
    color: var(--rp-text);
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .rp-cover {
    text-align: center;
    padding: 24px 0 16px;
    border-bottom: 2px solid var(--rp-primary);
    margin-bottom: 18px;
  }
  .rp-cover h1 { font-size: 20pt; font-weight: 700; margin: 0 0 10px; }
  .rp-cover .rp-meta {
    display: flex; flex-wrap: wrap; gap: 6px 18px; justify-content: center;
    font-size: 9pt; color: var(--rp-muted);
  }

  .rp-message {
    margin: 0 0 14px;
    padding: 10px 12px 10px 14px;
    border: 1px solid var(--rp-border);
    border-inline-start: 3px solid var(--rp-primary);
    border-radius: 6px;
    break-inside: avoid;
  }
  .rp-message.user { border-inline-start-color: var(--rp-user); background: #faf9ff; }
  .rp-message.assistant { background: #fafafa; }
  .rp-role-row {
    display: flex; justify-content: space-between; align-items: baseline;
    gap: 10px; margin-bottom: 6px; font-size: 9.5pt; font-weight: 700;
  }
  .rp-message.user .rp-role { color: var(--rp-user); }
  .rp-message.assistant .rp-role { color: var(--rp-primary); }
  .rp-role-row time { font-weight: 400; color: var(--rp-muted); font-size: 8.5pt; }
  .rp-content[dir="auto"] { unicode-bidi: plaintext; }
  .rp-content h1 { font-size: 15pt; }
  .rp-content h2 { font-size: 13pt; }
  .rp-content h3 { font-size: 12pt; }
  .rp-content h1, .rp-content h2, .rp-content h3 { margin: 10px 0 6px; break-after: avoid; }
  .rp-content p { margin: 6px 0; }
  .rp-content ul, .rp-content ol { margin: 6px 0; padding-inline-start: 22px; }

  /* Light code theme for print (saves ink, readable) */
  .rp-content pre {
    background: #f6f8fa !important;
    color: #24292e !important;
    border: 1px solid #e1e4e8;
    border-radius: 6px;
    padding: 10px 12px;
    font-size: 9pt;
    line-height: 1.45;
    overflow: hidden;
    white-space: pre-wrap;
    word-break: break-word;
    break-inside: avoid;
  }
  .rp-content pre code, .rp-content pre code.hljs { color: #24292e !important; }
  .rp-content pre .hljs-comment { color: #6a737d !important; }
  .rp-content pre .hljs-keyword, .rp-content pre .hljs-selector-tag { color: #d73a49 !important; }
  .rp-content pre .hljs-string, .rp-content pre .hljs-regexp { color: #032f62 !important; }
  .rp-content pre .hljs-number, .rp-content pre .hljs-built_in { color: #005cc5 !important; }
  .rp-content pre .hljs-title, .rp-content pre .hljs-name { color: #6f42c1 !important; }
  .rp-content pre .hljs-attr, .rp-content pre .hljs-variable { color: #e36209 !important; }
  .rp-content pre .hljs-tag { color: #22863a !important; }
  .rp-content code {
    font-family: ui-monospace, 'Courier New', monospace; font-size: 9pt;
    background: rgba(0,0,0,.05); padding: 1px 5px; border-radius: 4px;
  }
  .rp-content pre code { background: none; padding: 0; }

  .rp-content table {
    border-collapse: collapse; width: 100%; margin: 8px 0; font-size: 9.5pt;
    break-inside: avoid;
  }
  .rp-content th, .rp-content td { border: 1px solid var(--rp-border); padding: 6px 8px; text-align: start; }
  .rp-content th { background: #f3f4f6; font-weight: 700; }
  .rp-content blockquote {
    margin: 8px 0; padding-inline-start: 10px;
    border-inline-start: 3px solid var(--rp-border); color: var(--rp-muted);
  }
  .rp-content img { max-width: 100%; height: auto; border-radius: 4px; break-inside: avoid; }
  .rp-content a { color: var(--rp-primary); }
  .export-mermaid { text-align: center; margin: 10px 0; break-inside: avoid; }
  .export-mermaid svg { max-width: 100%; height: auto; }
  .export-mermaid-fallback { break-inside: avoid; border: 1px solid #fed7aa; border-radius: 6px; }
  .export-mermaid-fallback-head { background: #fff7ed; color: #c2410c; font-size: 8.5pt; font-weight: 700; padding: 4px 10px; }

  .rp-panel { margin-top: 8px; border: 1px solid var(--rp-border); border-radius: 6px; break-inside: avoid; }
  .rp-panel-head { background: #f3f4f6; padding: 5px 10px; font-size: 9pt; font-weight: 700; color: var(--rp-muted); }
  .rp-panel-body { padding: 8px 10px; font-size: 10pt; }

  .rp-attachments { margin-top: 8px; }
  .rp-attachments-title { font-size: 9.5pt; font-weight: 700; color: var(--rp-muted); margin-bottom: 4px; }
  .rp-file { font-size: 9.5pt; margin: 2px 0; }

  .rp-files { margin-top: 18px; padding-top: 12px; border-top: 2px solid var(--rp-primary); break-before: page; }
  .rp-files h2 { font-size: 14pt; margin: 0 0 10px; }
  .rp-file-card { border: 1px solid var(--rp-border); border-radius: 6px; padding: 10px; margin-bottom: 10px; break-inside: avoid; }
  .rp-file-card .rp-file-name { font-size: 10pt; font-weight: 700; margin-bottom: 6px; }
  .rp-file-card img { max-width: 100%; height: auto; }
  .rp-file-note { font-size: 9pt; color: var(--rp-muted); }

  .rp-footer { margin-top: 18px; padding-top: 10px; border-top: 1px solid var(--rp-border); text-align: center; font-size: 8.5pt; color: var(--rp-muted); }
`;

function renderReportMessage(
  msg: ConversationExportData['messages'][number],
  labels: ExportLabels,
  options: Partial<ChatHtmlBuildOptions>
): string {
  const roleLabel = msg.role === 'user' ? labels.user : labels.assistant;
  const ts = new Date(msg.timestamp).toLocaleString();

  let block = `
    <section class="rp-message ${msg.role}">
      <div class="rp-role-row">
        <span class="rp-role">${esc(roleLabel)}</span>
        <time datetime="${esc(msg.timestamp)}">${esc(ts)}</time>
      </div>
      <div class="rp-content" dir="auto">${markdownToHTML(msg.content)}</div>`;

  if (options.includeThinking && msg.thinking) {
    block += `
      <div class="rp-panel">
        <div class="rp-panel-head">${esc(labels.thinking)}</div>
        <div class="rp-panel-body" dir="auto">${markdownToHTML(msg.thinking)}</div>
      </div>`;
  }

  if (options.includeToolRuns && msg.toolRuns?.length) {
    const items = msg.toolRuns
      .map((t) => `<li><strong>${esc(t.name)}</strong> — ${esc(String(t.status))}</li>`)
      .join('');
    block += `
      <div class="rp-panel">
        <div class="rp-panel-head">${esc(labels.tools)} (${msg.toolRuns.length})</div>
        <div class="rp-panel-body"><ul>${items}</ul></div>
      </div>`;
  }

  if (options.includeArtifacts && msg.artifacts?.length) {
    const files = msg.artifacts
      .map((a) => {
        if (a.mimeType.startsWith('image/') && (a.dataUri || a.url)) {
          return `<div class="rp-file"><img src="${a.dataUri || a.url}" alt="${esc(a.filename)}" /><div class="rp-file-note">${esc(a.filename)}</div></div>`;
        }
        return `<div class="rp-file">• ${esc(a.filename)} <span class="rp-file-note">(${esc(a.mimeType)})</span></div>`;
      })
      .join('');
    block += `
      <div class="rp-attachments">
        <div class="rp-attachments-title">${esc(labels.attachments)}</div>
        ${files}
      </div>`;
  }

  block += `
    </section>`;
  return block;
}

function renderReportFiles(assets: EmbeddedAsset[], label: string): string {
  if (!assets.length) return '';
  const cards = assets
    .map((a) => {
      const inner = a.mimeType.startsWith('image/')
        ? `<img src="${a.dataUri}" alt="${esc(a.filename)}" />`
        : `<div class="rp-file-note">${esc(a.mimeType)} — ${esc(formatBytes(a.sizeBytes))}</div>`;
      return `
      <div class="rp-file-card">
        <div class="rp-file-name">${esc(a.filename)}</div>
        ${inner}
      </div>`;
    })
    .join('');
  return `
    <section class="rp-files">
      <h2>${esc(label)}</h2>
      ${cards}
    </section>`;
}

/**
 * Print-optimized report HTML for PDF (browser "Save as PDF").
 * Clean A4 pagination, light code theme, single column, Persian-faithful.
 */
export async function buildPrintReportHtml(
  data: ConversationExportData,
  options: Partial<ChatHtmlBuildOptions> = {}
): Promise<string> {
  const labels = options.labels || defaultLabels();

  let messagesHtml = data.messages
    .map((msg) => renderReportMessage(msg, labels, options))
    .join('');

  messagesHtml = await enhanceExportHtmlOffline(messagesHtml);

  const assets = data.embeddedAssets || [];
  const metaBlock =
    options.includeMetadata !== false
      ? `
      <div class="rp-meta">
        <span>${esc(labels.exportedAt)}: ${esc(new Date(data.metadata.exportedAt).toLocaleString())}</span>
        <span>${esc(labels.model)}: ${esc(data.metadata.model)}</span>
        <span>${esc(labels.totalMessages)}: ${data.metadata.totalMessages}</span>
      </div>`
      : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(data.title)}</title>
  <style>${PRINT_CSS}</style>
</head>
<body>
  <header class="rp-cover">
    <h1>${esc(data.title)}</h1>
    ${metaBlock}
  </header>
  <main>
    ${messagesHtml}
  </main>
  ${renderReportFiles(assets, labels.sessionFiles)}
  <footer class="rp-footer">${esc(labels.footer)} — ${esc(data.metadata.exportedAt)}</footer>
</body>
</html>`;
}
