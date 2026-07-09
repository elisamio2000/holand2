'use client';

import { useEffect, useRef, useState } from 'react';
import { createId } from '@paralleldrive/cuid2';
import { useTranslation } from 'react-i18next';
import { Button, Select, Text, Textarea } from 'rizzui';
import type { BoardCommentPin, BoardCommentReply } from '../lib/board-types';

export type CommentFilter = 'all' | 'open' | 'resolved' | 'anchored';

export interface BoardCommentsPanelProps {
  comments: BoardCommentPin[];
  pendingPin?: { x: number; y: number } | null;
  selectedObjectId?: string;
  addCommentMode?: boolean;
  highlightedCommentId?: string | null;
  onChange: (comments: BoardCommentPin[]) => void;
  className?: string;
}

export function BoardCommentsPanel({
  comments,
  pendingPin,
  selectedObjectId,
  addCommentMode = false,
  highlightedCommentId,
  onChange,
  className,
}: BoardCommentsPanelProps) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState('');
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<CommentFilter>('all');
  const draftRef = useRef<HTMLTextAreaElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (pendingPin) {
      setDraft('');
      requestAnimationFrame(() => draftRef.current?.focus());
    }
  }, [pendingPin]);

  useEffect(() => {
    if (!highlightedCommentId || !listRef.current) return;
    const el = listRef.current.querySelector(`[data-comment-id="${highlightedCommentId}"]`);
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [highlightedCommentId]);

  const filtered = comments.filter((c) => {
    if (filter === 'open') return !c.resolved;
    if (filter === 'resolved') return c.resolved;
    if (filter === 'anchored') return Boolean(c.objectId);
    return true;
  });

  const addComment = () => {
    const text = draft.trim();
    if (!text) return;
    const pin = pendingPin ?? { x: 0, y: 0 };
    const next: BoardCommentPin = {
      id: createId(),
      x: pin.x,
      y: pin.y,
      objectId: selectedObjectId,
      text,
      createdAt: new Date().toISOString(),
    };
    onChange([...comments, next]);
    setDraft('');
  };

  const addReply = (commentId: string) => {
    const body = (replyDrafts[commentId] ?? '').trim();
    if (!body) return;
    const reply: BoardCommentReply = {
      id: createId(),
      body,
      createdAt: new Date().toISOString(),
    };
    onChange(
      comments.map((c) =>
        c.id === commentId ? { ...c, replies: [...(c.replies ?? []), reply] } : c
      )
    );
    setReplyDrafts((d) => ({ ...d, [commentId]: '' }));
  };

  const toggleResolved = (id: string) => {
    onChange(comments.map((c) => (c.id === id ? { ...c, resolved: !c.resolved } : c)));
  };

  const removeComment = (id: string) => {
    onChange(comments.filter((c) => c.id !== id));
  };

  return (
    <div className={`flex h-full flex-col p-3 ${className ?? ''}`}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <Text className="font-semibold">{t('boards.comments.title', 'Comments')}</Text>
        <Select
          size="sm"
          className="h-7 min-w-[110px] text-xs"
          value={filter}
          onChange={(v) => setFilter(v as CommentFilter)}
          options={[
            { label: t('boards.comments.filterAll', 'All'), value: 'all' },
            { label: t('boards.comments.filterOpen', 'Open'), value: 'open' },
            { label: t('boards.comments.filterResolved', 'Resolved'), value: 'resolved' },
            { label: t('boards.comments.filterAnchored', 'On object'), value: 'anchored' },
          ]}
        />
      </div>

      {addCommentMode && !pendingPin ? (
        <div className="mb-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
          {t('boards.comments.placeHint', 'Click on the canvas to place a comment pin.')}
        </div>
      ) : null}

      {pendingPin ? (
        <div className="mb-4 rounded border border-primary/30 bg-primary/5 p-3">
          <Text className="mb-2 text-xs text-gray-600">
            {t('boards.comments.newPin', 'New pin at')} ({Math.round(pendingPin.x)}, {Math.round(pendingPin.y)})
          </Text>
          <Textarea
            ref={draftRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={t('boards.comments.placeholder', 'Write a comment…')}
            rows={3}
            className="mb-2"
          />
          <Button size="sm" onClick={addComment} disabled={!draft.trim()}>
            {t('boards.comments.add', 'Add comment')}
          </Button>
        </div>
      ) : null}

      <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <Text className="text-sm text-gray-500">{t('boards.comments.empty', 'No comments yet.')}</Text>
        ) : (
          <ul className="space-y-3">
            {filtered.map((c) => (
              <li
                key={c.id}
                data-comment-id={c.id}
                className={`rounded border p-3 ${
                  c.id === highlightedCommentId
                    ? 'border-primary bg-primary/5'
                    : c.resolved
                      ? 'border-muted bg-gray-50 opacity-70'
                      : 'border-muted'
                }`}
              >
                <div className="mb-1 flex items-start justify-between gap-2">
                  <Text className="text-xs text-gray-500">
                    ({Math.round(c.x)}, {Math.round(c.y)})
                    {c.objectId ? ` · ${c.objectId.slice(0, 8)}…` : ''}
                  </Text>
                  <div className="flex shrink-0 gap-1">
                    <Button size="sm" variant="outline" onClick={() => toggleResolved(c.id)}>
                      {c.resolved
                        ? t('boards.comments.reopen', 'Reopen')
                        : t('boards.comments.resolve', 'Resolve')}
                    </Button>
                    <Button size="sm" variant="text" onClick={() => removeComment(c.id)}>
                      {t('boards.comments.delete', 'Delete')}
                    </Button>
                  </div>
                </div>
                <Text className={`text-sm ${c.resolved ? 'line-through' : ''}`}>{c.text}</Text>
                {(c.replies ?? []).length > 0 ? (
                  <ul className="mt-2 space-y-1 border-s-2 border-muted ps-3">
                    {(c.replies ?? []).map((r) => (
                      <li key={r.id} className="text-xs text-gray-600">
                        {r.body}
                      </li>
                    ))}
                  </ul>
                ) : null}
                <div className="mt-2 flex gap-2">
                  <Textarea
                    value={replyDrafts[c.id] ?? ''}
                    onChange={(e) => setReplyDrafts((d) => ({ ...d, [c.id]: e.target.value }))}
                    placeholder={t('boards.comments.replyPlaceholder', 'Reply…')}
                    rows={1}
                    className="flex-1 text-xs"
                  />
                  <Button size="sm" variant="outline" onClick={() => addReply(c.id)} disabled={!replyDrafts[c.id]?.trim()}>
                    {t('boards.comments.reply', 'Reply')}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
