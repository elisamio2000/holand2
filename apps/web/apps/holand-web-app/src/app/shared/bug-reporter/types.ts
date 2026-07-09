import type { eventWithTime } from '@rrweb/types';
import type { BugReportDeliveryChannel } from './config/bug-report-config';

export type { ErrorLogEntry } from './interceptors/error-interceptor';
export type { NetworkLogEntry } from './interceptors/network-interceptor';
export type { ClickLogEntry } from './interceptors/click-logger';
export type { NavigationLogEntry } from './interceptors/navigation-tracker';

/** Enriched click action with full element details */
export interface ClickAction {
  type: 'click';
  timestamp: number;
  target: string;
  selector?: string;
  testId?: string;
  role?: string;
  tagName?: string;
  href?: string;
  inputType?: string;
  coordinates?: { x: number; y: number };
  modifiers?: { ctrl?: boolean; shift?: boolean; alt?: boolean; meta?: boolean };
  /** IDs of API calls triggered by this click (within 500ms) */
  triggeredApiCalls?: string[];
}

/** Enriched API call with request/response details */
export interface ApiCallAction {
  type: 'api_call';
  timestamp: number;
  id: string;
  method: string;
  url: string;
  endpoint: string;
  status?: number;
  statusText?: string;
  duration?: number;
  requestBody?: string;
  responseBody?: string;
  responseHeaders?: Record<string, string>;
  error?: string;
  /** Timestamp of click that triggered this call (if any) */
  triggeredByClick?: number;
}

/** Error with full stack and context */
export interface ErrorAction {
  type: 'error';
  timestamp: number;
  message: string;
  stack?: string;
  source?: string;
  lineno?: number;
  colno?: number;
  /** Related API call ID (if error from network) */
  relatedApiCall?: string;
}

export type BugReportAction =
  | ClickAction
  | { type: 'navigation'; from: string; to: string; timestamp: number }
  | ErrorAction
  | ApiCallAction
  | { type: 'state_change'; component: string; change: string; timestamp: number }
  | { type: 'note'; text: string; timestamp: number }
  | { type: 'keyboard'; key: string; target?: string; modifiers?: string; timestamp: number }
  | { type: 'focus'; target: string; fieldType?: string; label?: string; timestamp: number }
  | { type: 'input'; target: string; label?: string; valueLength?: number; timestamp: number }
  | { type: 'scroll'; direction: string; scrollY: number; timestamp: number };

export type ConsoleLogEntry = {
  level: 'log' | 'warn' | 'error' | 'info' | 'debug';
  message: string;
  timestamp: number;
};

export type BugReportScreenshot = {
  timestamp: number;
  dataUrl: string;
  label?: string;
};

export interface BugReportTelemetrySnapshot {
  vitals?: import('./capture/telemetry-collector').WebVitalsData;
  longTasks?: import('./capture/telemetry-collector').LongTaskEntry[];
  preCapture?: boolean;
}

export type BugReportCaptureMode = 'manual' | 'rolling_buffer';

export interface BugReportSession {
  id: string;
  startTime: number;
  endTime?: number;
  actions: BugReportAction[];
  rrwebEvents: eventWithTime[];
  screenshots: BugReportScreenshot[];
  consoleLog: ConsoleLogEntry[];
  networkLog: import('./interceptors/network-interceptor').NetworkLogEntry[];
  errorLog: import('./interceptors/error-interceptor').ErrorLogEntry[];
  clickLog: import('./interceptors/click-logger').ClickLogEntry[];
  navigationLog: import('./interceptors/navigation-tracker').NavigationLogEntry[];
  videoBlob?: Blob;
  telemetry?: BugReportTelemetrySnapshot;
  captureMode: BugReportCaptureMode;
  bufferDuration: number;
  metadata: {
    userAgent: string;
    viewport: { width: number; height: number };
    url: string;
    pathname: string;
    userId?: string;
    userName?: string;
  };
}

export interface BugReportDeliveryMeta {
  channel: BugReportDeliveryChannel;
  recipientId: string;
  sentAt: number;
  messageId?: string;
}

export const BUG_REPORT_KIND = 'messages.bugReport' as const;

export interface BugReportPayload {
  kind: typeof BUG_REPORT_KIND;
  schemaVersion: 2;
  session: BugReportSession;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  delivery: BugReportDeliveryMeta;
}
