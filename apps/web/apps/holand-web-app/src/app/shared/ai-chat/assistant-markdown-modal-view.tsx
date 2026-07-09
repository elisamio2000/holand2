'use client';

import { Tooltip } from '@/components/tooltip';
import { useCallback, useState } from 'react';
import { PiX } from 'react-icons/pi';
import { ActionIcon, Title } from 'rizzui';
import { useModal } from '@/app/shared/modal-views/use-modal';
import type { CanvasContent } from '@/types/chat.types';
import MarkdownErrorBoundary from './markdown-error-boundary';
import MarkdownRenderer from './markdown-renderer';
import CanvasPanel from './canvas-panel';
import { isMarkdownFenceLanguage } from '@/utils/markdown-document-detect';
import { prepareMarkdownForRender } from '@/utils/markdown-fence-unwrap';

interface AssistantMarkdownModalViewProps {
  /** Full markdown to render */
  content: string;
  /** Optional title in header */
  title?: string;
  onOpenCanvas?: (content: CanvasContent) => void;
}

/**
 * Full-message markdown viewer with stacked canvas layers (markdown → diagram).
 */
export default function AssistantMarkdownModalView({
  content,
  title = 'Message',
  onOpenCanvas,
}: AssistantMarkdownModalViewProps) {
  const { closeModal } = useModal();
  const prepared = prepareMarkdownForRender(content);
  const [stack, setStack] = useState<CanvasContent[]>([
    {
      type: 'markdown',
      title,
      content: prepared,
    },
  ]);

  const top = stack[stack.length - 1]!;
  const isDiagramView = top.type === 'diagram';
  const showMarkdownBody =
    top.type === 'markdown' ||
    (top.type === 'code' && isMarkdownFenceLanguage(top.language));

  const handlePushCanvas = useCallback(
    (c: CanvasContent) => {
      setStack((prev) => [...prev, c]);
      onOpenCanvas?.(c);
    },
    [onOpenCanvas]
  );

  const handleClose = useCallback(() => {
    if (stack.length > 1) {
      setStack((prev) => prev.slice(0, -1));
      return;
    }
    closeModal();
  }, [stack.length, closeModal]);

  return (
    <div className="flex h-[80vh] max-h-[85vh] min-h-[400px] flex-col overflow-hidden">
      <div className="flex items-center gap-3 border-b border-muted px-5 py-3.5">
        <div className="min-w-0 flex-1">
          <Title as="h6" className="truncate">
            {top.title || title}
          </Title>
          <div className="mt-0.5 flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500">
            <span>{isDiagramView ? 'Mermaid' : 'Markdown'}</span>
            {stack.length > 1 ? (
              <span>· Layer {stack.length}</span>
            ) : null}
          </div>
        </div>
        <Tooltip content="Close" placement="bottom">
          <ActionIcon
            variant="text"
            size="md"
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
            aria-label="Close"
          >
            <PiX className="h-5 w-5" />
          </ActionIcon>
        </Tooltip>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        {showMarkdownBody ? (
          <div className="custom-scrollbar h-full overflow-y-auto p-4">
            <MarkdownErrorBoundary fallbackContent={top.content}>
              <div className="prose prose-sm max-w-none dark:prose-invert">
                <MarkdownRenderer
                  content={top.content}
                  fullSource={top.content}
                  onOpenCanvas={handlePushCanvas}
                  className="font-vazirmatn"
                />
              </div>
            </MarkdownErrorBoundary>
          </div>
        ) : (
          <CanvasPanel
            content={top}
            onClose={handleClose}
            onOpenCanvas={handlePushCanvas}
            variant="split"
          />
        )}
      </div>
    </div>
  );
}
