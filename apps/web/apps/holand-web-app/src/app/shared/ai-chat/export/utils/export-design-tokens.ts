/**
 * Design tokens aligned with AI Chat UI (message-bubble, hydrogen layout).
 * Used by HTML / static export builders — no emojis, no off-brand gradients.
 */
export const CHAT_EXPORT_CSS = `
  :root {
    --export-primary: #2563eb;
    --export-primary-fg: #ffffff;
    --export-surface: #ffffff;
    --export-muted: #f3f4f6;
    --export-border: #e5e7eb;
    --export-text: #111827;
    --export-text-muted: #6b7280;
    --export-assistant-bg: #f9fafb;
    --export-code-bg: #1e293b;
    --export-code-fg: #e2e8f0;
    --export-radius: 12px;
    --export-font: 'Vazirmatn', 'Tahoma', system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;
  }

  * { box-sizing: border-box; }
  html { scroll-behavior: smooth; }
  body {
    margin: 0;
    font-family: var(--export-font);
    font-size: 14px;
    line-height: 1.6;
    color: var(--export-text);
    background: var(--export-muted);
  }

  .export-shell {
    max-width: 920px;
    margin: 0 auto;
    background: #fff;
    min-height: 100vh;
    border-inline: 1px solid var(--export-border);
  }

  .export-header {
    padding: 20px 24px;
    border-bottom: 1px solid var(--export-border);
    background: #fff;
  }
  .export-header h1 {
    margin: 0 0 8px;
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--export-text);
  }
  .export-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 12px 20px;
    font-size: 12px;
    color: var(--export-text-muted);
  }

  .export-main { padding: 20px 24px 32px; }

  .export-message {
    display: flex;
    gap: 12px;
    margin-bottom: 24px;
    align-items: flex-start;
  }
  .export-message.user { flex-direction: row-reverse; }
  .export-avatar {
    flex-shrink: 0;
    width: 28px;
    height: 28px;
    border-radius: 9999px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    font-weight: 600;
    background: linear-gradient(135deg, rgba(37,99,235,.15), rgba(37,99,235,.08));
    color: var(--export-primary);
  }
  .export-message.user .export-avatar {
    background: var(--export-primary);
    color: var(--export-primary-fg);
  }
  .export-bubble {
    max-width: 85%;
    min-width: 0;
  }
  .export-bubble-inner {
    border-radius: var(--export-radius);
    padding: 10px 16px;
  }
  .export-message.user .export-bubble-inner {
    background: var(--export-primary);
    color: var(--export-primary-fg);
    border-end-end-radius: 4px;
  }
  .export-message.assistant .export-bubble-inner {
    background: var(--export-assistant-bg);
    border: 1px solid var(--export-border);
    border-start-start-radius: 4px;
  }
  .export-role-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    margin-bottom: 6px;
    font-size: 12px;
    font-weight: 600;
    color: var(--export-text-muted);
  }
  .export-message.user .export-role-row { color: rgba(255,255,255,.85); }
  .export-content { word-break: break-word; }
  .export-content[dir="auto"] { unicode-bidi: plaintext; }

  .export-content h1, .export-content h2, .export-content h3 {
    margin: 12px 0 8px;
    font-weight: 600;
  }
  .export-content p { margin: 8px 0; }
  .export-content ul, .export-content ol { margin: 8px 0; padding-inline-start: 24px; }
  .export-content code {
    font-family: ui-monospace, 'Cascadia Code', 'Courier New', monospace;
    font-size: 0.9em;
    background: rgba(0,0,0,.06);
    padding: 2px 6px;
    border-radius: 4px;
  }
  .export-message.user .export-content code {
    background: rgba(255,255,255,.15);
  }
  .export-content pre {
    margin: 12px 0;
    padding: 14px 16px;
    border-radius: 8px;
    background: var(--export-code-bg);
    color: var(--export-code-fg);
    overflow-x: auto;
    font-size: 12px;
    line-height: 1.5;
  }
  .export-content pre code {
    background: none;
    padding: 0;
    color: inherit;
  }
  .export-content table {
    border-collapse: collapse;
    width: 100%;
    margin: 12px 0;
    font-size: 13px;
  }
  .export-content th, .export-content td {
    border: 1px solid var(--export-border);
    padding: 8px 10px;
    text-align: start;
  }
  .export-content th { background: var(--export-muted); font-weight: 600; }
  .export-content blockquote {
    margin: 12px 0;
    padding-inline-start: 12px;
    border-inline-start: 3px solid var(--export-border);
    color: var(--export-text-muted);
  }
  .export-content img, .export-content video {
    max-width: 100%;
    border-radius: 8px;
    margin: 8px 0;
  }
  .export-content a { color: var(--export-primary); }

  .export-panel {
    margin-top: 12px;
    border: 1px solid var(--export-border);
    border-radius: 8px;
    overflow: hidden;
    background: #fff;
  }
  .export-panel summary {
    padding: 10px 14px;
    font-size: 12px;
    font-weight: 600;
    color: var(--export-text-muted);
    cursor: pointer;
    list-style: none;
    background: var(--export-muted);
  }
  .export-panel summary::-webkit-details-marker { display: none; }
  .export-panel-body { padding: 12px 14px; font-size: 13px; }

  .export-artifacts {
    margin-top: 12px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .export-artifact-card {
    border: 1px solid var(--export-border);
    border-radius: 8px;
    padding: 12px;
    background: #fff;
  }
  .export-artifact-name {
    font-size: 12px;
    font-weight: 600;
    margin-bottom: 8px;
    color: var(--export-text);
  }
  .export-artifact-preview audio, .export-artifact-preview video {
    width: 100%;
    max-width: 480px;
  }
  .export-artifact-dl {
    display: inline-block;
    margin-top: 8px;
    font-size: 12px;
    color: var(--export-primary);
    text-decoration: none;
  }

  .export-files-section {
    margin-top: 40px;
    padding-top: 24px;
    border-top: 1px solid var(--export-border);
  }
  .export-files-section h2 {
    font-size: 1rem;
    font-weight: 600;
    margin: 0 0 16px;
  }
  .export-files-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 12px;
  }

  .export-footer {
    padding: 16px 24px;
    border-top: 1px solid var(--export-border);
    font-size: 12px;
    color: var(--export-text-muted);
    text-align: center;
  }

  .mermaid { margin: 12px 0; text-align: center; }

  @media print {
    body { background: #fff; }
    .export-shell { border: none; max-width: none; }
    .export-panel { break-inside: avoid; }
    .export-message { break-inside: avoid; }
  }
`;
