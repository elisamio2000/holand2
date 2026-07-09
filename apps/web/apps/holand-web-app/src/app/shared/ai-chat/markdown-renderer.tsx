// ============================================
// MarkdownRenderer — AI response markdown rendering
// Handles code blocks, tables, links, lists, math equations, etc.
// ============================================

'use client';

import { useMemo, useCallback, useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { PiArrowsOutSimple } from 'react-icons/pi';
import cn from '@core/utils/class-names';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeRaw from 'rehype-raw';
import rehypeKatex from 'rehype-katex';
// NOTE: rehype-highlight removed — CodeBlock uses hljs.highlightElement() directly
// to avoid converting children to React elements ([object Object] bug)
import 'katex/dist/katex.min.css';
import CodeBlock from './code-block';
import MermaidBlock from './mermaid-block';
import { MermaidRenderProvider } from '@/app/shared/ai-chat/mermaid-render-context';
import { MarkdownAuthAudio, MarkdownAuthImg, MarkdownAuthVideo } from './authenticated-markdown-media';
import {
  normalizeGatewayArtifactSrc,
} from '@/utils/gateway-media-url';
import { detectDirection, extractTextFromNode } from '@/utils/detect-direction';
import type { CanvasContent } from '@/types/chat.types';
import { shouldRenderFenceAsMarkdown, isMarkdownFenceLanguage } from '@/utils/markdown-document-detect';
import {
  extractSingleMermaidBody,
  prepareMarkdownForRender,
} from '@/utils/markdown-fence-unwrap';

interface MarkdownRendererProps {
  /** Markdown content to render */
  content: string;
  /**
   * Full message source for copy actions when `content` is truncated in the parent.
   * Defaults to `content` when omitted.
   */
  fullSource?: string;
  /** Callback to open content in canvas panel */
  onOpenCanvas?: (content: CanvasContent) => void;
  /** Additional CSS class */
  className?: string;
  /**
   * `nested` — rendered inside a markdown CodeBlock; inner markdown/mermaid fences
   * must not spawn another CodeBlock chrome layer.
   */
  documentDepth?: 'root' | 'nested';
}

/** Normalize react-markdown `code` children (string | array | nested) to plain text for fenced blocks. */
function codeFenceText(children: ReactNode): string {
  if (typeof children === 'string') return children;
  if (typeof children === 'number') return String(children);
  if (children == null || children === false) return '';
  if (Array.isArray(children))
    return children.map((c) => codeFenceText(c as ReactNode)).join('');
  if (typeof children === 'object' && children !== null && 'props' in children) {
    const p = (children as { props?: { children?: ReactNode } }).props;
    if (p?.children != null) return codeFenceText(p.children);
  }
  return String(children);
}

/** Mermaid source often appears without a fence language tag; detect common diagram keywords (local render, no external service). */
function looksLikeMermaidDiagram(source: string): boolean {
  const s = source.trimStart();
  return /^(graph|flowchart|sequenceDiagram|classDiagram|stateDiagram|stateDiagram-v2|erDiagram|journey|gantt|pie|gitgraph|C4Context|C4Container|mindmap|sankey-beta|timeline|quadrantChart|block-beta)\b/i.test(
    s
  );
}

/**
 * MarkdownRenderer — Renders AI response content as styled markdown.
 *
 * Features:
 * - GitHub Flavored Markdown (tables, strikethrough, tasklists)
 * - LaTeX math equations (inline $...$ and display $$...$$)
 * - Syntax-highlighted code blocks with copy & canvas actions
 * - Styled tables, blockquotes, lists, links
 * - Raw HTML support (for AI-generated HTML)
 * - Professional bidi support: per-block `dir="auto"` for automatic
 *   RTL/LTR detection (Arabic, Hebrew, Persian, etc.)
 *   The outer wrapper intentionally does NOT have `dir="auto"` so
 *   each block element independently detects its text direction.
 *
 * @requires react-markdown — base markdown renderer
 * @requires remark-gfm — GFM support
 * @requires remark-math — LaTeX math parsing
 * @requires rehype-katex — KaTeX math rendering
 * @requires highlight.js — syntax highlighting (via CodeBlock component)
 *
 * @example
 * ```tsx
 * <MarkdownRenderer content={message.content} onOpenCanvas={openCanvas} />
 * ```
 */
export default function MarkdownRenderer({
  content,
  fullSource,
  onOpenCanvas,
  className,
  documentDepth = 'root',
}: MarkdownRendererProps) {
  const { t } = useTranslation();
  const documentDepthRef = useRef(documentDepth);
  documentDepthRef.current = documentDepth;
  /**
   * `content` / `fullSource` change often during streaming. They must NOT live in the
   * `components` useMemo dependency list — a new `components` object remounts fenced
   * blocks (Mermaid) and retriggers expensive async renders in a tight loop.
   */
  const onOpenCanvasRef = useRef(onOpenCanvas);
  onOpenCanvasRef.current = onOpenCanvas;
  const sourceForCopyRef = useRef(fullSource ?? content);
  sourceForCopyRef.current = fullSource ?? content;

  const handleOpenCanvas = useCallback((canvasContent: CanvasContent) => {
    onOpenCanvasRef.current?.(canvasContent);
  }, []);

  const preparedContent = useMemo(
    () => prepareMarkdownForRender(content),
    [content]
  );

  const components: Components = useMemo(
    () => ({
      // Code blocks & inline code
      code(props) {
        const { children, className: codeClassName, ...rest } = props;
        const match = /language-([\w-]+)/i.exec(codeClassName || '');
        const languageRaw = match?.[1];
        const language = languageRaw?.toLowerCase();
        let body = prepareMarkdownForRender(
          codeFenceText(children).replace(/\n$/, '')
        );
        const fenceCopySource = sourceForCopyRef.current;
        const mermaidOnly = extractSingleMermaidBody(body);
        if (mermaidOnly && isMarkdownFenceLanguage(language)) {
          const rest = body
            .replace(/^```(?:mermaid|mmd)\s*\n[\s\S]*?\n```\s*$/i, '')
            .trim();
          if (!rest) {
            return (
              <div className="not-prose my-4">
                <MermaidBlock
                  variant={
                    documentDepthRef.current === 'nested' ? 'embedded' : 'standalone'
                  }
                  onOpenCanvas={handleOpenCanvas}
                  fullMarkdown={fenceCopySource}
                >
                  {mermaidOnly}
                </MermaidBlock>
              </div>
            );
          }
        }
        const isBlock =
          Boolean(match) ||
          body.includes('\n') ||
          looksLikeMermaidDiagram(body);

        if (match || isBlock) {
          const isMermaidFence =
            language === 'mermaid' ||
            language === 'mmd' ||
            (!language && looksLikeMermaidDiagram(body));

          if (isMermaidFence) {
            const mermaidVariant =
              documentDepthRef.current === 'nested' ? 'embedded' : 'standalone';
            return (
              <div className="not-prose my-4">
                <MermaidBlock
                  variant={mermaidVariant}
                  onOpenCanvas={handleOpenCanvas}
                  fullMarkdown={fenceCopySource}
                >
                  {body}
                </MermaidBlock>
              </div>
            );
          }

          if (shouldRenderFenceAsMarkdown(language, body)) {
            if (documentDepthRef.current === 'nested') {
              return (
                <div className="my-4">
                  <MarkdownRenderer
                    content={body}
                    fullSource={fenceCopySource}
                    onOpenCanvas={handleOpenCanvas}
                    documentDepth="nested"
                    className="font-vazirmatn prose-sm max-w-none dark:prose-invert"
                  />
                </div>
              );
            }
            return (
              <CodeBlock
                language={languageRaw || 'markdown'}
                onOpenCanvas={handleOpenCanvas}
                fullMarkdown={fenceCopySource}
              >
                {body}
              </CodeBlock>
            );
          }

          return (
            <CodeBlock
              language={languageRaw}
              onOpenCanvas={handleOpenCanvas}
              fullMarkdown={fenceCopySource}
            >
              {body}
            </CodeBlock>
          );
        }

        return (
          <code
            className="rounded bg-gray-100 px-1.5 py-0.5 text-xs font-mono text-primary"
            {...rest}
          >
            {children}
          </code>
        );
      },

      // Prevent wrapping code blocks in extra <pre>
      pre(props) {
        const { children } = props;
        return <>{children}</>;
      },

      // Tables — header bar matches CodeBlock / MermaidBlock chrome
      table(props) {
        return (
          <div
            data-markdown-table
            className="group relative my-3 overflow-hidden rounded-lg border border-muted"
          >
            {onOpenCanvasRef.current && (
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-muted/60 bg-muted/30 px-3 py-1.5 dark:bg-muted/15">
                <span className="text-xs font-medium text-muted-foreground">table</span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={(e) => {
                      const wrapper = (e.currentTarget as HTMLElement).closest(
                        '[data-markdown-table]'
                      );
                      const tableEl = wrapper?.querySelector('table');
                      if (!tableEl) return;
                      const html = tableEl.outerHTML;
                      handleOpenCanvas({
                        type: 'html',
                        title: 'Table',
                        content: html,
                      });
                    }}
                    className="rounded p-1 text-gray-500 transition-colors hover:bg-gray-200 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-200/30 dark:hover:text-gray-300"
                    title={t('codeBlock.openCanvas')}
                    aria-label={t('codeBlock.openCanvas')}
                  >
                    <PiArrowsOutSimple className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="w-full text-sm" {...props} />
            </div>
          </div>
        );
      },

      thead(props) {
        return (
          <thead
            className="bg-gray-50 text-start text-xs font-semibold uppercase text-gray-600 dark:bg-gray-100"
            {...props}
          />
        );
      },

      th(props) {
        return (
          <th className="px-3 py-2 font-semibold" dir="auto" {...props} />
        );
      },

      td(props) {
        return (
          <td
            className="border-t border-muted px-3 py-2 text-gray-700 dark:text-gray-300"
            dir="auto"
            {...props}
          />
        );
      },

      // Links
      a(props) {
        return (
          <a
            className="text-primary underline decoration-primary/30 underline-offset-2 transition-colors hover:decoration-primary"
            target="_blank"
            rel="noopener noreferrer"
            {...props}
          />
        );
      },

      // Blockquotes
      // WHY programmatic dir: blockquote wraps <p dir="auto">, and HTML spec
      // skips dir-attributed descendants when resolving dir="auto" on the parent.
      // So we extract text and detect direction explicitly.
      blockquote(props) {
        const text = extractTextFromNode(props.children);
        const resolvedDir = detectDirection(text);
        return (
          <blockquote
            className="my-3 border-s-[3px] border-primary/40 ps-4 italic text-gray-600 dark:text-gray-400"
            dir={resolvedDir}
            {...props}
          />
        );
      },

      // Lists
      // WHY programmatic dir: HTML spec §14.3.2 — dir="auto" on <ol> skips
      // <li dir="auto"> descendants entirely, so the list always defaults to LTR.
      // We extract text from children and programmatically set dir="rtl" or "ltr".
      // This fixes list marker positioning (1., 2., •) for RTL languages.
      ul(props) {
        const text = extractTextFromNode(props.children);
        const resolvedDir = detectDirection(text);
        return (
          <ul className="my-2 list-disc space-y-1 ps-6" dir={resolvedDir} {...props} />
        );
      },

      ol(props) {
        const text = extractTextFromNode(props.children);
        const resolvedDir = detectDirection(text);
        return (
          <ol className="my-2 list-decimal space-y-1 ps-6" dir={resolvedDir} {...props} />
        );
      },

      // WHY no dir on <li>: The <li> inherits direction from its parent <ol>/<ul>.
      // This ensures consistent marker positioning across all items in a list.
      // Individual paragraphs inside <li> still use dir="auto" for text alignment.
      li(props) {
        return (
          <li className="text-gray-700 dark:text-gray-300" {...props} />
        );
      },

      // Headings
      h1(props) {
        return (
          <h1
            className="mb-3 mt-5 text-xl font-bold text-gray-900 dark:text-gray-700"
            dir="auto"
            {...props}
          />
        );
      },

      h2(props) {
        return (
          <h2
            className="mb-2 mt-4 text-lg font-bold text-gray-900 dark:text-gray-700"
            dir="auto"
            {...props}
          />
        );
      },

      h3(props) {
        return (
          <h3
            className="mb-2 mt-3 text-base font-semibold text-gray-900 dark:text-gray-700"
            dir="auto"
            {...props}
          />
        );
      },

      // Paragraphs — dir="auto" for smart RTL/LTR detection
      p(props) {
        return (
          <p
            className="my-2 leading-relaxed text-gray-700 dark:text-gray-300"
            dir="auto"
            {...props}
          />
        );
      },

      // Horizontal rules
      hr() {
        return <hr className="my-4 border-muted" />;
      },

      // Images — gateway URLs need authenticated fetch
      img(props) {
        const { src, alt, className, ...rest } = props;
        if (typeof src === 'string') {
          return (
            <MarkdownAuthImg
              src={src}
              alt={typeof alt === 'string' ? alt : ''}
              className={cn('my-3 max-w-full rounded-lg', className)}
              loading="lazy"
              {...rest}
            />
          );
        }
        return (
          // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
          <img
            className="my-3 max-w-full rounded-lg"
            loading="lazy"
            alt=""
            {...props}
          />
        );
      },

      video(props) {
        const { src, className } = props;
        // Route all markdown videos through the global player (handles both
        // authenticated gateway artifacts and plain URLs).
        const resolved = typeof src === 'string' ? normalizeGatewayArtifactSrc(src) : undefined;
        return (
          <MarkdownAuthVideo
            src={resolved}
            className={cn('my-3 max-w-full', className)}
          />
        );
      },

      audio(props) {
        const { src, className, title, ...rest } = props;
        if (typeof src === 'string') {
          const resolved = normalizeGatewayArtifactSrc(src);
          return (
            <MarkdownAuthAudio
              src={resolved}
              className={cn('my-2 w-full max-w-md', className)}
              title={typeof title === 'string' ? title : undefined}
              {...rest}
            />
          );
        }
        return (
          <div className={cn('my-2 text-xs text-orange-700', className)}>
            Could not load audio
          </div>
        );
      },
    }),
    [handleOpenCanvas, t]
  );

  return (
    <MermaidRenderProvider variant="embedded">
      <div className={className}>
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkMath]}
          rehypePlugins={[rehypeRaw, rehypeKatex]}
          components={components}
        >
          {preparedContent}
        </ReactMarkdown>
      </div>
    </MermaidRenderProvider>
  );
}
