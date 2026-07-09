import { messagesService } from '@/services/messages.service';
import type { BugReportSession } from '../types';

export interface BugReportUploadResult {
  screenshotIds: string[];
  videoId?: string;
  sessionJsonId?: string;
}

export class BugReportUploadError extends Error {
  constructor(
    message: string,
    public readonly failedAssets: string[]
  ) {
    super(message);
    this.name = 'BugReportUploadError';
  }
}

async function dataUrlToFile(dataUrl: string, filename: string): Promise<File> {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  return new File([blob], filename, { type: blob.type });
}

async function blobToFile(blob: Blob, filename: string): Promise<File> {
  return new File([blob], filename, { type: blob.type });
}

async function jsonToFile(data: unknown, filename: string): Promise<File> {
  const jsonString = JSON.stringify(
    data,
    (_key, value) => (value instanceof Blob ? '[Blob]' : value),
    2
  );
  const blob = new Blob([jsonString], { type: 'application/json' });
  return new File([blob], filename, { type: 'application/json' });
}

const SESSION_JSON_SOFT_LIMIT = 4 * 1024 * 1024;

/** Shrink session payload so messenger /upload accepts it (rrweb can be huge). */
function buildSessionJsonPayload(session: BugReportSession): Record<string, unknown> {
  const omitScreenshots = session.screenshots.map((s, i) => ({
    index: i,
    timestamp: s.timestamp,
    uploadedSeparately: true,
  }));

  const base: Record<string, unknown> = {
    ...session,
    videoBlob: undefined,
    screenshots: omitScreenshots,
  };

  let serialized = JSON.stringify(base, (_k, v) => (v instanceof Blob ? '[Blob]' : v));
  if (serialized.length <= SESSION_JSON_SOFT_LIMIT) {
    return base;
  }

  const withoutRrweb: Record<string, unknown> = {
    ...base,
    rrwebEvents: [],
    rrwebOmitted: true,
    rrwebEventCount: session.rrwebEvents.length,
  };
  serialized = JSON.stringify(withoutRrweb);
  if (serialized.length <= SESSION_JSON_SOFT_LIMIT) {
    return withoutRrweb;
  }

  return {
    id: session.id,
    startTime: session.startTime,
    endTime: session.endTime,
    metadata: session.metadata,
    actions: session.actions,
    consoleLog: session.consoleLog.slice(-200),
    networkLog: session.networkLog.slice(-100).map(({ requestBody, responseBody, ...rest }) => rest),
    errorLog: session.errorLog.slice(-50),
    navigationLog: session.navigationLog?.slice(-50),
    captureMode: session.captureMode,
    bufferDuration: session.bufferDuration,
    rrwebOmitted: true,
    rrwebEventCount: session.rrwebEvents.length,
    screenshots: omitScreenshots,
    compact: true,
  };
}

async function uploadSessionJsonFile(
  session: BugReportSession
): Promise<{ artifactId: string }> {
  const payload = buildSessionJsonPayload(session);
  const sessionFile = await jsonToFile(payload, `bug-${session.id}-session.json`);
  return messagesService.uploadAttachment(sessionFile);
}

export async function uploadBugReportAssets(
  session: BugReportSession,
  onProgress?: (step: string, progress: number) => void
): Promise<BugReportUploadResult> {
  const result: BugReportUploadResult = { screenshotIds: [] };
  const failedAssets: string[] = [];

  onProgress?.('Uploading screenshots...', 10);

  for (let i = 0; i < session.screenshots.length; i++) {
    const screenshot = session.screenshots[i];
    try {
      const file = await dataUrlToFile(
        screenshot.dataUrl,
        `bug-${session.id}-screenshot-${i + 1}.png`
      );
      const uploaded = await messagesService.uploadAttachment(file);
      result.screenshotIds.push(uploaded.artifactId);
      onProgress?.('Uploading screenshots...', 10 + ((i + 1) / session.screenshots.length) * 30);
    } catch (err) {
      console.error('Failed to upload screenshot:', err);
      failedAssets.push(`screenshot-${i + 1}`);
    }
  }

  if (session.videoBlob) {
    onProgress?.('Uploading video...', 45);
    try {
      const videoFile = await blobToFile(session.videoBlob, `bug-${session.id}-video.webm`);
      const uploaded = await messagesService.uploadAttachment(videoFile);
      result.videoId = uploaded.artifactId;
    } catch (err) {
      console.error('Failed to upload video:', err);
      failedAssets.push('video');
    }
  }

  onProgress?.('Uploading session data...', 70);
  try {
    const uploaded = await uploadSessionJsonFile(session);
    result.sessionJsonId = uploaded.artifactId;
  } catch (err) {
    console.error('Failed to upload session JSON:', err);
    failedAssets.push('session-json');
  }

  onProgress?.('Upload complete', 100);

  if (failedAssets.length > 0) {
    throw new BugReportUploadError(
      `Failed to upload: ${failedAssets.join(', ')}`,
      failedAssets
    );
  }

  return result;
}

export function buildBugReportHtml(
  session: BugReportSession,
  description: string,
  severity: 'low' | 'medium' | 'high' | 'critical',
  uploadResult: BugReportUploadResult,
  t: (key: string, defaultValue?: string) => string
): string {
  const meta = session.metadata;
  const durationSec = session.endTime
    ? Math.round((session.endTime - session.startTime) / 1000)
    : 0;

  const errorCount =
    session.errorLog?.length || session.consoleLog.filter((l) => l.level === 'error').length;
  const networkCount = session.networkLog.length;
  const navCount = session.navigationLog?.length ?? 0;

  return `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 800px; margin: 0; padding: 0;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 24px; border-radius: 12px 12px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 600;">
      ${t('messages.bugReport.reportTitle', 'Bug Report')}
    </h1>
    <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0 0; font-size: 14px;">
      ${new Date().toLocaleString()}
    </p>
  </div>
  <div style="background: white; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px; padding: 24px;">
    <div style="background: ${getSeverityColor(severity)}20; border-left: 4px solid ${getSeverityColor(severity)}; padding: 12px 16px; border-radius: 8px; margin-bottom: 20px;">
      <strong style="color: ${getSeverityColor(severity)}; font-size: 16px;">
        ${t('messages.bugReport.severity', 'Severity')}: ${severity.toUpperCase()}
      </strong>
    </div>
    <h2 style="font-size: 18px; color: #1f2937; margin: 24px 0 12px 0;">${t('messages.bugReport.description', 'Description')}</h2>
    <p style="background: #f9fafb; padding: 16px; border-radius: 8px; color: #374151; line-height: 1.6; white-space: pre-wrap;">
      ${description || t('messages.bugReport.noDescription', '(no description provided)')}
    </p>
    <h2 style="font-size: 18px; color: #1f2937; margin: 24px 0 12px 0;">${t('messages.bugReport.metadata', 'Session Info')}</h2>
    <table style="width: 100%; border-collapse: collapse;">
      <tr style="border-bottom: 1px solid #e5e7eb;"><td style="padding: 8px 0; color: #6b7280; font-size: 14px; width: 180px;">${t('messages.bugReport.url', 'URL')}</td><td style="padding: 8px 0; color: #111827; font-size: 14px; font-family: monospace; word-break: break-all;">${meta.url}</td></tr>
      <tr style="border-bottom: 1px solid #e5e7eb;"><td style="padding: 8px 0; color: #6b7280; font-size: 14px;">${t('messages.bugReport.viewport', 'Viewport')}</td><td style="padding: 8px 0; color: #111827; font-size: 14px;">${meta.viewport.width}×${meta.viewport.height}</td></tr>
      <tr style="border-bottom: 1px solid #e5e7eb;"><td style="padding: 8px 0; color: #6b7280; font-size: 14px;">${t('messages.bugReport.duration', 'Duration')}</td><td style="padding: 8px 0; color: #111827; font-size: 14px;">${durationSec}s (${session.bufferDuration}s buffer)</td></tr>
      <tr style="border-bottom: 1px solid #e5e7eb;"><td style="padding: 8px 0; color: #6b7280; font-size: 14px;">${t('messages.bugReport.actions', 'Actions')}</td><td style="padding: 8px 0; color: #111827; font-size: 14px;">${session.actions.length}</td></tr>
      <tr style="border-bottom: 1px solid #e5e7eb;"><td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Navigations</td><td style="padding: 8px 0; color: #111827; font-size: 14px;">${navCount}</td></tr>
      <tr style="border-bottom: 1px solid #e5e7eb;"><td style="padding: 8px 0; color: #6b7280; font-size: 14px;">${t('messages.bugReport.networkCalls', 'Network Calls')}</td><td style="padding: 8px 0; color: #111827; font-size: 14px;">${networkCount}</td></tr>
      <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;">${t('messages.bugReport.consoleErrors', 'Errors')}</td><td style="padding: 8px 0; color: #ef4444; font-size: 14px; font-weight: 600;">${errorCount}</td></tr>
    </table>
    <h2 style="font-size: 18px; color: #1f2937; margin: 24px 0 12px 0;">${t('messages.bugReport.attachments', 'Attachments')}</h2>
    <ul style="list-style: none; padding: 0; margin: 0;">
      ${uploadResult.screenshotIds.length > 0 ? `<li style="padding: 8px 0; color: #374151; font-size: 14px;">📸 ${uploadResult.screenshotIds.length} screenshot(s)</li>` : ''}
      ${uploadResult.videoId ? `<li style="padding: 8px 0; color: #374151; font-size: 14px;">🎥 Video recording</li>` : ''}
      ${uploadResult.sessionJsonId ? `<li style="padding: 8px 0; color: #374151; font-size: 14px;">📄 Session replay data</li>` : ''}
    </ul>
    <div style="margin-top: 24px; padding: 16px; background: #f0fdf4; border-radius: 8px; border-left: 4px solid #10b981;">
      <p style="margin: 0; color: #065f46; font-size: 14px;">✓ Session ID: <code style="background: white; padding: 2px 6px; border-radius: 4px;">${session.id}</code></p>
    </div>
  </div>
</div>`.trim();
}

export function buildBugReportChatBody(
  session: BugReportSession,
  description: string,
  severity: 'low' | 'medium' | 'high' | 'critical',
  uploadResult: BugReportUploadResult
): string {
  const lines = [
    `[BUG ${severity.toUpperCase()}] ${session.metadata.pathname}`,
    '',
    description,
    '',
    '--- Session Info ---',
    `URL: ${session.metadata.url}`,
    `Viewport: ${session.metadata.viewport.width}x${session.metadata.viewport.height}`,
    `Actions: ${session.actions.length}`,
    `Navigations: ${session.navigationLog?.length ?? 0}`,
    `Network calls: ${session.networkLog.length}`,
    `Errors: ${session.errorLog.length}`,
    `Session ID: ${session.id}`,
    '',
    '--- Attachments ---',
    uploadResult.screenshotIds.length > 0 ? `Screenshots: ${uploadResult.screenshotIds.length}` : null,
    uploadResult.videoId ? 'Video: attached' : null,
    uploadResult.sessionJsonId ? 'Session JSON: attached' : null,
  ].filter(Boolean);

  return lines.join('\n');
}

function getSeverityColor(severity: string): string {
  switch (severity) {
    case 'critical':
      return '#dc2626';
    case 'high':
      return '#ea580c';
    case 'medium':
      return '#eab308';
    case 'low':
      return '#10b981';
    default:
      return '#6b7280';
  }
}
