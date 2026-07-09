// ============================================
// CanvasPanel — Side panel for code, tables, charts, JSON, PDF display
// Expandable panel for viewing content in a larger format
// ============================================

'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  PiX,
  PiCopySimple,
  PiCheck,
  PiCode,
  PiTable,
  PiChartBar,
  PiFilePdf,
  PiBracketsCurly,
  PiArticle,
  PiWarning,
  PiListNumbers,
} from 'react-icons/pi';
import { useTranslation } from 'react-i18next';
import dynamic from 'next/dynamic';
import DOMPurify, { Config } from 'dompurify';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import cn from '@core/utils/class-names';
import { useTheme } from 'next-themes';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/cjs/styles/prism';
import { getMermaidChatInitOptions } from '@/app/shared/ai-chat/mermaid-render-config';
import JsonViewer from './json-viewer';
import MarkdownRenderer from './markdown-renderer';
import {
  formatMermaidFenceForCopy,
  normalizeAssistantMessageForCopy,
  prepareMarkdownForRender,
} from '@/utils/markdown-fence-unwrap';
import { patchMermaidSvgLabels } from '@/utils/mermaid-svg-labels';
import MermaidDiagramShell, {
  MermaidZoomToolbar,
} from './mermaid-diagram-shell';
import type { CanvasContent } from '@/types/chat.types';

// WHY: react-pdf / pdfjs-dist must be loaded dynamically (ssr: false) because
// pdfjs-dist v5 ESM is incompatible with Next.js 14 webpack bundling at load time.
const PdfViewer = dynamic(() => import('./pdf-viewer'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center py-10 text-sm text-gray-500">Loading PDF viewer...</div>
  ),
});

// Mermaid — diagram rendering in canvas
import mermaidLib from 'mermaid';
/** Unique counter for canvas Mermaid render ids (fresh id each effect — Strict Mode safe). */
let canvasMermaidId = 0;

function cleanupCanvasMermaidDom(renderId: string) {
  const staleEl = document.getElementById(renderId);
  if (staleEl) staleEl.remove();
  document.querySelectorAll(`[id^="d${renderId}"]`).forEach((el) => el.remove());
}

const CHART_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#14b8a6', '#f97316', '#06b6d4', '#84cc16',
];

/** Sanitize AI/table HTML for canvas — allow table structure + bidi attrs, no `style`/`on*`. */
const CANVAS_HTML_PURIFY: Config = {
  ALLOWED_TAGS: [
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'br', 'hr',
    'ul', 'ol', 'li', 'a', 'strong', 'em', 'b', 'i', 'u',
    'code', 'pre', 'blockquote',
    'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td',
    'caption', 'colgroup', 'col',
    'span', 'div', 'img', 'sup', 'sub', 'del', 'ins', 'abbr', 'mark', 'small',
  ],
  ALLOWED_ATTR: [
    'href', 'src', 'alt', 'title', 'class', 'target', 'rel', 'id',
    'colspan', 'rowspan', 'scope', 'headers', 'abbr',
    'width', 'height', 'dir', 'lang', 'span', 'align', 'valign', 'role',
  ],
};

/** Shared typography for markdown + sanitized HTML in the canvas body. */
const CANVAS_PROSE_BODY = cn(
  'prose prose-sm max-w-none dark:prose-invert prose-headings:scroll-mt-4',
  'font-vazirmatn text-start leading-relaxed text-gray-900 dark:text-gray-200',
  'prose-p:my-2 prose-headings:font-semibold prose-li:my-0.5',
  'prose-a:text-primary prose-strong:text-inherit',
  '[&_table]:my-3 [&_table]:w-full [&_table]:table-auto [&_table]:border-collapse [&_table]:text-sm',
  '[&_caption]:mb-2 [&_caption]:text-sm [&_caption]:font-medium [&_caption]:text-gray-600 dark:[&_caption]:text-gray-400',
  '[&_thead]:bg-gray-50 dark:[&_thead]:bg-gray-100/80',
  '[&_th]:border [&_th]:border-muted [&_th]:px-2.5 [&_th]:py-2 [&_th]:align-middle [&_th]:font-semibold [&_th]:text-gray-800 dark:[&_th]:text-gray-200',
  '[&_td]:border [&_td]:border-muted [&_td]:px-2.5 [&_td]:py-2 [&_td]:align-middle [&_td]:text-gray-800 dark:[&_td]:text-gray-200',
  '[&_code]:rounded [&_code]:bg-gray-100 [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[0.85em] dark:[&_code]:bg-gray-200/40',
  '[&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:border [&_pre]:border-muted [&_pre]:bg-gray-50 [&_pre]:p-3 dark:[&_pre]:bg-gray-100/50',
  '[&_blockquote]:border-s-primary/40 [&_blockquote]:text-gray-600 dark:[&_blockquote]:text-gray-400'
);

/** Fenced code tagged as markdown should render as markdown in canvas, not as highlighted code text. */
function isMarkdownFenceLanguage(lang?: string | null): boolean {
  if (!lang) return false;
  const l = lang.toLowerCase();
  return l === 'markdown' || l === 'md' || l === 'gfm' || l === 'commonmark' || l === 'mdx';
}

/** Map fence language to Prism grammar (align with CodeBlock / react-syntax-highlighter). */
function prismLanguageForCanvas(lang?: string | null): string {
  if (!lang) return 'text';
  const l = lang.toLowerCase();
  if (l === 'html' || l === 'htm' || l === 'vue' || l === 'svg') return 'markup';
  return l;
}

interface CanvasPanelProps {
  /** Content to display */
  content: CanvasContent;
  /** Close panel callback */
  onClose: () => void;
  /** Push nested canvas (e.g. mermaid inside markdown modal) */
  onOpenCanvas?: (content: CanvasContent) => void;
  /** `split` fills parent width (resizable chat layout); `sidebar` keeps narrow dock width */
  variant?: 'sidebar' | 'split';
}

/**
 * CanvasPanel — Side panel for viewing code, tables, charts, JSON, PDF in full size.
 *
 * Features:
 * - Code with syntax highlighting
 * - Full-width table rendering
 * - Interactive charts (Recharts)
 * - Collapsible JSON tree viewer
 * - PDF document viewer with pagination
 * - Mermaid diagrams
 * - Copy content button
 * - Smooth slide-in animation
 *
 * @example
 * ```tsx
 * {canvasContent && (
 *   <CanvasPanel content={canvasContent} onClose={closeCanvas} />
 * )}
 * ```
 */
export default function CanvasPanel({
  content,
  onClose,
  onOpenCanvas,
  variant = 'sidebar',
}: CanvasPanelProps) {
  const { t } = useTranslation();
  const { resolvedTheme } = useTheme();
  const isDarkSyntaxTheme = resolvedTheme === 'dark';
  const [copied, setCopied] = useState(false);
  const [showLineNumbers, setShowLineNumbers] = useState(true);
  const [mermaidSvg, setMermaidSvg] = useState<string>('');
  const [mermaidError, setMermaidError] = useState<string | null>(null);
  const [diagramScale, setDiagramScale] = useState(1);
  const diagramScrollRef = useRef<HTMLDivElement>(null);
  const diagramInnerRef = useRef<HTMLDivElement>(null);

  const treatAsMarkdown =
    content.type === 'markdown' ||
    (content.type === 'code' && isMarkdownFenceLanguage(content.language));

  const markdownBody = useMemo(
    () => (treatAsMarkdown ? prepareMarkdownForRender(content.content) : content.content),
    [treatAsMarkdown, content.content]
  );

  const isPrismCodeBlock = content.type === 'code' && !treatAsMarkdown;

  useEffect(() => {
    if (isPrismCodeBlock) setShowLineNumbers(true);
  }, [isPrismCodeBlock, content.content, content.language]);

  const handleCopy = useCallback(async () => {
    console.info('[CanvasPanel] Copying content');
    try {
      let text = content.content;
      if (treatAsMarkdown) {
        text = normalizeAssistantMessageForCopy(content.content);
      } else if (content.type === 'diagram') {
        text = formatMermaidFenceForCopy(content.content);
      }
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      console.error('[CanvasPanel] Failed to copy');
    }
  }, [content.content, content.type, treatAsMarkdown]);

  // Render Mermaid locally (parse + two-arg render; unique id per effect for Strict Mode).
  useEffect(() => {
    if (content.type !== 'diagram' || !content.content.trim()) {
      setMermaidSvg('');
      setMermaidError(null);
      return;
    }

    let cancelled = false;
    const code = content.content.trim();
    const renderId = `canvas-mermaid-${++canvasMermaidId}`;

    const run = async () => {
      setMermaidSvg('');
      setMermaidError(null);

      try {
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        mermaidLib.initialize(getMermaidChatInitOptions(isDark));

        try {
          await mermaidLib.parse(code);
        } catch (parseErr: unknown) {
          if (cancelled) return;
          const parseMsg =
            parseErr instanceof Error ? parseErr.message : 'Invalid Mermaid syntax';
          setMermaidError(parseMsg);
          return;
        }

        try {
          const { svg } = await mermaidLib.render(renderId, code);
          if (cancelled) return;
          setMermaidSvg(svg);
          setMermaidError(null);
          console.info('[CanvasPanel] Mermaid diagram rendered in canvas');
        } catch (err: unknown) {
          if (cancelled) return;
          const msg = err instanceof Error ? err.message : 'Failed to render diagram';
          setMermaidError(msg);
          setMermaidSvg('');
          console.error('[CanvasPanel] Mermaid render failed:', err);
        } finally {
          cleanupCanvasMermaidDom(renderId);
        }
      } catch (err: unknown) {
        if (cancelled) return;
        setMermaidError(err instanceof Error ? err.message : 'Mermaid error');
        setMermaidSvg('');
      }
    };

    void run();

    return () => {
      cancelled = true;
      cleanupCanvasMermaidDom(renderId);
    };
  }, [content.content, content.type]);

  useEffect(() => {
    setDiagramScale(1);
  }, [mermaidSvg, content.type]);

  useLayoutEffect(() => {
    if (content.type !== 'diagram' || !mermaidSvg) return;
    patchMermaidSvgLabels(diagramInnerRef.current);
  }, [mermaidSvg, content.type]);

  // Sanitize HTML / legacy table-as-HTML for XSS-safe canvas display.
  const sanitizedRichHtml = useMemo(() => {
    const raw = content.content;
    const asTableHtml =
      content.type === 'table' && raw.trimStart().startsWith('<');
    if (content.type !== 'html' && !asTableHtml) return '';
    return DOMPurify.sanitize(raw, CANVAS_HTML_PURIFY);
  }, [content.content, content.type]);

  const htmlSanitizeMissed =
    (content.type === 'html' ||
      (content.type === 'table' && content.content.trimStart().startsWith('<'))) &&
    Boolean(content.content.trim()) &&
    !sanitizedRichHtml;

  // Parse chart data from various formats
  const chartData = useMemo(() => {
    if (content.type !== 'chart') return [];
    console.info('[CanvasPanel] Parsing chart data');
    
    try {
      // If chartData is provided, use it
      if (content.chartData) {
        if (Array.isArray(content.chartData)) {
          return content.chartData as Array<Record<string, unknown>>;
        }
        // Try parsing string as JSON
        if (typeof content.chartData === 'string') {
          return JSON.parse(content.chartData) as Array<Record<string, unknown>>;
        }
      }
      
      // Try parsing content as JSON
      return JSON.parse(content.content) as Array<Record<string, unknown>>;
    } catch {
      console.warn('[CanvasPanel] Failed to parse chart data, using empty array');
      return [];
    }
  }, [content.chartData, content.content, content.type]);

  const getIcon = () => {
    switch (content.type) {
      case 'markdown':
        return <PiArticle className="h-4 w-4" />;
      case 'code':
        return treatAsMarkdown ? (
          <PiArticle className="h-4 w-4" />
        ) : (
          <PiCode className="h-4 w-4" />
        );
      case 'table':
        return <PiTable className="h-4 w-4" />;
      case 'chart':
      case 'diagram':
        return <PiChartBar className="h-4 w-4" />;
      case 'html':
        return <PiArticle className="h-4 w-4" />;
      case 'json':
        return <PiBracketsCurly className="h-4 w-4" />;
      case 'pdf':
        return <PiFilePdf className="h-4 w-4" />;
      default:
        return <PiCode className="h-4 w-4" />;
    }
  };

  return (
    <div
      className={cn(
        'flex h-full min-h-0 shrink-0 animate-chat-scale-in flex-col overflow-hidden rounded-lg border border-muted bg-gray-0 shadow-sm dark:bg-gray-50',
        variant === 'split'
          ? 'h-full min-h-0 w-full min-w-0 max-w-none flex-1'
          : 'w-full min-w-0 max-lg:max-w-full lg:w-[270px] 2xl:w-72'
      )}
    >
      {/* Header — aligned with right rail tab row density */}
      <div className="flex flex-shrink-0 items-center justify-between border-b border-muted px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex-shrink-0 text-gray-500">{getIcon()}</span>
          <h3 className="truncate text-sm font-medium text-gray-900 dark:text-gray-700">
            {content.title}
          </h3>
          {content.language && !treatAsMarkdown && (
            <span className="flex-shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-500 dark:bg-gray-200/30">
              {content.language}
            </span>
          )}
          {treatAsMarkdown && (
            <span className="flex-shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-500 dark:bg-gray-200/30">
              markdown
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-1">
          {content.type === 'diagram' && mermaidSvg && !mermaidError ? (
            <MermaidZoomToolbar
              scale={diagramScale}
              onScaleChange={setDiagramScale}
              scrollRef={diagramScrollRef}
              innerRef={diagramInnerRef}
            />
          ) : null}
          {isPrismCodeBlock ? (
            <button
              type="button"
              onClick={() => setShowLineNumbers((v) => !v)}
              className={cn(
                'rounded p-1 text-gray-500 transition-colors hover:bg-gray-200 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-200/30 dark:hover:text-gray-300',
                showLineNumbers && 'text-primary'
              )}
              title={
                showLineNumbers
                  ? t('codeBlock.hideLineNumbers')
                  : t('codeBlock.showLineNumbers')
              }
              aria-label={
                showLineNumbers
                  ? t('codeBlock.hideLineNumbers')
                  : t('codeBlock.showLineNumbers')
              }
              aria-pressed={showLineNumbers}
            >
              <PiListNumbers className="h-3.5 w-3.5" />
            </button>
          ) : null}
          <button
            onClick={handleCopy}
            className="rounded p-1.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-200/20 dark:hover:text-gray-300"
            aria-label={copied ? 'Copied' : 'Copy content'}
            title={copied ? 'Copied!' : 'Copy'}
          >
            {copied ? (
              <PiCheck className="h-4 w-4 text-green-500" />
            ) : (
              <PiCopySimple className="h-4 w-4" />
            )}
          </button>
          <button
            onClick={onClose}
            className="rounded p-1.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-200/20 dark:hover:text-gray-300"
            aria-label="Close canvas panel"
            title="Close"
          >
            <PiX className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Body — bounded flex child + both axes scroll so long code / wide lines are reachable in modal & split rail. */}
      <div className="custom-scrollbar scrollbar-no-auto-hide min-h-0 flex-1 overflow-y-auto overflow-x-auto overscroll-contain">
        <div className="min-w-0 p-3">
          {treatAsMarkdown && (
            <div className={CANVAS_PROSE_BODY}>
              <MarkdownRenderer
                content={markdownBody}
                fullSource={markdownBody}
                onOpenCanvas={onOpenCanvas}
              />
            </div>
          )}

          {content.type === 'code' && !treatAsMarkdown && (
            <div className="min-w-0 overflow-x-auto rounded-lg bg-gray-50 dark:bg-gray-100" dir="ltr">
              <SyntaxHighlighter
                language={prismLanguageForCanvas(content.language)}
                style={isDarkSyntaxTheme ? oneDark : oneLight}
                showLineNumbers={showLineNumbers}
                wrapLongLines
                customStyle={{
                  margin: 0,
                  borderRadius: '0.5rem',
                  fontSize: '0.75rem',
                  lineHeight: 1.55,
                  padding: '0.75rem',
                  maxWidth: '100%',
                  background: 'transparent',
                }}
                lineNumberStyle={{
                  minWidth: '2.5em',
                  paddingRight: '1em',
                  userSelect: 'none',
                }}
              >
                {content.content}
              </SyntaxHighlighter>
            </div>
          )}

          {content.type === 'table' && !sanitizedRichHtml && (
            <div className="overflow-x-auto rounded-lg border border-muted bg-gray-50 p-3 dark:bg-gray-100/50">
              <pre className="whitespace-pre-wrap font-vazirmatn text-sm leading-relaxed text-gray-800 dark:text-gray-200">
                {content.content}
              </pre>
            </div>
          )}

          {content.type === 'diagram' && (
            <div className="w-full bg-gray-0 dark:bg-gray-50">
              {mermaidError ? (
                <div className="w-full space-y-3 p-2">
                  <div className="flex items-start gap-2 rounded-lg border border-orange-300 bg-orange-50 px-3 py-2 text-xs text-orange-800 dark:border-orange-800 dark:bg-orange-950/30 dark:text-orange-300">
                    <PiWarning className="mt-0.5 h-4 w-4 shrink-0 text-orange-500" />
                    <span className="min-w-0 break-words">{mermaidError}</span>
                  </div>
                  <pre className="overflow-x-auto rounded-lg border border-muted bg-gray-50 p-3 font-mono text-xs leading-relaxed text-gray-800 dark:bg-gray-100/70 dark:text-gray-200">
                    <code>{content.content}</code>
                  </pre>
                </div>
              ) : mermaidSvg ? (
                <MermaidDiagramShell
                  svgHtml={mermaidSvg}
                  scale={diagramScale}
                  onScaleChange={setDiagramScale}
                  scrollRef={diagramScrollRef}
                  innerRef={diagramInnerRef}
                  wheelZoom="on"
                />
              ) : (
                <div className="flex items-center gap-2 px-2 py-6 text-sm text-gray-400">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-primary" />
                  Rendering diagram...
                </div>
              )}
            </div>
          )}

          {content.type === 'chart' && (
            <div className="min-h-[400px]">
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={400}>
                  {(() => {
                    const chartType = content.chartType || 'bar';
                    const dataKeys = chartData.length > 0 
                      ? Object.keys(chartData[0] as Record<string, unknown>).filter(k => k !== 'name' && k !== 'label')
                      : [];
                    
                    switch (chartType) {
                      case 'line':
                        return (
                          <LineChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" />
                            <YAxis />
                            <RechartsTooltip />
                            <Legend />
                            {dataKeys.map((key, idx) => (
                              <Line
                                key={key}
                                type="monotone"
                                dataKey={key}
                                stroke={CHART_COLORS[idx % CHART_COLORS.length]}
                                strokeWidth={2}
                              />
                            ))}
                          </LineChart>
                        );
                      
                      case 'area':
                        return (
                          <AreaChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" />
                            <YAxis />
                            <RechartsTooltip />
                            <Legend />
                            {dataKeys.map((key, idx) => (
                              <Area
                                key={key}
                                type="monotone"
                                dataKey={key}
                                stackId="1"
                                stroke={CHART_COLORS[idx % CHART_COLORS.length]}
                                fill={CHART_COLORS[idx % CHART_COLORS.length]}
                                fillOpacity={0.6}
                              />
                            ))}
                          </AreaChart>
                        );
                      
                      case 'pie':
                        return (
                          <PieChart>
                            <Pie
                              data={chartData}
                              dataKey={dataKeys[0] || 'value'}
                              nameKey="name"
                              cx="50%"
                              cy="50%"
                              outerRadius={120}
                              label
                            >
                              {chartData.map((_, idx) => (
                                <Cell key={`cell-${idx}`} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                              ))}
                            </Pie>
                            <RechartsTooltip />
                            <Legend />
                          </PieChart>
                        );
                      
                      default: // bar
                        return (
                          <BarChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" />
                            <YAxis />
                            <RechartsTooltip />
                            <Legend />
                            {dataKeys.map((key, idx) => (
                              <Bar
                                key={key}
                                dataKey={key}
                                fill={CHART_COLORS[idx % CHART_COLORS.length]}
                              />
                            ))}
                          </BarChart>
                        );
                    }
                  })()}
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center py-10">
                  <p className="text-sm text-gray-400">No chart data available</p>
                </div>
              )}
            </div>
          )}

          {content.type === 'json' && (
            <JsonViewer data={content.content} />
          )}

          {content.type === 'pdf' && (
            <PdfViewer file={content.content} />
          )}

          {sanitizedRichHtml && (
            <div
              className={CANVAS_PROSE_BODY}
              dangerouslySetInnerHTML={{ __html: sanitizedRichHtml }}
            />
          )}

          {htmlSanitizeMissed && (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Nothing safe to display for this markup (empty after sanitization).
            </p>
          )}
        </div>
      </div>
    </div>
  );
}