export interface ErrorLogEntry {
  level: 'error' | 'warn';
  message: string;
  stack?: string;
  filename?: string;
  lineno?: number;
  colno?: number;
  timestamp: number;
  componentStack?: string;
}

export type ErrorCallback = (error: ErrorLogEntry) => void;

let originalErrorHandler: OnErrorEventHandler | null = null;
let originalUnhandledRejectionHandler: ((event: PromiseRejectionEvent) => void) | null = null;

export function startErrorInterception(onError: ErrorCallback): () => void {
  originalErrorHandler = window.onerror;
  originalUnhandledRejectionHandler = window.onunhandledrejection;

  window.onerror = (message, source, lineno, colno, error) => {
    const errorEntry: ErrorLogEntry = {
      level: 'error',
      message: typeof message === 'string' ? message : String(message),
      stack: error?.stack,
      filename: source,
      lineno,
      colno,
      timestamp: Date.now(),
    };
    onError(errorEntry);

    if (originalErrorHandler) {
      originalErrorHandler.call(window, message, source, lineno, colno, error);
    }
    return false;
  };

  window.onunhandledrejection = (event: PromiseRejectionEvent) => {
    const errorEntry: ErrorLogEntry = {
      level: 'error',
      message: event.reason?.message || String(event.reason),
      stack: event.reason?.stack,
      timestamp: Date.now(),
    };
    onError(errorEntry);

    if (originalUnhandledRejectionHandler) {
      originalUnhandledRejectionHandler.call(window, event);
    }
  };

  return () => {
    window.onerror = originalErrorHandler;
    window.onunhandledrejection = originalUnhandledRejectionHandler;
    originalErrorHandler = null;
    originalUnhandledRejectionHandler = null;
  };
}
