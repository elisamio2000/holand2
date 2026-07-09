'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { Button, Modal, Text, Textarea, Title } from 'rizzui';
import toast from 'react-hot-toast';
import {
  PiPaperPlaneTiltBold,
  PiXBold,
  PiVideoCameraBold,
  PiStopCircleBold,
  PiRecordBold,
} from 'react-icons/pi';
import { routes } from '@/config/routes';
import type { BugReportConfig, BugReportDeliveryChannel } from '../config/bug-report-config';
import { deliverBugReport } from '../services/bug-report-delivery.service';
import { BugReportUploadError } from '../services/bug-report-upload.service';
import type { BugReportPayload, BugReportSession } from '../types';
import SessionReplayViewer from './session-replay-viewer';
import ActionTimeline from './action-timeline';
import ScreenshotAnnotatorV2 from './screenshot-annotator-v2';
import VideoPreview from './video-preview';
import DeliveryChannelSelector from './delivery-channel-selector';
import BugReportRecipientSelector from './bug-report-recipient-selector';
import type { useVideoRecorder } from '../capture/use-video-recorder';

type BugReportComposerProps = {
  session: BugReportSession;
  config: BugReportConfig;
  onClose: () => void;
  onUpdateSession: (updater: (s: BugReportSession) => BugReportSession) => void;
  video: ReturnType<typeof useVideoRecorder>;
  setVideoBlob: (blob: Blob | null) => void;
};

export default function BugReportComposer({
  session,
  config,
  onClose,
  onUpdateSession,
  video,
  setVideoBlob,
}: BugReportComposerProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState<BugReportPayload['severity']>('medium');
  const [channel, setChannel] = useState<BugReportDeliveryChannel>(config.defaultChannel);
  const [recipientId, setRecipientId] = useState(config.recipientId);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (config.recipientId && config.recipientId !== recipientId) {
      setRecipientId(config.recipientId);
    }
  }, [config.recipientId, recipientId]);
  const [uploadProgress, setUploadProgress] = useState('');
  const [annotatedShot, setAnnotatedShot] = useState<string | null>(null);
  const [retryPending, setRetryPending] = useState(false);
  const [localVideoBlob, setLocalVideoBlob] = useState<Blob | null>(session.videoBlob ?? null);

  const latestScreenshot = session.screenshots.at(-1)?.dataUrl;
  const displayShot = annotatedShot ?? latestScreenshot;

  const handleUpdateActions = useCallback(
    (updated: BugReportSession['actions']) => {
      onUpdateSession((s) => ({ ...s, actions: updated }));
    },
    [onUpdateSession]
  );

  const handleStartVideo = async () => {
    await video.startRecording('screen');
  };

  const handleStopVideo = async () => {
    const blob = await video.stopRecording();
    if (blob) {
      setLocalVideoBlob(blob);
      setVideoBlob(blob);
      onUpdateSession((s) => ({ ...s, videoBlob: blob }));
    }
  };

  const handleSend = async (forceRetry = false) => {
    if (!description.trim()) {
      toast.error(t('messages.bugReport.errorNoDescription'));
      return;
    }

    if (!recipientId.trim()) {
      toast.error(
        t(
          'messages.bugReport.errorNoRecipientConfigured',
          'Bug report recipient is not configured. Ask an admin to set it in Settings.'
        )
      );
      return;
    }

    if (retryPending && !forceRetry) return;

    setSending(true);
    setUploadProgress('');
    setRetryPending(false);

    try {
      const sessionToUpload: BugReportSession = {
        ...session,
        videoBlob: localVideoBlob ?? undefined,
        screenshots:
          annotatedShot && latestScreenshot
            ? session.screenshots.map((s, i) =>
                i === session.screenshots.length - 1 ? { ...s, dataUrl: annotatedShot } : s
              )
            : session.screenshots,
      };

      const result = await deliverBugReport(
        {
          channel,
          recipientId,
          session: sessionToUpload,
          description,
          severity,
        },
        (step, progress) => setUploadProgress(`${step} ${Math.round(progress)}%`),
        (key, defaultValue) => t(key, defaultValue ?? '')
      );

      if (!result.success) {
        throw new Error(result.error || t('messages.bugReport.sendFailed'));
      }

      toast.success(t('messages.bugReport.sent'));
      onClose();
      router.push(routes.messages);
    } catch (err) {
      console.error('Bug report send failed:', err);
      if (err instanceof BugReportUploadError) {
        setRetryPending(true);
        toast.error(t('messages.bugReport.uploadRetry', 'Upload failed. Retry?'));
      } else {
        toast.error(err instanceof Error ? err.message : t('messages.bugReport.sendFailed'));
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} size="xl">
      <div className="flex max-h-[90vh] flex-col gap-4 overflow-y-auto p-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <Title as="h4" className="text-lg font-semibold">
              {t('messages.bugReport.composerTitle')}
            </Title>
            <Text className="text-sm text-gray-500">{t('messages.bugReport.composerHint')}</Text>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <PiXBold className="h-5 w-5" />
          </button>
        </div>

        {/* Delivery */}
        <DeliveryChannelSelector value={channel} onChange={setChannel} />

        <BugReportRecipientSelector
          config={config}
          value={recipientId}
          onChange={setRecipientId}
        />

        {/* Severity */}
        <div className="flex flex-wrap gap-2">
          {(['low', 'medium', 'high', 'critical'] as const).map((s) => (
            <Button
              key={s}
              size="sm"
              variant={severity === s ? 'solid' : 'outline'}
              onClick={() => setSeverity(s)}
            >
              {t(`messages.bugReport.severities.${s}`)}
            </Button>
          ))}
        </div>

        {/* Description */}
        <Textarea
          label={t('messages.bugReport.description')}
          placeholder={t('messages.bugReport.descriptionPlaceholder')}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
        />

        {/* Screenshot annotation */}
        {displayShot && (
          <div>
            <Text className="mb-2 text-xs font-semibold text-gray-500">
              {t('messages.bugReport.screenshot')}
            </Text>
            <ScreenshotAnnotatorV2 dataUrl={displayShot} onAnnotated={setAnnotatedShot} />
          </div>
        )}

        {/* Video */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <Text className="text-xs font-semibold text-gray-500">
              {t('messages.bugReport.video.preview', 'Screen Recording')}
              {video.isRecording && (
                <span className="ml-2 font-mono text-red-600">
                  {Math.floor(video.duration / 60)}:{(video.duration % 60).toString().padStart(2, '0')}
                </span>
              )}
            </Text>
            {video.isSupported && (
              video.isRecording ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void handleStopVideo()}
                  className="gap-1.5 border-red-300 text-red-600 hover:bg-red-50"
                >
                  <PiStopCircleBold className="h-4 w-4" />
                  {t('messages.bugReport.video.stopRecording', 'Stop video')}
                </Button>
              ) : localVideoBlob ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void handleStartVideo()}
                  className="gap-1.5"
                >
                  <PiRecordBold className="h-4 w-4" />
                  {t('messages.bugReport.video.retake', 'Re-record')}
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void handleStartVideo()}
                  className="gap-1.5"
                >
                  <PiVideoCameraBold className="h-4 w-4" />
                  {t('messages.bugReport.video.startRecording', 'Record video')}
                </Button>
              )
            )}
          </div>

          {video.error && (
            <Text className="text-xs text-red-500">{video.error}</Text>
          )}

          {localVideoBlob && !video.isRecording && (
            <VideoPreview blob={localVideoBlob} />
          )}

          {video.isRecording && (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 dark:border-red-900/40 dark:bg-red-950/20">
              <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
              <Text className="text-xs text-red-700 dark:text-red-400">
                {t('messages.bugReport.video.recording', 'Recording in progress…')}
              </Text>
            </div>
          )}
        </div>

        {/* Action Timeline (editable) */}
        <div>
          <Text className="mb-2 text-xs font-semibold text-gray-500">
            {t('messages.bugReport.actionTimeline')} ({session.actions.length})
          </Text>
          <ActionTimeline
            actions={session.actions}
            startTime={session.startTime}
            editable
            onUpdate={handleUpdateActions}
          />
        </div>

        {/* Session Replay */}
        <div>
          <Text className="mb-2 text-xs font-semibold text-gray-500">
            {t('messages.bugReport.sessionReplay')} ({session.rrwebEvents.length}{' '}
            {t('messages.bugReport.events')})
          </Text>
          <SessionReplayViewer events={session.rrwebEvents} viewport={session.metadata.viewport} />
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 border-t border-muted pt-4">
          {uploadProgress && (
            <Text className="mr-auto text-sm text-gray-500">{uploadProgress}</Text>
          )}
          {retryPending && (
            <Button variant="outline" onClick={() => void handleSend(true)} disabled={sending}>
              {t('messages.bugReport.uploadRetry', 'Retry upload')}
            </Button>
          )}
          <Button variant="outline" onClick={onClose} disabled={sending}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button
            variant="solid"
            onClick={() => void handleSend()}
            disabled={sending || video.isRecording || !recipientId.trim()}
            className="gap-1.5"
          >
            <PiPaperPlaneTiltBold className="h-4 w-4" />
            {sending
              ? t('messages.bugReport.upload.sending', 'Sending...')
              : t('messages.bugReport.sendToTeam')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
