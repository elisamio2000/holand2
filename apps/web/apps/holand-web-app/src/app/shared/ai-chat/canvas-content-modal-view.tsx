'use client';

import { useCallback, useState } from 'react';
import { useModal } from '@/app/shared/modal-views/use-modal';
import type { CanvasContent } from '@/types/chat.types';
import CanvasPanel from './canvas-panel';

interface CanvasContentModalViewProps {
  content: CanvasContent;
  /** Sync: clear `canvasContent` in chat state when the modal is dismissed */
  onAfterClose: () => void;
}

/**
 * Full canvas viewer with stacked layers — opening a diagram from markdown
 * pushes a new layer; closing the top returns to the previous canvas.
 */
export default function CanvasContentModalView({
  content,
  onAfterClose,
}: CanvasContentModalViewProps) {
  const { closeModal } = useModal();
  const [stack, setStack] = useState<CanvasContent[]>([content]);

  const top = stack[stack.length - 1]!;

  const handlePushCanvas = useCallback((next: CanvasContent) => {
    setStack((prev) => [...prev, next]);
  }, []);

  const handleClose = useCallback(() => {
    if (stack.length > 1) {
      setStack((prev) => prev.slice(0, -1));
      return;
    }
    closeModal();
    onAfterClose();
  }, [stack.length, closeModal, onAfterClose]);

  return (
    <div className="flex h-[80vh] max-h-[85vh] min-h-[400px] w-full max-w-full flex-col overflow-hidden">
      {stack.length > 1 ? (
        <div className="flex shrink-0 items-center gap-2 border-b border-muted bg-muted/20 px-3 py-1.5 text-xs text-gray-500 dark:text-gray-400">
          <span className="font-medium text-gray-700 dark:text-gray-300">
            {top.title}
          </span>
          <span className="text-gray-400">·</span>
          <span>
            Layer {stack.length} — close to return to previous
          </span>
        </div>
      ) : null}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <CanvasPanel
          content={top}
          onClose={handleClose}
          onOpenCanvas={handlePushCanvas}
          variant="split"
        />
      </div>
    </div>
  );
}
