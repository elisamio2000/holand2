// ============================================
// CodeBlock — Syntax-highlighted code with copy & canvas actions
// Uses react-syntax-highlighter for virtual DOM based highlighting
// Theme-aware: follows global light/dark theme via next-themes
// ============================================

'use client';

import { useCallback, useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { useTranslation } from 'react-i18next';
import { PiCopySimple, PiCheck, PiArrowsOutSimple, PiListNumbers } from 'react-icons/pi';
import cn from '@core/utils/class-names';
import { useTheme } from 'next-themes';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/cjs/styles/prism';
import type { CanvasContent } from '@/types/chat.types';
import { chooseFenceBodyForCopy } from '@/utils/markdown-fence-copy';
import { normalizeAssistantMessageForCopy, prepareMarkdownForRender } from '@/utils/markdown-fence-unwrap';
import { splitMarkdownSingleMermaid } from '@/utils/markdown-mermaid-split';
import {
  isMarkdownFenceLanguage,
  shouldRenderFenceAsMarkdown,
} from '@/utils/markdown-document-detect';
import MermaidBlock from './mermaid-block';

/** Lazy: avoids static circular import (markdown-renderer → CodeBlock → markdown-renderer). */
const MarkdownRendererLazy = dynamic(
  () => import('./markdown-renderer').then((m) => m.default),
  {
    ssr: false,
    loading: () => (
      <div className="px-3 py-6 text-center text-xs text-gray-400 dark:text-gray-500">Loading preview…</div>
    ),
  }
);

interface CodeBlockProps {
  /** Code content */
  children: string;
  /** Programming language identifier */
  language?: string;
  /** Callback to open code in canvas panel */
  onOpenCanvas?: (content: CanvasContent) => void;
  /** Full assistant markdown (for copy when parent truncates display) */
  fullMarkdown?: string;
}

/**
 * CodeBlock — Renders a code block with syntax highlighting,
 * copy-to-clipboard button, "open in canvas" action, and line numbers.
 *
 * Features:
 * - Line numbers toggle
 * - Full code copy to clipboard
 * - Canvas panel integration
 * - Virtual DOM based highlighting (no DOM manipulation)
 *
 * Uses react-syntax-highlighter with Prism for syntax coloring.
 * Follows global app theme via next-themes (useTheme hook).
 *
 * Benefits over hljs.highlightElement():
 * - Virtual DOM — only changed parts update
 * - No dangerouslySetInnerHTML
 * - Theme switching without re-mount
 *
 * @requires react-syntax-highlighter — for syntax highlighting
 * @requires next-themes — for global theme detection
 *
 * @example
 * ```tsx
 * <CodeBlock language="python" onOpenCanvas={openCanvas}>
 *   {'print("hello")'}
 * </CodeBlock>
 * ```
 */
export default function CodeBlock({
  children,
  language,
  onOpenCanvas,
  fullMarkdown,
}: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const [showLineNumbers, setShowLineNumbers] = useState(true);
  const { theme } = useTheme();
  const { t } = useTranslation();

  // Follow global app theme for syntax highlighting colors
  const isDark = theme === 'dark';
  const highlightTheme = isDark ? oneDark : oneLight;

  // Ensure children is always a string
  const codeContent = useMemo(() => String(children || ''), [children]);
  const renderMarkdown = shouldRenderFenceAsMarkdown(language, codeContent);
  const preparedMarkdown = useMemo(
    () => (renderMarkdown ? prepareMarkdownForRender(codeContent) : codeContent),
    [renderMarkdown, codeContent]
  );

  const handleCopy = useCallback(async () => {
    console.info('[CodeBlock] Copying code to clipboard');
    try {
      const raw = chooseFenceBodyForCopy(codeContent, fullMarkdown);
      const text = renderMarkdown
        ? normalizeAssistantMessageForCopy(raw)
        : raw;
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      console.error('[CodeBlock] Failed to copy to clipboard');
    }
  }, [codeContent, fullMarkdown, renderMarkdown]);

  const handleOpenCanvas = useCallback(() => {
    if (!onOpenCanvas) return;
    const md = isMarkdownFenceLanguage(language);
    onOpenCanvas({
      type: md ? 'markdown' : 'code',
      title: md
        ? language
          ? `Markdown — ${language}`
          : 'Markdown'
        : language
          ? `Code — ${language}`
          : 'Code',
      content: md ? prepareMarkdownForRender(codeContent) : codeContent,
      language: md ? undefined : language,
    });
  }, [codeContent, language, onOpenCanvas]);

  const displayLanguage = renderMarkdown
    ? isMarkdownFenceLanguage(language)
      ? language
      : 'markdown'
    : language;
  const mdSplit = useMemo(
    () => (renderMarkdown ? splitMarkdownSingleMermaid(codeContent) : null),
    [renderMarkdown, codeContent]
  );

  if (renderMarkdown && mdSplit && !mdSplit.introMd && !mdSplit.trailingMd) {
    return (
      <MermaidBlock onOpenCanvas={onOpenCanvas} fullMarkdown={fullMarkdown}>
        {mdSplit.mermaidBody}
      </MermaidBlock>
    );
  }

  return (
    <div className="group relative my-3 overflow-hidden rounded-lg border border-muted">
      {/* Header bar */}
      <div className="flex items-center justify-between bg-gray-100 px-3 py-1.5 dark:bg-gray-50">
        <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
          {displayLanguage || language || 'code'}
        </span>
        <div className="flex items-center gap-1">
          {!renderMarkdown && (
            <button
              onClick={() => setShowLineNumbers(!showLineNumbers)}
              className={cn(
                'rounded p-1 text-gray-500 transition-colors hover:bg-gray-200 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-200/30 dark:hover:text-gray-300',
                showLineNumbers && 'text-primary'
              )}
              title={showLineNumbers ? t('codeBlock.hideLineNumbers') : t('codeBlock.showLineNumbers')}
            >
              <PiListNumbers className="h-3.5 w-3.5" />
            </button>
          )}
          {onOpenCanvas && (
            <button
              onClick={handleOpenCanvas}
              className="rounded p-1 text-gray-500 transition-colors hover:bg-gray-200 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-200/30 dark:hover:text-gray-300"
              title={t('codeBlock.openCanvas')}
            >
              <PiArrowsOutSimple className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            onClick={handleCopy}
            className="rounded p-1 text-gray-500 transition-colors hover:bg-gray-200 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-200/30 dark:hover:text-gray-300"
            title={copied ? t('codeBlock.copied') : t('codeBlock.copy')}
          >
            {copied ? (
              <PiCheck className="h-3.5 w-3.5 text-green-500" />
            ) : (
              <PiCopySimple className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      </div>
      {renderMarkdown ? (
        <div className="max-h-[min(70vh,520px)] overflow-y-auto bg-gray-0 px-3 py-3 dark:bg-gray-50">
          <div className="prose prose-sm max-w-none dark:prose-invert">
            <MarkdownRendererLazy
              content={preparedMarkdown}
              fullSource={fullMarkdown}
              onOpenCanvas={onOpenCanvas}
              documentDepth="nested"
              className="font-vazirmatn"
            />
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto bg-gray-50 dark:bg-gray-100" dir="ltr">
          <SyntaxHighlighter
            language={language || 'text'}
            style={highlightTheme}
            showLineNumbers={showLineNumbers}
            customStyle={{
              margin: 0,
              padding: '1rem',
              background: 'transparent',
            }}
            className="text-xs leading-relaxed"
            lineNumberStyle={{
              minWidth: '2.5em',
              paddingRight: '1em',
              userSelect: 'none',
            }}
          >
            {codeContent}
          </SyntaxHighlighter>
        </div>
      )}
    </div>
  );
}
