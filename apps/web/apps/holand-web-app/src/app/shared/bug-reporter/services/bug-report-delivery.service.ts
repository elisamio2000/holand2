import { messagesService } from '@/services/messages.service';
import type { BugReportDeliveryChannel } from '../config/bug-report-config';
import type { BugReportSession } from '../types';
import {
  buildCompactBugReportPayload,
  embedBugReportPayload,
} from '@/app/shared/messages/utils/bug-report-message';
import {
  buildBugReportHtml,
  uploadBugReportAssets,
  type BugReportUploadResult,
} from './bug-report-upload.service';
export interface DeliveryOptions {
  channel: BugReportDeliveryChannel;
  recipientId: string;
  session: BugReportSession;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface DeliveryResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

function isStorageRelatedMessengerError(err: unknown): boolean {
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  return msg.includes('storage');
}

export async function deliverBugReport(
  options: DeliveryOptions,
  onProgress: (step: string, percent: number) => void,
  t: (key: string, defaultValue?: string) => string
): Promise<DeliveryResult> {
  const { channel, recipientId, session, description, severity } = options;

  try {
    onProgress(t('messages.bugReport.upload.uploading', 'Uploading assets...'), 10);
    const uploadResult: BugReportUploadResult = await uploadBugReportAssets(session, (step, progress) => {
      onProgress(step, progress);
    });

    const attachmentIds = [
      ...uploadResult.screenshotIds,
      ...(uploadResult.videoId ? [uploadResult.videoId] : []),
      ...(uploadResult.sessionJsonId ? [uploadResult.sessionJsonId] : []),
    ];

    const subject = `[BUG ${severity.toUpperCase()}] ${session.metadata.pathname} — ${new Date().toLocaleString()}`;

    const baseBody =
      channel === 'email'
        ? buildBugReportHtml(session, description, severity, uploadResult, t)
        : buildBugReportHtml(session, description, severity, uploadResult, t);

    const payload = buildCompactBugReportPayload(
      session,
      description,
      severity,
      channel,
      recipientId,
      uploadResult
    );
    const body = embedBugReportPayload(baseBody, payload);

    onProgress(t('messages.bugReport.upload.sending', 'Sending report...'), 95);

    const sendPayload = {
      to: recipientId,
      subject,
      body,
      content_type: 'bug_report' as const,
      priority: (severity === 'critical' || severity === 'high' ? 'high' : 'normal') as
        | 'high'
        | 'normal',
      attachments: attachmentIds.length ? attachmentIds : undefined,
    };

    let response;
    try {
      response = await messagesService.send(sendPayload);
    } catch (err) {
      if (attachmentIds.length > 0 && isStorageRelatedMessengerError(err)) {
        console.warn(
          '[BugReport] Send with attachments failed (storage) — retrying text-only',
          err
        );
        const attachmentNote =
          channel === 'email'
            ? `<p style="color:#b45309;font-size:13px;">Attachments uploaded but could not be linked by messenger storage. IDs: ${attachmentIds.join(', ')}</p>`
            : `\n\n[Attachments uploaded but not linked — artifact IDs: ${attachmentIds.join(', ')}]`;
        response = await messagesService.send({
          ...sendPayload,
          body: body + attachmentNote,
          attachments: undefined,
        });
      } else {
        throw err;
      }
    }

    return {
      success: response.ok !== false,
      messageId:
        typeof response.data === 'object' && response.data && 'id' in response.data
          ? String((response.data as { id: string }).id)
          : undefined,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
