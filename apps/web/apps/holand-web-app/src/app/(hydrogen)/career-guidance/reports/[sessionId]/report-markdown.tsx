// ============================================
// ReportMarkdown — self-contained markdown renderer for AI analysis output
// Mirrors the aiv2 ai-chat approach: react-markdown + remark-gfm/math +
// rehype-raw/katex, with per-block dir="auto" RTL/LTR detection.
// Decoupled from the chat/canvas/mermaid stack so it is safe to use on the
// report route without pulling heavy dependencies.
// ============================================

'use client';

import { useMemo, type ReactNode } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeRaw from 'rehype-raw';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import cn from '@core/utils/class-names';
import { detectDirection, extractTextFromNode } from '@/utils/detect-direction';

interface ReportMarkdownProps {
  content: string;
  className?: string;
}

const components: Components = {
  h1: ({ children }) => (
    <h1 dir={detectDirection(extractTextFromNode(children))} className="mb-3 mt-5 text-lg font-bold text-gray-900">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 dir={detectDirection(extractTextFromNode(children))} className="mb-2 mt-5 text-base font-bold text-gray-900">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 dir={detectDirection(extractTextFromNode(children))} className="mb-2 mt-4 text-sm font-semibold text-gray-900">{children}</h3>
  ),
  h4: ({ children }) => (
    <h4 dir={detectDirection(extractTextFromNode(children))} className="mb-1 mt-3 text-sm font-semibold text-gray-800">{children}</h4>
  ),
  p: ({ children }) => (
    <p dir={detectDirection(extractTextFromNode(children))} className="my-2 text-sm leading-7 text-gray-700">{children}</p>
  ),
  ul: ({ children }) => <ul className="my-2 list-disc space-y-1 ps-6 text-sm leading-7 text-gray-700">{children}</ul>,
  ol: ({ children }) => <ol className="my-2 list-decimal space-y-1 ps-6 text-sm leading-7 text-gray-700">{children}</ol>,
  li: ({ children }) => (
    <li dir={detectDirection(extractTextFromNode(children))} className="marker:text-violet-500">{children}</li>
  ),
  strong: ({ children }) => <strong className="font-semibold text-gray-900">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  blockquote: ({ children }) => (
    <blockquote dir={detectDirection(extractTextFromNode(children))} className="my-3 border-s-4 border-violet-300 bg-violet-50/50 px-4 py-2 text-sm text-gray-700">{children}</blockquote>
  ),
  a: ({ children, href }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-violet-600 underline hover:text-violet-700">{children}</a>
  ),
  hr: () => <hr className="my-4 border-gray-200" />,
  table: ({ children }) => (
    <div className="my-3 overflow-x-auto">
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-gray-50">{children}</thead>,
  th: ({ children }) => (
    <th dir={detectDirection(extractTextFromNode(children))} className="border border-gray-200 px-3 py-2 text-start font-semibold text-gray-800">{children}</th>
  ),
  td: ({ children }) => (
    <td dir={detectDirection(extractTextFromNode(children))} className="border border-gray-200 px-3 py-2 text-gray-700">{children}</td>
  ),
  code: ({ className, children, ...props }) => {
    const isBlock = /language-/.test(className ?? '');
    if (isBlock) {
      return (
        <code dir="ltr" className={cn(className, 'block overflow-x-auto whitespace-pre text-xs')} {...props}>{children}</code>
      );
    }
    return <code className="rounded bg-gray-100 px-1 py-0.5 text-[0.85em] text-gray-800" {...props}>{children}</code>;
  },
  pre: ({ children }) => (
    <pre dir="ltr" className="my-3 overflow-x-auto rounded-lg bg-gray-900 p-3 text-xs text-gray-100">{children}</pre>
  ),
};

export default function ReportMarkdown({ content, className }: ReportMarkdownProps) {
  const prepared = useMemo(() => (content ?? '').trim(), [content]);
  return (
    <div className={cn('report-markdown', className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeRaw, rehypeKatex]}
        components={components}
      >
        {prepared}
      </ReactMarkdown>
    </div>
  );
}
