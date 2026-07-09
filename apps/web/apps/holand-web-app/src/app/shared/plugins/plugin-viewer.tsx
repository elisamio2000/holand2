// ============================================
// PluginViewer — Universal plugin viewer component
// Displays standalone plugin UIs via iframe
// ============================================
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader } from 'rizzui';
import cn from '@core/utils/class-names';

export interface PluginViewerProps {
  /** Plugin ID (e.g., 'file.meta', 'image.ocr') */
  pluginId: string;
  
  /** Plugin result data to pass to the plugin UI */
  data?: any;
  
  /** Optional CSS class for container */
  className?: string;
  
  /** Height of the iframe (default: '800px') */
  height?: string;
}

/**
 * PluginViewer — Displays standalone plugin UIs in iframe.
 *
 * Loads plugin UI from /plugins/{pluginId}/index.html and passes
 * data via postMessage. The plugin UI should listen for 'pluginData' events.
 *
 * @param pluginId - Plugin identifier (matches public/plugins/ folder)
 * @param data - Plugin result data to display
 * @param height - Iframe height (default: 800px)
 * 
 * @example
 * ```tsx
 * <PluginViewer 
 *   pluginId="file.meta" 
 *   data={fileMetadata}
 *   height="900px"
 * />
 * ```
 * 
 * @version 0.29.0
 */
export default function PluginViewer({
  pluginId,
  data,
  className,
  height = '800px',
}: PluginViewerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [loading, setLoading] = useState(true);
  const [iframeReady, setIframeReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ==========================================
  // Helper: send data to plugin iframe
  // ==========================================

  const sendDataToPlugin = useCallback(
    (iframe: HTMLIFrameElement) => {
      if (!data || !iframe.contentWindow) return;
      console.info('[PluginViewer] Sending data to plugin:', {
        pluginId,
        dataKeys: Object.keys(data),
      });
      iframe.contentWindow.postMessage(
        { type: 'pluginData', pluginId, data },
        '*'
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pluginId, data]
  );

  // ==========================================
  // Listen for iframe load
  // ==========================================

  useEffect(() => {
    console.info('[PluginViewer] Initializing plugin:', { pluginId, hasData: !!data });

    const iframe = iframeRef.current;
    if (!iframe) return;

    const handleLoad = () => {
      console.info('[PluginViewer] Plugin iframe loaded:', { pluginId });
      setLoading(false);
      setIframeReady(true);
      // If data already available when iframe loads, send immediately
      sendDataToPlugin(iframe);
    };

    const handleError = () => {
      console.error('[PluginViewer] Failed to load plugin:', { pluginId });
      setError(`Failed to load plugin: ${pluginId}`);
      setLoading(false);
    };

    iframe.addEventListener('load', handleLoad);
    iframe.addEventListener('error', handleError);

    return () => {
      iframe.removeEventListener('load', handleLoad);
      iframe.removeEventListener('error', handleError);
    };
  // Only run once on mount (pluginId doesn't change per instance)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pluginId]);

  // ==========================================
  // Re-send when data changes after iframe ready
  // ==========================================

  useEffect(() => {
    if (!iframeReady) return;
    const iframe = iframeRef.current;
    if (!iframe) return;
    sendDataToPlugin(iframe);
  }, [iframeReady, sendDataToPlugin]);

  // ==========================================
  // Render
  // ==========================================

  const pluginUrl = `/plugins/${pluginId}/index.html`;

  return (
    <div className={cn('relative', className)}>
      {/* Loading overlay */}
      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-gray-0 dark:bg-gray-100">
          <Loader variant="spinner" size="xl" />
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-6 dark:border-red-800 dark:bg-red-950/30">
          <p className="text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Plugin iframe */}
      <iframe
        ref={iframeRef}
        src={pluginUrl}
        title={`Plugin: ${pluginId}`}
        className={cn(
          'w-full border-0',
          loading && 'invisible'
        )}
        style={{ height }}
        sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
      />
    </div>
  );
}
