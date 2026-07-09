// ============================================
// MarkdownErrorBoundary — Error boundary for markdown rendering
// Prevents markdown parsing errors from crashing the entire chat
// ============================================

'use client';

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { PiWarningCircle, PiArrowClockwise } from 'react-icons/pi';

interface Props {
  /** Content to render inside the boundary */
  children: ReactNode;
  /** Raw content to display as fallback if parsing fails */
  fallbackContent?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * MarkdownErrorBoundary — Catches errors in markdown rendering.
 *
 * If markdown parsing or rendering fails (e.g., malformed content),
 * displays the raw content as plain text instead of crashing.
 *
 * @example
 * ```tsx
 * <MarkdownErrorBoundary fallbackContent={rawMarkdown}>
 *   <MarkdownRenderer content={rawMarkdown} />
 * </MarkdownErrorBoundary>
 * ```
 */
export default class MarkdownErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    console.error('[MarkdownErrorBoundary] Caught error:', error);
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('[MarkdownErrorBoundary] Error details:', {
      error: error.message,
      componentStack: errorInfo.componentStack,
    });
  }

  handleRetry = (): void => {
    console.info('[MarkdownErrorBoundary] Retrying render');
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="rounded-lg border border-orange-200 bg-orange-50 p-3 dark:border-orange-800/30 dark:bg-orange-950/20">
          {/* Error header */}
          <div className="mb-2 flex items-center gap-2 text-sm text-orange-600 dark:text-orange-400">
            <PiWarningCircle className="h-4 w-4 flex-shrink-0" />
            <span className="font-medium">Failed to render formatted content</span>
            <button
              onClick={this.handleRetry}
              className="ms-auto flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium text-orange-600 transition-colors hover:bg-orange-100 dark:text-orange-400 dark:hover:bg-orange-900/30"
            >
              <PiArrowClockwise className="h-3 w-3" />
              Retry
            </button>
          </div>
          {/* Fallback: show raw content as plain text */}
          {this.props.fallbackContent && (
            <pre
              className="whitespace-pre-wrap text-sm text-gray-700"
              dir="auto"
            >
              {this.props.fallbackContent}
            </pre>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
