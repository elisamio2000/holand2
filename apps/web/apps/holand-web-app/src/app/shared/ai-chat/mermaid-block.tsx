// ============================================
// MermaidBlock — Renders Mermaid diagram syntax into SVG
// Supports flowcharts, sequence diagrams, gantt, pie, etc.
// ============================================

'use client';

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import mermaid from 'mermaid';
import { PiArrowsOutSimple, PiCopySimple, PiCheck, PiWarning } from 'react-icons/pi';
import cn from '@core/utils/class-names';
import type { CanvasContent } from '@/types/chat.types';
import { formatMermaidFenceForCopy } from '@/utils/markdown-fence-unwrap';
import { patchMermaidSvgLabels } from '@/utils/mermaid-svg-labels';
import { getMermaidChatInitOptions } from '@/app/shared/ai-chat/mermaid-render-config';
import {
  useInsideCanvasViewer,
  useMermaidBlockVariant,
  type MermaidBlockVariant,
} from '@/app/shared/ai-chat/mermaid-render-context';
import MermaidDiagramShell, {
  MermaidZoomToolbar,
  mermaidFitToWidth,
} from './mermaid-diagram-shell';

/** Unique ID counter for Mermaid diagrams */
let mermaidIdCounter = 0;

function subscribeDataTheme(cb: () => void) {
  if (typeof document === 'undefined') return () => {};
  const el = document.documentElement;
  const mo = new MutationObserver(cb);
  mo.observe(el, { attributes: true, attributeFilter: ['data-theme'] });
  return () => mo.disconnect();
}

function getDataThemeSnapshot() {
  if (typeof document === 'undefined') return 'light';
  return document.documentElement.getAttribute('data-theme') ?? 'light';
}

function getDataThemeServerSnapshot() {
  return 'light';
}

interface MermaidBlockProps {
  /** Raw Mermaid syntax string */
  children: string;
  /** Callback to open diagram in canvas panel */
  onOpenCanvas?: (content: CanvasContent) => void;
  /** Full assistant markdown for fence-accurate copy when the parent truncates */
  fullMarkdown?: string;
  /**
   * `embedded` — inside a markdown document: no chrome header / no canvas opener.
   * `standalone` — top-level fenced block in chat.
   */
  variant?: MermaidBlockVariant;
}

/** Remove temporary nodes Mermaid may leave on `document.body` for this render id. */
function cleanupMermaidDom(renderId: string) {
  document.getElementById(renderId)?.remove();
  document.querySelectorAll(`[id^="d${renderId}"]`).forEach((el) => el.remove());
}

/**
 * MermaidBlock — Renders Mermaid diagram syntax into interactive SVG.
 *
 * Uses the `mermaid` library (locally installed, no CDN) to parse
 * Mermaid syntax and render as inline SVG. Supports dark mode
 * via theme detection.
 *
 * Features:
 * - Pre-validates syntax with mermaid.parse() before rendering
 * - Unique render id per effect (avoids Strict Mode / concurrent races)
 * - Dark mode support (dark theme auto-detected)
 * - Error fallback (shows raw code on parse failure)
 * - Copy raw source button
 * - Open in canvas panel button
 *
 * @requires mermaid — local npm package for diagram rendering
 *
 * @example
 * ```tsx
 * <MermaidBlock onOpenCanvas={openCanvas}>
 *   {'graph TD\n  A --> B'}
 * </MermaidBlock>
 * ```
 */
export default function MermaidBlock({
  children,
  onOpenCanvas,
  fullMarkdown,
  variant: variantProp,
}: MermaidBlockProps) {
  const variant = useMermaidBlockVariant(variantProp);
  const isEmbedded = variant === 'embedded';
  const insideCanvasViewer = useInsideCanvasViewer();
  const showCanvasAction = Boolean(onOpenCanvas) && !insideCanvasViewer;
  const containerRef = useRef<HTMLDivElement>(null);
  const diagramScrollRef = useRef<HTMLDivElement>(null);
  const diagramInnerRef = useRef<HTMLDivElement>(null);
  const [svgContent, setSvgContent] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [diagramScale, setDiagramScale] = useState(1);

  const dataTheme = useSyncExternalStore(
    subscribeDataTheme,
    getDataThemeSnapshot,
    getDataThemeServerSnapshot
  );
  const isDark = dataTheme === 'dark';

  const diagramSource = useMemo(() => children.trim(), [children]);

  useEffect(() => {
    mermaid.initialize(getMermaidChatInitOptions(isDark));
  }, [isDark]);

  useEffect(() => {
    let cancelled = false;
    const renderId = `mermaid-${++mermaidIdCounter}`;

    const renderDiagram = async () => {
      const code = diagramSource;
      if (!code) {
        setSvgContent('');
        setError(null);
        return;
      }

      setSvgContent('');
      setError(null);

      try {
        await mermaid.parse(code);
      } catch (parseErr: unknown) {
        if (cancelled) return;
        const parseMsg =
          parseErr instanceof Error ? parseErr.message : 'Invalid Mermaid syntax';
        console.warn('[MermaidBlock] Syntax validation failed:', {
          id: renderId,
          error: parseMsg,
        });
        setError(parseMsg);
        setSvgContent('');
        return;
      }

      try {
        // Two-arg render: Mermaid appends to body internally; avoids races with a
        // caller-owned container removed while render is still finishing (Strict Mode).
        const { svg } = await mermaid.render(renderId, code);
        if (cancelled) return;
        setSvgContent(svg);
        setError(null);
        console.info('[MermaidBlock] Diagram rendered successfully:', {
          id: renderId,
        });
      } catch (err: unknown) {
        if (cancelled) return;
        const errorMsg =
          err instanceof Error ? err.message : 'Failed to render diagram';
        console.error('[MermaidBlock] Render failed:', {
          id: renderId,
          error: errorMsg,
        });
        setError(errorMsg);
        setSvgContent('');
      } finally {
        cleanupMermaidDom(renderId);
      }
    };

    void renderDiagram();

    return () => {
      cancelled = true;
      cleanupMermaidDom(renderId);
    };
  }, [diagramSource, isDark]);

  useEffect(() => {
    setDiagramScale(1);
  }, [svgContent]);

  useLayoutEffect(() => {
    if (!svgContent) return;
    const id = requestAnimationFrame(() => {
      patchMermaidSvgLabels(diagramInnerRef.current);
      mermaidFitToWidth(
        diagramScrollRef.current,
        diagramInnerRef.current,
        setDiagramScale
      );
    });
    return () => cancelAnimationFrame(id);
  }, [svgContent]);

  const handleCopy = useCallback(async () => {
    const text = formatMermaidFenceForCopy(diagramSource);
    console.info('[MermaidBlock] Copying Mermaid source');
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      console.error('[MermaidBlock] Failed to copy');
    }
  }, [diagramSource]);

  const handleOpenCanvas = useCallback(() => {
    if (onOpenCanvas) {
      onOpenCanvas({
        type: 'diagram',
        title: 'Mermaid Diagram',
        content: children,
        language: 'mermaid',
      });
    }
  }, [children, onOpenCanvas]);

  // Error state — show raw code with warning
  if (error) {
    return (
      <div
        className={cn(
          'overflow-hidden rounded-lg border border-orange-300 dark:border-orange-800',
          isEmbedded ? 'my-4' : 'my-3'
        )}
      >
        {/* Error header */}
        <div className="flex items-center gap-2 bg-orange-50 px-3 py-1.5 dark:bg-orange-950/30">
          <PiWarning className="h-4 w-4 text-orange-500" />
          <span className="text-xs font-medium text-orange-600 dark:text-orange-400">
            Diagram render failed
          </span>
        </div>
        {/* Raw code fallback */}
        <pre className="overflow-x-auto bg-gray-50 p-4 text-xs leading-relaxed text-gray-700 dark:bg-gray-100/70">
          <code>{children}</code>
        </pre>
      </div>
    );
  }

  const diagramBody = svgContent ? (
    <MermaidDiagramShell
      svgHtml={svgContent}
      scale={diagramScale}
      onScaleChange={setDiagramScale}
      scrollRef={diagramScrollRef}
      innerRef={diagramInnerRef}
      wheelZoom="off"
      shellVariant={isEmbedded ? 'embedded' : 'standalone'}
    />
  ) : (
    <div className="flex items-center gap-2 py-6 text-sm text-gray-400">
      <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-primary" />
      Rendering diagram...
    </div>
  );

  if (isEmbedded) {
    return (
      <figure className="group/diagram relative my-4 w-full">
        {svgContent ? (
          <div className="mb-1 flex flex-wrap items-center justify-end gap-0.5 opacity-100 sm:opacity-0 sm:group-hover/diagram:opacity-100">
            <MermaidZoomToolbar
              scale={diagramScale}
              onScaleChange={setDiagramScale}
              scrollRef={diagramScrollRef}
              innerRef={diagramInnerRef}
            />
            {showCanvasAction ? (
              <button
                type="button"
                onClick={handleOpenCanvas}
                className="rounded p-1 text-gray-500 transition-colors hover:bg-gray-200 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-200/30 dark:hover:text-gray-300"
                title="Open in canvas"
                aria-label="Open diagram in canvas panel"
              >
                <PiArrowsOutSimple className="h-3.5 w-3.5" />
              </button>
            ) : null}
            <button
              type="button"
              onClick={handleCopy}
              className="rounded p-1 text-gray-500 transition-colors hover:bg-gray-200 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-200/30 dark:hover:text-gray-300"
              title={copied ? 'Copied!' : 'Copy source'}
              aria-label={copied ? 'Copied' : 'Copy Mermaid source'}
            >
              {copied ? (
                <PiCheck className="h-3.5 w-3.5 text-green-500" />
              ) : (
                <PiCopySimple className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
        ) : null}
        <div
          ref={containerRef}
          className="overflow-hidden rounded-md border border-muted/50 bg-gray-0/80 dark:bg-gray-50/50 mermaid-diagram [&_svg]:mx-auto [&_svg]:max-w-full [&_svg]:h-auto [&_svg_text]:fill-gray-900 dark:[&_svg_text]:fill-gray-200"
        >
          {diagramBody}
        </div>
      </figure>
    );
  }

  return (
    <div className="group relative my-3 overflow-hidden rounded-xl border border-muted/80 bg-gray-0 shadow-sm ring-1 ring-black/[0.03] dark:bg-gray-50/30 dark:ring-white/[0.06]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-muted/60 bg-muted/30 px-3 py-1.5 dark:bg-muted/15">
        <span className="text-xs font-medium text-muted-foreground">mermaid</span>
        <div className="flex flex-wrap items-center justify-end gap-1">
          {svgContent ? (
            <MermaidZoomToolbar
              scale={diagramScale}
              onScaleChange={setDiagramScale}
              scrollRef={diagramScrollRef}
              innerRef={diagramInnerRef}
            />
          ) : null}
          {showCanvasAction ? (
            <button
              type="button"
              onClick={handleOpenCanvas}
              className="rounded p-1 text-gray-500 transition-colors hover:bg-gray-200 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-200/30 dark:hover:text-gray-300"
              title="Open in canvas"
              aria-label="Open diagram in canvas panel"
            >
              <PiArrowsOutSimple className="h-3.5 w-3.5" />
            </button>
          ) : null}
          <button
            type="button"
            onClick={handleCopy}
            className="rounded p-1 text-gray-500 transition-colors hover:bg-gray-200 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-200/30 dark:hover:text-gray-300"
            title={copied ? 'Copied!' : 'Copy source'}
            aria-label={copied ? 'Copied' : 'Copy Mermaid source'}
          >
            {copied ? (
              <PiCheck className="h-3.5 w-3.5 text-green-500" />
            ) : (
              <PiCopySimple className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      </div>

      <div
        ref={containerRef}
        className={cn(
          'bg-gray-0 dark:bg-gray-50 mermaid-diagram',
          '[&_svg]:max-w-full [&_svg]:h-auto [&_svg]:drop-shadow-sm [&_svg_text]:fill-gray-900 dark:[&_svg_text]:fill-gray-200'
        )}
      >
        {diagramBody}
      </div>
    </div>
  );
}
