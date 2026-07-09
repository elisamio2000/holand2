'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useEditor, EditorContent } from '@tiptap/react';
import { useMedia } from '@core/hooks/use-media';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import { useTranslation } from 'react-i18next';
import { Button } from 'rizzui';
import {
  PiPaperPlaneTiltBold,
  PiPaperclipBold,
  PiTextB,
  PiTextItalic,
  PiLinkBold,
  PiArrowSquareOut,
  PiSmileyBold,
  PiMicrophoneBold,
  PiCaretUpBold,
  PiCaretDownBold,
} from 'react-icons/pi';
import toast from 'react-hot-toast';
import { messagesService } from '@/services/messages.service';
import { useMessageDrafts } from '@/hooks/use-message-drafts';
import { routes } from '@/config/routes';
import AttachmentCard from './attachment-card';
import AttachmentPicker from './attachment-picker';
import ComposerReplyBar from './components/composer-reply-bar';
import EmojiPicker from './components/emoji-picker';
import VoiceNoteRecorder from './voice-note-recorder';
import cn from '@core/utils/class-names';
import type { MessagesViewMode, PendingAttachment, MessageItem, EntityRef } from '@/types/messages.types';
import { useMessagesRealtimeContext } from './messages-realtime-context';
import { messagesDataStore } from '@/stores/messages-data-store';
import EntityAttachPicker from './components/entity-attach-picker';

type InlineComposerProps = {
  messageId: string;
  viewMode?: MessagesViewMode;
  replyToMessage?: MessageItem | null;
  onClearReply?: () => void;
  onSent: () => void;
  currentThreadMessage?: MessageItem;
};

export default function InlineComposer({
  messageId,
  viewMode = 'mailbox',
  replyToMessage,
  onClearReply,
  onSent,
  currentThreadMessage,
}: InlineComposerProps) {
  const isPeople = viewMode === 'people';
  const { data: session } = useSession();
  const currentUserId = session?.user?.id ?? '';
  const currentUserName = session?.user?.name ?? 'You';
  const { t } = useTranslation();
  const router = useRouter();
  const { draft, setDraft, clearDraft } = useMessageDrafts(messageId);
  const isCompact = useMedia('(max-width: 1024px)', false);
  const [composerOpen, setComposerOpen] = useState(!isCompact);

  useEffect(() => {
    setComposerOpen(!isCompact);
  }, [isCompact]);
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const [sending, setSending] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [pendingEntityRefs, setPendingEntityRefs] = useState<EntityRef[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const emojiAnchorRef = useRef<HTMLDivElement>(null);
  const handleSendRef = useRef<() => void>(() => undefined);
  const typingStopRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { sendTyping } = useMessagesRealtimeContext();

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
        blockquote: false,
        horizontalRule: false,
      }),
      Underline,
      Link.configure({ openOnClick: false }),
      Placeholder.configure({
        placeholder: t('messages.thread.replyPlaceholder'),
      }),
    ],
    content: draft || '',
    onUpdate: ({ editor }) => {
      setDraft(editor.getHTML());
      if (!isPeople) return;
      const hasText = editor.getText().trim().length > 0;
      sendTyping(hasText);
      if (typingStopRef.current) clearTimeout(typingStopRef.current);
      typingStopRef.current = setTimeout(() => sendTyping(false), 2000);
    },
    editorProps: {
      attributes: {
        class:
          'prose prose-sm max-w-none min-h-[44px] max-h-[7.5rem] overflow-y-auto overscroll-y-contain px-3 py-2 focus:outline-none text-gray-900 dark:text-gray-100',
      },
      handleKeyDown: (_view, event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
          event.preventDefault();
          handleSendRef.current();
          return true;
        }
        return false;
      },
    },
    immediatelyRender: false,
  });

  useEffect(() => {
    if (!replyToMessage) return;
    editor?.commands.focus();
  }, [replyToMessage, editor]);

  const handleSend = useCallback(async () => {
    if (!editor) return;
    const html = editor.getHTML();
    const text = editor.getText().trim();
    if (!text && attachments.length === 0) {
      toast.error(t('messages.thread.emptyReply'));
      return;
    }
    const pendingUpload = attachments.some((a) => a.uploading || !a.artifactId);
    if (pendingUpload) {
      toast.error(t('messages.thread.waitUpload'));
      return;
    }

    setSending(true);
    const clientMessageId = crypto.randomUUID();
    const artifactIds = attachments
      .map((a) => a.artifactId)
      .filter(Boolean) as string[];

    let finalBody = html;
    if (replyToMessage) {
      const preview = replyToMessage.preview || replyToMessage.subject || '';
      finalBody = `<blockquote><strong>${replyToMessage.from.name}:</strong> ${preview}</blockquote>${html}`;
    }

    const partner = currentThreadMessage?.to ?? currentThreadMessage?.from;
    const optimistic: MessageItem = {
      id: `pending:${clientMessageId}`,
      client_message_id: clientMessageId,
      from: {
        id: currentUserId,
        name: currentUserName,
        avatar: session?.user?.image ?? undefined,
      },
      to: partner ?? { id: '', name: '' },
      subject: currentThreadMessage?.subject ?? '',
      preview: text.slice(0, 120),
      body: finalBody,
      read: true,
      priority: 'normal',
      folder: 'sent',
      created_at: new Date().toISOString(),
      thread_root_id: messageId,
      delivery_status: 'sending',
      reply_to_id: replyToMessage?.id,
      entity_refs: pendingEntityRefs.length ? pendingEntityRefs : undefined,
    };
    messagesDataStore.appendReply(optimistic, messageId);

    try {
      const res = await messagesService.reply(
        messageId,
        finalBody,
        artifactIds.length ? artifactIds : undefined,
        clientMessageId
      );
      sendTyping(false);
      const serverId = res.data?.id ?? clientMessageId;
      messagesDataStore.reconcileOptimisticReply(
        clientMessageId,
        {
          ...optimistic,
          id: serverId,
          delivery_status: 'sent',
          created_at: res.data?.created_at ?? optimistic.created_at,
        },
        messageId
      );
      editor.commands.clearContent();
      setAttachments([]);
      setPendingEntityRefs([]);
      clearDraft();
      onClearReply?.();
      toast.success(t('messages.thread.sent'));
      onSent();
    } catch (err) {
      messagesDataStore.markOptimisticFailed(clientMessageId);
      toast.error(err instanceof Error ? err.message : t('messages.thread.sendFailed'));
    } finally {
      setSending(false);
    }
  }, [
    editor,
    attachments,
    messageId,
    replyToMessage,
    onClearReply,
    onSent,
    clearDraft,
    sendTyping,
    t,
    currentUserId,
    currentUserName,
    session?.user?.image,
    currentThreadMessage,
    pendingEntityRefs,
  ]);

  useEffect(() => {
    return () => {
      if (typingStopRef.current) clearTimeout(typingStopRef.current);
      sendTyping(false);
    };
  }, [sendTyping]);

  handleSendRef.current = handleSend;

  const handleJumpToCompose = useCallback(() => {
    const params = new URLSearchParams();

    if (currentThreadMessage) {
      if (currentThreadMessage.from?.email) {
        params.set('to', currentThreadMessage.from.email);
      }
      if (currentThreadMessage.subject) {
        params.set('subject', `Re: ${currentThreadMessage.subject}`);
      }
    }

    if (replyToMessage) {
      if (replyToMessage.from?.email) {
        params.set('to', replyToMessage.from.email);
      }
      if (replyToMessage.subject) {
        params.set('subject', `Re: ${replyToMessage.subject}`);
      }
    }

    const currentBody = editor?.getHTML() || '';
    if (currentBody && currentBody !== '<p></p>') {
      params.set('body', currentBody);
    }

    router.push(`${routes.messagesCompose}?${params.toString()}`);
  }, [currentThreadMessage, replyToMessage, editor, router]);

  const handleFilePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    for (const file of files) {
      const localId = `${Date.now()}-${file.name}`;
      const isImage = file.type.startsWith('image/');
      let dataUrl: string | undefined;
      if (isImage) {
        dataUrl = await new Promise<string>((resolve) => {
          const r = new FileReader();
          r.onload = () => resolve(r.result as string);
          r.readAsDataURL(file);
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
        const uploaded = await messagesService.uploadAttachment(
          file,
          (pct) => {
            setAttachments((prev) =>
              prev.map((a) => (a.id === localId ? { ...a, progress: pct } : a))
            );
          },
          isPeople ? 'user_chat' : 'mail'
        );
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

  return (
    <div
      id="inline-composer-anchor"
      className={cn(
        'relative z-10 shrink-0 border-t',
        isPeople
          ? 'border-teal-500/20 bg-teal-500/[0.03] dark:bg-teal-500/10'
          : 'border-muted bg-gray-50 dark:bg-gray-100'
      )}
    >
      {/* Collapsible header bar */}
      <button
        type="button"
        onClick={() => setComposerOpen((v) => !v)}
        className={cn(
          'flex w-full items-center justify-between px-4 py-2 text-left',
          'border-b text-xs font-medium transition-colors',
          isPeople
            ? 'border-teal-500/20 text-teal-700 hover:bg-teal-500/10 dark:text-teal-400'
            : 'border-muted text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-200/20'
        )}
      >
        <span>
          {replyToMessage
            ? `${t('messages.reply')}: ${replyToMessage.from.name}`
            : t('messages.thread.replyPlaceholder')}
        </span>
        {composerOpen ? (
          <PiCaretUpBold className="h-3.5 w-3.5 shrink-0" />
        ) : (
          <PiCaretDownBold className="h-3.5 w-3.5 shrink-0" />
        )}
      </button>

      {composerOpen && replyToMessage && (
        <ComposerReplyBar
          senderName={replyToMessage.from.name}
          preview={replyToMessage.preview || replyToMessage.subject || ''}
          onCancel={() => onClearReply?.()}
        />
      )}

      {composerOpen && (
      <div className="px-4 py-3">
        {attachments.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {attachments.map((att) => (
              <AttachmentCard
                key={att.id}
                att={att}
                compact
                onRemove={(id) => setAttachments((prev) => prev.filter((a) => a.id !== id))}
              />
            ))}
          </div>
        )}

        {voiceOpen && isPeople && (
          <VoiceNoteRecorder
            className="mb-2"
            onCancel={() => setVoiceOpen(false)}
            onRecorded={async (blob, durationMs) => {
              const file = new File([blob], `voice-${Date.now()}.webm`, { type: blob.type });
              const localId = `voice-${Date.now()}`;
              setAttachments((prev) => [
                ...prev,
                {
                  id: localId,
                  name: file.name,
                  size: file.size,
                  type: file.type,
                  uploading: true,
                  progress: 0,
                },
              ]);
              try {
                const uploaded = await messagesService.uploadAttachment(
                  file,
                  undefined,
                  isPeople ? 'user_chat' : 'mail'
                );
                await messagesService.reply(
                  messageId,
                  `<p>${t('messages.voice.sentLabel')}</p>`,
                  [uploaded.artifactId],
                  crypto.randomUUID(),
                  'voice',
                  durationMs
                );
                setVoiceOpen(false);
                clearDraft();
                onClearReply?.();
                toast.success(t('messages.thread.sent'));
                onSent();
              } catch (err) {
                toast.error(err instanceof Error ? err.message : t('messages.thread.sendFailed'));
              }
            }}
          />
        )}

        <div className="max-h-[min(40vh,14rem)] overflow-hidden rounded-xl border border-muted bg-gray-0 dark:bg-gray-50">
          <div className="flex items-center gap-0.5 border-b border-muted px-2 py-1">
            <button
              type="button"
              title="Bold"
              onMouseDown={(e) => {
                e.preventDefault();
                editor?.chain().focus().toggleBold().run();
              }}
              className="rounded p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <PiTextB className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              title="Italic"
              onMouseDown={(e) => {
                e.preventDefault();
                editor?.chain().focus().toggleItalic().run();
              }}
              className="rounded p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <PiTextItalic className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              title="Link"
              onMouseDown={(e) => {
                e.preventDefault();
                const url = window.prompt('URL:', 'https://');
                if (url) editor?.chain().focus().setLink({ href: url }).run();
              }}
              className="rounded p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <PiLinkBold className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              title={t('messages.compose.attachments')}
              onClick={() => fileInputRef.current?.click()}
              className="rounded p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <PiPaperclipBold className="h-3.5 w-3.5" />
            </button>
            <EntityAttachPicker selected={pendingEntityRefs} onChange={setPendingEntityRefs} />
            {!isPeople && (
              <button
                type="button"
                title={t('messages.compose.openFullEditor')}
                onClick={handleJumpToCompose}
                className="rounded p-1.5 text-primary hover:bg-primary/10 dark:hover:bg-primary/20"
              >
                <PiArrowSquareOut className="h-3.5 w-3.5" />
              </button>
            )}
            {isPeople && (
              <button
                type="button"
                title={t('messages.voice.record')}
                onClick={() => setVoiceOpen((v) => !v)}
                className="rounded p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <PiMicrophoneBold className="h-3.5 w-3.5" />
              </button>
            )}
            <div className="relative" ref={emojiAnchorRef}>
              <button
                type="button"
                title="Emoji"
                onClick={() => setEmojiOpen((v) => !v)}
                className="rounded p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <PiSmileyBold className="h-3.5 w-3.5" />
              </button>
              <EmojiPicker
                isOpen={emojiOpen}
                onClose={() => setEmojiOpen(false)}
                onSelect={(emoji) => editor?.chain().focus().insertContent(emoji).run()}
                anchorRef={emojiAnchorRef}
              />
            </div>
            <button
              type="button"
              title={t('messages.attachments.fromLibrary')}
              onClick={() => setPickerOpen(true)}
              className="ms-auto rounded px-2 py-1 text-[10px] font-medium text-primary hover:bg-primary/10"
            >
              {t('messages.attachments.library')}
            </button>
            <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFilePick} />
          </div>
          <EditorContent editor={editor} />
          <div className="flex items-center justify-between border-t border-muted px-3 py-2">
            <span className="text-[10px] text-gray-400">{t('messages.thread.sendHint')}</span>
            <Button
              size="sm"
              variant="solid"
              isLoading={sending}
              onClick={handleSend}
              className={cn('gap-1', isPeople && 'bg-teal-500 hover:bg-teal-600 border-teal-500')}
            >
              <PiPaperPlaneTiltBold className="h-3.5 w-3.5" />
              {t('messages.reply')}
            </Button>
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
      )}
    </div>
  );
}
