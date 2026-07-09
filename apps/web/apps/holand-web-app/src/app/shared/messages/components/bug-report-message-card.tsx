'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text } from 'rizzui';
import cn from '@core/utils/class-names';
import type { eventWithTime } from '@rrweb/types';
import type { BugReportAction, BugReportSession } from '@/app/shared/bug-reporter/types';
import ActionTimeline from '@/app/shared/bug-reporter/components/action-timeline';
import SessionReplayViewer from '@/app/shared/bug-reporter/components/session-replay-viewer';
import VideoPreview from '@/app/shared/bug-reporter/components/video-preview';
import AuthenticatedImage from '@/app/shared/ai-chat/authenticated-image';
import { storageService } from '@/services/storage.service';
import type { MessageDetail, MessageItem } from '@/types/messages.types';
import {
  extractDescriptionFromBody,
  findScreenshotAttachments,
  findSessionJsonAttachment,
  findVideoAttachment,
  parseBugReportPayloadFromBody,
  parseSessionJsonData,
  parseSeverityFromSubject,
} from '../utils/bug-report-message';
import { isPublicAttachmentUrl, resolveMessageAttachmentSrc } from '../resolve-message-attachment-src';

type BugReportMessageCardProps = {
  message: MessageItem | MessageDetail;
  className?: string;
};

const SEVERITY_STYLES: Record<string, string> = {
  critical: 'border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300',
  high: 'border-orange-500/40 bg-orange-500/10 text-orange-700 dark:text-orange-300',
  medium: 'border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-300',
  low: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
};

function getSeverityStyle(severity: string) {
  return SEVERITY_STYLES[severity] ?? SEVERITY_STYLES.medium;
}

export default function BugReportMessageCard({ message, className }: BugReportMessageCardProps) {
  const { t } = useTranslation();
  const body = ('body' in message && message.body) || message.preview || '';
  const embedded = parseBugReportPayloadFromBody(body);
  const severity =
    embedded?.severity ?? parseSeverityFromSubject(message.subject) ?? 'medium';
  const description = embedded?.description || extractDescriptionFromBody(body);

  const sessionAttachment = findSessionJsonAttachment(message.attachments);
  const videoAttachment = findVideoAttachment(message.attachments);
  const screenshotAttachments = findScreenshotAttachments(message.attachments);

  const [sessionData, setSessionData] = useState<Partial<BugReportSession> | null>(
    embedded?.session ?? null
  );
  const [videoBlob, setVideoBlob] = useState<Blob | null>(null);
  const [loadingSession, setLoadingSession] = useState(Boolean(sessionAttachment));
  const [sessionError, setSessionError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionAttachment) return;
    let cancelled = false;
    setLoadingSession(true);
    setSessionError(null);

    void (async () => {
      try {
        const blob = await storageService.fetchArtifactBlob(sessionAttachment.id, 'inline');
        const text = await blob.text();
        const parsed = parseSessionJsonData(JSON.parse(text));
        if (!cancelled && parsed) setSessionData((prev) => ({ ...prev, ...parsed }));
      } catch (err) {
        if (!cancelled) {
          setSessionError(err instanceof Error ? err.message : 'Failed to load session data');
        }
      } finally {
        if (!cancelled) setLoadingSession(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sessionAttachment]);

  useEffect(() => {
    if (!videoAttachment) return;
    let cancelled = false;
    void storageService.fetchArtifactBlob(videoAttachment.id, 'inline').then((blob) => {
      if (!cancelled) setVideoBlob(blob);
    });
    return () => {
      cancelled = true;
    };
  }, [videoAttachment]);

  const meta = sessionData?.metadata ?? embedded?.session?.metadata;
  const actions = (sessionData?.actions ?? embedded?.session?.actions ?? []) as BugReportAction[];
  const rrwebEvents = (sessionData?.rrwebEvents ?? []) as eventWithTime[];
  const startTime = sessionData?.startTime ?? embedded?.session?.startTime ?? Date.now();
  const sessionId = sessionData?.id ?? embedded?.session?.id;
  const rrwebOmitted =
    Boolean((sessionData as { rrwebOmitted?: boolean } | null)?.rrwebOmitted) ||
    (sessionData?.rrwebEvents?.length === 0 && Boolean(sessionAttachment));

  const durationSec = useMemo(() => {
    const end = sessionData?.endTime ?? embedded?.session?.endTime;
    if (!end || !startTime) return 0;
    return Math.round((end - startTime) / 1000);
  }, [sessionData?.endTime, embedded?.session?.endTime, startTime]);

  const nonEmbeddedAttachments =
    message.attachments?.filter(
      (a) =>
        a.id !== sessionAttachment?.id &&
        a.id !== videoAttachment?.id &&
        !screenshotAttachments.some((s) => s.id === a.id)
    ) ?? [];

  return (
    <div className={cn('flex w-full justify-center px-2 py-2', className)}>
      <div className="w-full max-w-3xl overflow-hidden rounded-xl border border-muted bg-gray-0 shadow-md dark:bg-gray-50">
        <div className="bg-gradient-to-br from-[#667eea] to-[#764ba2] px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <Text className="text-xs font-medium uppercase tracking-wide text-white/80">
                {t('messages.bugReport.systemLabel', 'System Report')}
              </Text>
              <Text className="text-lg font-semibold text-white">
                {t('messages.bugReport.reportTitle', 'Bug Report')}
              </Text>
            </div>
            <Text className="text-xs text-white/90">
              {new Date(message.created_at).toLocaleString()}
            </Text>
          </div>
        </div>

        <div className="space-y-4 p-5">
          <div
            className={cn(
              'rounded-lg border px-4 py-2 text-sm font-semibold',
              getSeverityStyle(severity)
            )}
          >
            {t('messages.bugReport.severity', 'Severity')}: {severity.toUpperCase()}
          </div>

          <div>
            <Text className="mb-2 text-sm font-semibold text-gray-800 dark:text-gray-200">
              {t('messages.bugReport.description', 'What happened?')}
            </Text>
            <div className="rounded-lg bg-gray-50 px-4 py-3 text-sm leading-relaxed text-gray-700 dark:bg-gray-100/50 dark:text-gray-300">
              {description || t('messages.bugReport.noDescription', '(no description provided)')}
            </div>
          </div>

          {meta && (
            <div className="grid gap-2 text-sm sm:grid-cols-2">
              <div className="rounded-lg border border-muted px-3 py-2">
                <Text className="text-xs text-gray-500">{t('messages.bugReport.url', 'Page URL')}</Text>
                <Text className="break-all font-mono text-xs">{meta.url}</Text>
              </div>
              <div className="rounded-lg border border-muted px-3 py-2">
                <Text className="text-xs text-gray-500">{t('messages.bugReport.viewport', 'Viewport')}</Text>
                <Text>{meta.viewport.width}×{meta.viewport.height}</Text>
              </div>
              <div className="rounded-lg border border-muted px-3 py-2">
                <Text className="text-xs text-gray-500">{t('messages.bugReport.duration', 'Recording')}</Text>
                <Text>{durationSec}s</Text>
              </div>
              <div className="rounded-lg border border-muted px-3 py-2">
                <Text className="text-xs text-gray-500">{t('messages.bugReport.actions', 'Tracked actions')}</Text>
                <Text>{actions.length}</Text>
              </div>
            </div>
          )}

          {screenshotAttachments.length > 0 && (
            <div className="grid gap-2 sm:grid-cols-2">
              {screenshotAttachments.map((att) => {
                const src = resolveMessageAttachmentSrc(att);
                return (
                  <div key={att.id} className="overflow-hidden rounded-lg border border-muted">
                    {isPublicAttachmentUrl(src) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={src} alt={att.name} className="max-h-48 w-full object-cover" />
                    ) : (
                      <AuthenticatedImage src={src} alt={att.name} className="max-h-48 w-full object-cover" />
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {videoBlob && <VideoPreview blob={videoBlob} />}

          {loadingSession && (
            <Text className="text-xs text-gray-500">
              {t('messages.bugReport.loadingSession', 'Loading session replay…')}
            </Text>
          )}

          {sessionError && (
            <Text className="text-xs text-red-600">{sessionError}</Text>
          )}

          {rrwebOmitted && !loadingSession && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300">
              {t(
                'messages.bugReport.replayTruncated',
                'Session replay data was truncated due to size limits. Action timeline and screenshots are still available.'
              )}
            </div>
          )}

          {actions.length > 0 && (
            <ActionTimeline actions={actions} startTime={startTime} editable={false} />
          )}

          {rrwebEvents.length > 0 && (
            <SessionReplayViewer
              events={rrwebEvents}
              viewport={meta?.viewport}
            />
          )}

          {sessionId && (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-800 dark:text-emerald-300">
              Session ID: <code className="font-mono">{sessionId}</code>
            </div>
          )}

          {nonEmbeddedAttachments.length > 0 && (
            <Text className="text-xs text-gray-500">
              + {nonEmbeddedAttachments.length} additional attachment(s)
            </Text>
          )}
        </div>
      </div>
    </div>
  );
}
