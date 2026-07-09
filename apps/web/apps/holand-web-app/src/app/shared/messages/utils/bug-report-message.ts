import { BugReportPayload, BugReportSession, BUG_REPORT_KIND } from '@/app/shared/bug-reporter/types';
import { AttachmentInfo, MessageDetail, MessageItem } from '@/types/messages.types';


const BUG_SUBJECT_RE = /^\[BUG\s+(LOW|MEDIUM|HIGH|CRITICAL)\]/i;
const SESSION_ID_RE = /bug-\d+-[a-z0-9]+/i;
const EMBED_RE =
  /<script[^>]*type=["']application\/json["'][^>]*data-bug-report[^>]*>([\s\S]*?)<\/script>/i;

export type BugReportSeverity = 'low' | 'medium' | 'high' | 'critical';

export function parseSeverityFromSubject(subject?: string): BugReportSeverity | null {
  if (!subject) return null;
  const match = subject.match(/^\[BUG\s+(LOW|MEDIUM|HIGH|CRITICAL)\]/i);
  if (!match) return null;
  return match[1].toLowerCase() as BugReportSeverity;
}

export function parseBugReportPayloadFromBody(body: string): BugReportPayload | null {
  const match = body.match(EMBED_RE);
  if (!match?.[1]) return null;
  try {
    const parsed = JSON.parse(match[1]) as BugReportPayload;
    if (parsed?.kind === BUG_REPORT_KIND) return parsed;
  } catch {
    /* ignore malformed embed */
  }
  return null;
}

export function findSessionJsonAttachment(
  attachments?: AttachmentInfo[]
): AttachmentInfo | undefined {
  return attachments?.find(
    (a) =>
      a.name.includes('-session.json') ||
      a.mime_type === 'application/json' ||
      a.name.endsWith('.json')
  );
}

export function findVideoAttachment(
  attachments?: AttachmentInfo[]
): AttachmentInfo | undefined {
  return attachments?.find(
    (a) =>
      a.mime_type.startsWith('video/') ||
      a.name.endsWith('.webm') ||
      a.name.endsWith('.mp4')
  );
}

export function findScreenshotAttachments(
  attachments?: AttachmentInfo[]
): AttachmentInfo[] {
  return (
    attachments?.filter(
      (a) =>
        a.mime_type.startsWith('image/') ||
        a.name.includes('-screenshot-') ||
        a.name.endsWith('.png')
    ) ?? []
  );
}

export function isBugReportMessage(message: MessageItem | MessageDetail): boolean {
  if (message.content_type === 'bug_report') return true;
  if (message.subject && BUG_SUBJECT_RE.test(message.subject)) return true;
  const body = ('body' in message && message.body) || message.preview || '';
  if (EMBED_RE.test(body)) return true;
  if (SESSION_ID_RE.test(body) && body.includes('Session ID')) return true;
  if (findSessionJsonAttachment(message.attachments)) return true;
  return false;
}

export function extractDescriptionFromBody(body: string): string {
  const payload = parseBugReportPayloadFromBody(body);
  if (payload?.description) return payload.description;

  const div = typeof document !== 'undefined' ? document.createElement('div') : null;
  if (div) {
    div.innerHTML = body;
    const descHeading = Array.from(div.querySelectorAll('h2')).find((h) =>
      /description|what happened/i.test(h.textContent ?? '')
    );
    const descBlock = descHeading?.nextElementSibling;
    if (descBlock?.textContent?.trim()) return descBlock.textContent.trim();
  }

  const plain = body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const bugLine = plain.match(/\[BUG\s+\w+\]\s+\S+/);
  if (bugLine) {
    const after = plain.slice(plain.indexOf(bugLine[0]) + bugLine[0].length).trim();
    const section = after.split('---')[0]?.trim();
    if (section) return section;
  }
  return '';
}

export function parseSessionJsonData(raw: unknown): Partial<BugReportSession> | null {
  if (!raw || typeof raw !== 'object') return null;
  const data = raw as Record<string, unknown>;
  if (typeof data.id !== 'string') return null;
  return data as Partial<BugReportSession>;
}

export function embedBugReportPayload(body: string, payload: BugReportPayload): string {
  const json = JSON.stringify(payload).replace(/</g, '\\u003c');
  return `${body}\n<script type="application/json" data-bug-report>${json}</script>`;
}

export function buildCompactBugReportPayload(
  session: BugReportSession,
  description: string,
  severity: BugReportSeverity,
  channel: BugReportPayload['delivery']['channel'],
  recipientId: string,
  _uploadResult: { screenshotIds: string[]; videoId?: string; sessionJsonId?: string }
): BugReportPayload {
  return {
    kind: BUG_REPORT_KIND,
    schemaVersion: 2,
    session: {
      id: session.id,
      startTime: session.startTime,
      endTime: session.endTime,
      actions: session.actions,
      rrwebEvents: [],
      screenshots: [],
      consoleLog: session.consoleLog.slice(-50),
      networkLog: session.networkLog.slice(-50),
      errorLog: session.errorLog.slice(-20),
      clickLog: session.clickLog.slice(-50),
      navigationLog: session.navigationLog?.slice(-20),
      captureMode: session.captureMode,
      bufferDuration: session.bufferDuration,
      metadata: session.metadata,
    },
    description,
    severity,
    delivery: {
      channel,
      recipientId,
      sentAt: Date.now(),
    },
  };
}
