/**
 * MessageComposeView — Full-page compose screen
 *
 * Fix log v1.1.0:
 * - Fullscreen: proper z-index (z-[9999]), ESC key exits, button always visible
 * - Attachments: image thumbnails + global file-type icons via getFileIcon
 * - Dark mode: uses Tailwind dark: classes from global theme
 *
 * @version 1.1.0
 */

'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useTranslation } from 'react-i18next';
import { Button, Input, Text } from 'rizzui';
import {
  PiPaperPlaneTiltBold,
  PiPaperclipBold,
  PiTrashBold,
  PiFloppyDiskBold,
  PiWarningBold,
  PiXBold,
  PiArrowLeftBold,
  PiDotsThreeVerticalBold,
  PiTextAaBold,
  PiArrowsOutBold,
  PiArrowsInBold,
  PiUserBold,
  PiLinkBold,
  PiSmileyBold,
  PiCaretDownBold,
} from 'react-icons/pi';
import toast from 'react-hot-toast';
import cn from '@core/utils/class-names';
import RichTextEditor, { type EditorOutput } from '@/app/shared/rich-text-editor';
import { routes } from '@/config/routes';
import { messagesService } from '@/services/messages.service';
import type { PendingAttachment, UserSummary } from '@/types/messages.types';
import AttachmentCard from './attachment-card';
import AttachmentPicker from './attachment-picker';
import RecipientSearchInput from './components/recipient-search-input';
import MessagesMockBanner from './messages-mock-banner';
import { getMessagesMockMode } from './mock/config';

// ─── Types ────────────────────────────────────────────────────────────────────

type Priority = 'normal' | 'high' | 'low';

function isImageMime(type: string) {
  return type.startsWith('image/');
}

/** Focus: label grows + uses theme primary; input gets themed caret + placeholder tint. */
const composeFieldLabelClass =
  'w-16 shrink-0 text-xs font-semibold text-gray-500 transition-all duration-200 group-focus-within:text-sm group-focus-within:text-primary group-focus-within:font-bold dark:text-gray-400';

const composeFieldInputClass =
  'border-0 bg-transparent outline-none ring-0 caret-primary transition-colors duration-200 focus:outline-none focus:ring-0 focus-visible:outline-none focus:placeholder:text-primary/50 dark:focus:placeholder:text-primary/40';

async function resolveRecipientToken(token: string): Promise<UserSummary | null> {
  const trimmed = token.trim();
  if (!trimmed) return null;
  const resolved = await messagesService.resolveDirectoryUser(trimmed);
  return resolved;
}

function formatRecipientsSummary(recipients: UserSummary[]) {
  return recipients.map((r) => r.name || r.email || r.id).join(', ');
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function MessageComposeView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useTranslation();
  const { data: session } = useSession();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const usingMock = getMessagesMockMode() !== 'off';

  const [to, setTo] = useState<UserSummary[]>([]);
  const [cc, setCc] = useState<UserSummary[]>([]);
  const [bcc, setBcc] = useState<UserSummary[]>([]);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState<EditorOutput | null>(null);
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const [priority, setPriority] = useState<Priority>('normal');

  const [showRecipients, setShowRecipients] = useState(true);
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);
  const [showPriorityMenu, setShowPriorityMenu] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [scheduledAt, setScheduledAt] = useState('');
  const [replyToId, setReplyToId] = useState<string | null>(null);
  const [replyAll, setReplyAll] = useState(false);

  const fromLabel = session?.user?.name ?? session?.user?.email ?? 'User';
  const fromEmail = session?.user?.email ?? '';
  const currentUserId = session?.user?.id;

  // Pre-fill from URL params: ?to= & ?from= & ?cc= & ?bcc= & ?subject= & ?body=
  useEffect(() => {
    let cancelled = false;

    const loadRecipients = async () => {
      const toParam = searchParams.get('to')?.trim();
      const ccParam = searchParams.get('cc')?.trim();
      const bccParam = searchParams.get('bcc')?.trim();
      const replyToParam = searchParams.get('reply_to')?.trim();
      const replyAllParam = searchParams.get('reply_all');
      const subjectParam = searchParams.get('subject')?.trim();
      const bodyParam = searchParams.get('body');

      if (!cancelled && replyToParam) setReplyToId(replyToParam);
      if (!cancelled && replyAllParam === '1') setReplyAll(true);

      if (toParam) {
        const resolved = (
          await Promise.all(toParam.split(',').map((e) => resolveRecipientToken(e)))
        ).filter(Boolean) as UserSummary[];
        if (!cancelled) setTo(resolved);
      }
      if (ccParam) {
        const resolved = (
          await Promise.all(ccParam.split(',').map((e) => resolveRecipientToken(e)))
        ).filter(Boolean) as UserSummary[];
        if (!cancelled) {
          setCc(resolved);
          setShowCc(true);
        }
      }
      if (bccParam) {
        const resolved = (
          await Promise.all(bccParam.split(',').map((e) => resolveRecipientToken(e)))
        ).filter(Boolean) as UserSummary[];
        if (!cancelled) {
          setBcc(resolved);
          setShowBcc(true);
        }
      }
      if (!cancelled && subjectParam) setSubject(subjectParam);
      if (!cancelled && bodyParam) {
        const html = bodyParam.startsWith('%') ? decodeURIComponent(bodyParam) : bodyParam;
        setBody({ html, text: '', json: {} });
      }
    };

    void loadRecipients();
    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  // ESC key exits fullscreen
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) setIsFullscreen(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isFullscreen]);

  const submitMessage = useCallback(
    async (draft: boolean) => {
      if (!draft && to.length === 0 && !replyToId) {
        toast.error(t('messages.compose.errorNoRecipient'));
        return;
      }
      if (!draft && !subject.trim()) {
        const ok = window.confirm(t('messages.compose.confirmNoSubject'));
        if (!ok) return;
      }
      const pending = attachments.some((a) => a.uploading || !a.artifactId);
      if (pending) {
        toast.error(t('messages.thread.waitUpload'));
        return;
      }
      const artifactIds = attachments.map((a) => a.artifactId).filter(Boolean) as string[];
      const payload = {
        to: to[0]?.id ?? replyToId ?? '',
        cc: cc.length ? cc.map((r) => r.id) : undefined,
        bcc: bcc.length ? bcc.map((r) => r.id) : undefined,
        subject: subject.trim() || undefined,
        body: body?.html ?? '',
        attachments: artifactIds.length ? artifactIds : undefined,
        priority,
        draft,
        client_message_id: crypto.randomUUID(),
        reply_to_id: replyToId ?? undefined,
        reply_all: replyAll || undefined,
        scheduled_at: !draft && scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
      };
      if (draft) setSaving(true);
      else setSending(true);
      try {
        await messagesService.send(payload);
        toast.success(draft ? t('messages.compose.drafted') : t('messages.compose.sent'));
        router.push(routes.messages);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t('messages.compose.sendFailed'));
      } finally {
        setSaving(false);
        setSending(false);
      }
    },
    [to, subject, attachments, cc, bcc, body?.html, priority, t, router, replyToId, replyAll, scheduledAt]
  );

  const handleSend = useCallback(() => submitMessage(false), [submitMessage]);
  const handleSaveDraft = useCallback(() => submitMessage(true), [submitMessage]);

  const handleAttach = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    for (const file of files) {
      const localId = `${Date.now()}-${file.name}`;
      let dataUrl: string | undefined;
      if (isImageMime(file.type)) {
        dataUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
      }
      setAttachments((prev) => [
        ...prev,
        {
          id: localId,
          name: file.name,
          size: file.size,
          type: file.type,
          dataUrl,
          uploading: true,
          progress: 0,
        },
      ]);
      try {
        const uploaded = await messagesService.uploadAttachment(file, (pct) => {
          setAttachments((prev) =>
            prev.map((a) => (a.id === localId ? { ...a, progress: pct } : a))
          );
        });
        setAttachments((prev) =>
          prev.map((a) =>
            a.id === localId
              ? { ...a, artifactId: uploaded.artifactId, uploading: false, progress: 100 }
              : a
          )
        );
      } catch {
        setAttachments((prev) => prev.filter((a) => a.id !== localId));
        toast.error(t('messages.attachments.uploadFailed'));
      }
    }
    e.target.value = '';
  };

  const removeAttachment = (id: string) => setAttachments((prev) => prev.filter((a) => a.id !== id));

  const confirmDiscard = () => {
    if (window.confirm(t('messages.compose.confirmDiscard'))) router.push(routes.messages);
  };

  const priorityConfig: Record<Priority, { label: string; badgeCn: string; dot: string }> = {
    normal: { label: t('messages.priority.normal'), badgeCn: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300', dot: 'bg-gray-400' },
    high: { label: t('messages.priority.high'), badgeCn: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400', dot: 'bg-red-500' },
    low: { label: t('messages.priority.low'), badgeCn: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400', dot: 'bg-blue-400' },
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
      {usingMock && <MessagesMockBanner />}
      <p className="shrink-0 text-xs text-gray-500 dark:text-gray-400">{t('messages.compose.purposeHint')}</p>
    <div className={cn(
      'flex min-h-0 flex-1 flex-col',
      'bg-gray-0 dark:bg-gray-50',
      isFullscreen
        ? 'fixed inset-0 z-[9999]'
        : 'rounded-xl border border-muted',
    )}>

      {/* ── Header ── */}
      <div className="flex shrink-0 items-center justify-between border-b border-muted px-4 py-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push(routes.messages)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            title="Back"
          >
            <PiArrowLeftBold className="h-4 w-4" />
          </button>
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              {t('messages.compose.title')}
            </h2>
            {priority !== 'normal' && (
              <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium', priorityConfig[priority].badgeCn)}>
                <span className={cn('h-1.5 w-1.5 rounded-full', priorityConfig[priority].dot)} />
                {priorityConfig[priority].label}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1">
          {/* Fullscreen toggle — always visible, with clear label */}
          <button
            type="button"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            title={isFullscreen ? 'Exit fullscreen (Esc)' : 'Fullscreen'}
          >
            {isFullscreen ? <PiArrowsInBold className="h-4 w-4" /> : <PiArrowsOutBold className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={confirmDiscard}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 dark:text-gray-500 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/30 dark:hover:text-red-400 transition-colors"
            title="Discard"
          >
            <PiTrashBold className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* ── Collapsible recipients panel ── */}
      <button
        type="button"
        onClick={() => setShowRecipients(!showRecipients)}
        className="flex w-full shrink-0 items-center justify-between border-b border-muted px-4 py-2.5 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-100"
      >
        <div className="min-w-0 flex-1">
          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
            {t('messages.compose.to')}:{' '}
          </span>
          <span className="text-sm text-gray-700 dark:text-gray-300">
            {to.length > 0
              ? formatRecipientsSummary(to)
              : t('messages.compose.searchUsersPlaceholder')}
            {subject && (
              <span className="ms-2 text-gray-400">— {subject}</span>
            )}
          </span>
        </div>
        <PiCaretDownBold
          className={cn(
            'h-4 w-4 shrink-0 text-gray-400 transition-transform',
            showRecipients && 'rotate-180'
          )}
        />
      </button>

      {showRecipients && (
        <div className="shrink-0 divide-y divide-muted border-b border-muted">
          {/* From — flat row, no per-field stroke */}
          <div className="flex h-10 items-center gap-3 bg-gray-50/60 px-4 dark:bg-gray-100/20">
            <span className="w-16 shrink-0 text-xs font-semibold text-gray-500 dark:text-gray-400">
              {t('messages.compose.from')}:
            </span>
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 dark:bg-primary/20">
                <PiUserBold className="h-3 w-3 text-primary" />
              </div>
              <span className="truncate text-sm text-gray-700 dark:text-gray-300">
                {fromLabel}{fromEmail && <span className="text-gray-400 dark:text-gray-500"> &lt;{fromEmail}&gt;</span>}
              </span>
            </div>
          </div>

          {/* To — user search */}
          <div className="flex items-center gap-2 px-4 py-1">
            <div className="min-w-0 flex-1">
              <RecipientSearchInput
                id="compose-to"
                label={t('messages.compose.to')}
                value={to}
                onChange={setTo}
                currentUserId={currentUserId}
                excludeIds={[...cc, ...bcc].map((r) => r.id)}
              />
            </div>
            <div className="flex shrink-0 items-center gap-0.5 self-start pt-2">
              <button type="button" onClick={() => setShowCc(!showCc)}
                className={cn('rounded px-1.5 py-0.5 text-xs font-medium transition-colors',
                  showCc ? 'bg-primary/10 text-primary dark:bg-primary/20' : 'text-gray-400 hover:text-gray-600 dark:text-gray-500')}>
                Cc
              </button>
              <button type="button" onClick={() => setShowBcc(!showBcc)}
                className={cn('rounded px-1.5 py-0.5 text-xs font-medium transition-colors',
                  showBcc ? 'bg-primary/10 text-primary dark:bg-primary/20' : 'text-gray-400 hover:text-gray-600 dark:text-gray-500')}>
                Bcc
              </button>
            </div>
          </div>

          {showCc && (
            <div className="px-4 py-1">
              <RecipientSearchInput
                id="compose-cc"
                label="Cc"
                value={cc}
                onChange={setCc}
                currentUserId={currentUserId}
                excludeIds={[...to, ...bcc].map((r) => r.id)}
                placeholder={t('messages.compose.ccPlaceholder')}
              />
            </div>
          )}

          {showBcc && (
            <div className="px-4 py-1">
              <RecipientSearchInput
                id="compose-bcc"
                label="Bcc"
                value={bcc}
                onChange={setBcc}
                currentUserId={currentUserId}
                excludeIds={[...to, ...cc].map((r) => r.id)}
                placeholder={t('messages.compose.bccPlaceholder')}
              />
            </div>
          )}

          {/* Subject — flat row */}
          <div className="group flex h-10 items-center gap-3 px-4">
            <label htmlFor="compose-subject" className={composeFieldLabelClass}>
              {t('messages.compose.subject')}:
            </label>
            <input
              id="compose-subject"
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder={t('messages.compose.subjectPlaceholder')}
              className={cn(
                composeFieldInputClass,
                'min-w-0 flex-1 text-sm font-medium text-gray-900 placeholder:text-gray-400 placeholder:opacity-60 dark:text-gray-100 dark:placeholder:text-gray-500'
              )}
            />
          </div>
        </div>
      )}

      {/* ── Main editor body ── */}
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <div className="flex-1 px-4 py-3">
          <RichTextEditor
            placeholder={t('messages.compose.bodyPlaceholder')}
            onChange={setBody}
            minHeight={isFullscreen ? 'calc(100vh - 280px)' : '420px'}
            stickyToolbar={false}
            showCharacterCount={false}
            className="h-full rounded-lg border-gray-100 dark:border-gray-800"
          />
        </div>

        {attachments.length > 0 && (
          <div className="shrink-0 border-t border-muted px-4 py-3">
            <p className="mb-2 text-xs font-semibold text-gray-500 dark:text-gray-400">
              {t('messages.compose.attachments')} ({attachments.length})
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {attachments.map((att) => (
                <AttachmentCard key={att.id} att={att} onRemove={removeAttachment} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Action Bar ── */}
      <div className="flex shrink-0 items-center justify-between border-t border-muted bg-gray-50 dark:bg-gray-100 px-4 py-3">
        <div className="flex items-center gap-2">
          <Button variant="solid" onClick={handleSend} isLoading={sending} className="gap-2">
            <PiPaperPlaneTiltBold className="h-4 w-4" />
            {scheduledAt ? t('messages.compose.scheduleSend') : t('messages.compose.send')}
          </Button>
          <div className="hidden items-center gap-2 sm:flex">
            <label htmlFor="compose-schedule" className="text-xs text-gray-500">
              {t('messages.compose.scheduleAt')}
            </label>
            <input
              id="compose-schedule"
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              className="rounded border border-muted px-2 py-1 text-xs"
            />
          </div>
          <Button variant="outline" onClick={handleSaveDraft} isLoading={saving} className="gap-2">
            <PiFloppyDiskBold className="h-4 w-4" />
            <span className="hidden sm:inline">{t('messages.compose.saveDraft')}</span>
          </Button>
        </div>

        <div className="flex items-center gap-1">
          {/* Attach */}
          <button type="button" onClick={() => fileInputRef.current?.click()} title="Attach file"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
            <PiPaperclipBold className="h-4 w-4" />
          </button>
          <input ref={fileInputRef} type="file" multiple onChange={handleAttach} className="hidden" />

          <button
            type="button"
            title={t('messages.attachments.fromLibrary')}
            onClick={() => setPickerOpen(true)}
            className="hidden h-8 items-center justify-center rounded-lg px-2 text-xs font-medium text-primary hover:bg-primary/10 sm:flex"
          >
            {t('messages.attachments.library')}
          </button>

          {/* Link */}
          <button type="button" title="Insert link"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
            <PiLinkBold className="h-4 w-4" />
          </button>

          {/* Emoji */}
          <button type="button" title="Emoji"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
            <PiSmileyBold className="h-4 w-4" />
          </button>

          {/* Priority */}
          <div className="relative">
            <button type="button" onClick={() => setShowPriorityMenu(!showPriorityMenu)} title="Priority"
              className={cn('flex h-8 w-8 items-center justify-center rounded-lg transition-colors',
                priority !== 'normal'
                  ? 'bg-red-50 dark:bg-red-900/30 text-red-500 dark:text-red-400'
                  : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700')}>
              <PiWarningBold className="h-4 w-4" />
            </button>
            {showPriorityMenu && (
              <div className="absolute bottom-full right-0 mb-2 min-w-[140px] rounded-lg border border-muted bg-gray-0 py-1 shadow-lg z-50">
                {(['high', 'normal', 'low'] as Priority[]).map((p) => (
                  <button key={p} type="button"
                    onClick={() => { setPriority(p); setShowPriorityMenu(false); }}
                    className={cn('flex w-full items-center gap-2.5 px-3 py-2 text-sm transition-colors hover:bg-gray-100',
                      priority === p ? 'font-medium text-primary' : 'text-gray-700')}>
                    <span className={cn('h-2 w-2 rounded-full shrink-0', priorityConfig[p].dot)} />
                    {priorityConfig[p].label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* More */}
          <button type="button" title="More options"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
            <PiDotsThreeVerticalBold className="h-4 w-4" />
          </button>

          {/* Discard */}
          <button type="button" onClick={confirmDiscard} title="Discard"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 dark:text-gray-500 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/30 dark:hover:text-red-400 transition-colors">
            <PiTrashBold className="h-4 w-4" />
          </button>
        </div>
      </div>

      <AttachmentPicker
        isOpen={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={(artifact) => {
          setAttachments((prev) => [
            ...prev,
            {
              id: artifact.artifactId,
              name: artifact.name,
              size: artifact.size,
              type: artifact.mime_type,
              artifactId: artifact.artifactId,
            },
          ]);
          setPickerOpen(false);
        }}
      />
    </div>
    </div>
  );
}
