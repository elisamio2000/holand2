// ============================================
// Debug Logger — Detailed diagnostic logging for testing
// Enable/disable via localStorage: localStorage.setItem('DEBUG_CHAT', 'true')
// ============================================

/**
 * DebugLogger — Enhanced logging utility for testing chat features.
 *
 * Logs detailed information about:
 * - File upload flow (API calls, response shapes, thumbnail generation)
 * - Streaming events (thinking, tool_start, tool_end, trace_id)
 * - ThinkingSteps rendering (display steps, data sources)
 * - File preview (presigned URLs, blob fetching, auth headers)
 *
 * Enable in browser console: `localStorage.setItem('DEBUG_CHAT', 'true')`
 * Storage previews: `localStorage.setItem('DEBUG_STORAGE', 'true')`
 * Disable: `localStorage.removeItem('DEBUG_CHAT')`
 *
 * @example
 * ```ts
 * import { debugLog } from '@/utils/debug-logger';
 * debugLog.upload('File uploaded', { artifact });
 * ```
 */

const STYLE = {
  upload: 'color: #22c55e; font-weight: bold;',    // green
  stream: 'color: #3b82f6; font-weight: bold;',    // blue
  thinking: 'color: #a855f7; font-weight: bold;',  // purple
  tool: 'color: #f59e0b; font-weight: bold;',      // amber
  preview: 'color: #ec4899; font-weight: bold;',   // pink
  thumbnail: 'color: #06b6d4; font-weight: bold;',  // cyan
  trace: 'color: #ef4444; font-weight: bold;',     // red
  error: 'color: #ef4444; font-weight: bold; background: #fef2f2;', // red bg
};

function isEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    localStorage.getItem('DEBUG_CHAT') === 'true' ||
    localStorage.getItem('DEBUG_STORAGE') === 'true'
  );
}

function log(category: keyof typeof STYLE, label: string, ...args: unknown[]) {
  if (!isEnabled()) return;
  const style = STYLE[category];
  const timestamp = new Date().toISOString().split('T')[1].slice(0, 12);
  console.log(
    `%c[${timestamp}] [${category.toUpperCase()}] ${label}`,
    style,
    ...args
  );
}

function table(category: keyof typeof STYLE, label: string, data: Record<string, unknown>) {
  if (!isEnabled()) return;
  const style = STYLE[category];
  const timestamp = new Date().toISOString().split('T')[1].slice(0, 12);
  console.groupCollapsed(
    `%c[${timestamp}] [${category.toUpperCase()}] ${label}`,
    style
  );
  console.table(data);
  console.groupEnd();
}

export const debugLog = {
  /** File upload events */
  upload: (label: string, ...args: unknown[]) => log('upload', label, ...args),

  /** SSE streaming events */
  stream: (label: string, ...args: unknown[]) => log('stream', label, ...args),

  /** Thinking/reasoning events */
  thinking: (label: string, ...args: unknown[]) => log('thinking', label, ...args),

  /** Tool execution events */
  tool: (label: string, ...args: unknown[]) => log('tool', label, ...args),

  /** File preview events */
  preview: (label: string, ...args: unknown[]) => log('preview', label, ...args),

  /** Thumbnail events */
  thumbnail: (label: string, ...args: unknown[]) => log('thumbnail', label, ...args),

  /** Trace/planning events */
  trace: (label: string, ...args: unknown[]) => log('trace', label, ...args),

  /** Error events */
  error: (label: string, ...args: unknown[]) => log('error', label, ...args),

  /** Table display */
  table: (category: keyof typeof STYLE, label: string, data: Record<string, unknown>) =>
    table(category, label, data),

  /** Check if debug mode is enabled */
  isEnabled,

  /** Enable debug mode */
  enable: () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('DEBUG_CHAT', 'true');
      console.log(
        '%c[DEBUG] Chat debug logging ENABLED. Reload to see all logs.',
        'color: #22c55e; font-weight: bold; font-size: 14px;'
      );
    }
  },

  /** Disable debug mode */
  disable: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('DEBUG_CHAT');
      console.log(
        '%c[DEBUG] Chat debug logging DISABLED.',
        'color: #ef4444; font-weight: bold; font-size: 14px;'
      );
    }
  },
};

// Make available globally in browser for easy toggle
if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).__debugChat = debugLog;
}
