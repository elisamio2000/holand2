'use client';

import { useState } from 'react';
import cn from '@core/utils/class-names';
import EmojiPicker from './emoji-picker';

export type MessageReaction = {
  emoji: string;
  count: number;
  reactedByMe?: boolean;
};

type MessageReactionsProps = {
  messageId: string;
  reactions?: MessageReaction[];
  onReact?: (messageId: string, emoji: string) => void;
  isOwn?: boolean;
};

export default function MessageReactions({
  messageId,
  reactions = [],
  onReact,
  isOwn = false,
}: MessageReactionsProps) {
  const [pickerOpen, setPickerOpen] = useState(false);

  const handlePick = (emoji: string) => {
    onReact?.(messageId, emoji);
    setPickerOpen(false);
  };

  return (
    <div
      className={cn(
        'relative flex shrink-0 flex-col items-center gap-0.5 self-end',
        isOwn ? 'order-first' : 'order-last'
      )}
    >
      {reactions.map((r) => (
        <button
          key={r.emoji}
          type="button"
          onClick={() => handlePick(r.emoji)}
          className={cn(
            'inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-xs transition-colors',
            r.reactedByMe
              ? 'border-teal-500/40 bg-teal-500/10 text-teal-700 dark:text-teal-300'
              : 'border-muted bg-gray-50 hover:bg-gray-100 dark:bg-gray-100'
          )}
        >
          <span>{r.emoji}</span>
          {r.count > 1 && <span className="text-[10px] text-gray-500">{r.count}</span>}
        </button>
      ))}
      <button
        type="button"
        onClick={() => setPickerOpen((v) => !v)}
        className="rounded-full border border-dashed border-muted px-1.5 py-0.5 text-xs text-gray-400 hover:border-teal-500/40 hover:text-teal-600"
        aria-label="Add reaction"
      >
        +
      </button>
      {pickerOpen && (
        <EmojiPicker
          isOpen={pickerOpen}
          onClose={() => setPickerOpen(false)}
          onSelect={handlePick}
          className={cn('absolute bottom-0 z-[10050]', isOwn ? 'end-full me-1' : 'start-full ms-1')}
        />
      )}
    </div>
  );
}
