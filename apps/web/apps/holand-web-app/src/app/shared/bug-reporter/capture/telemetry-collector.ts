'use client';

import type { eventWithTime } from 'rrweb/typings/types';
import { RollingBuffer } from './rolling-buffer';
import type { ErrorLogEntry } from '../interceptors/error-interceptor';
import type { NetworkLogEntry } from '../interceptors/network-interceptor';
import type { ClickLogEntry } from '../interceptors/click-logger';
import type { NavigationLogEntry } from '../interceptors/navigation-tracker';
import type { KeyboardLogEntry, FocusLogEntry, InputChangeLogEntry, ScrollLogEntry } from '../interceptors/interaction-logger';

export interface WebVitalsData {
  cls?: number;
  lcp?: number;
  fid?: number;
  inp?: number;
  ttfb?: number;
}

export interface LongTaskEntry {
  duration: number;
  startTime: number;
  timestamp: number;
}

export interface BugReportTelemetry {
  events: eventWithTime[];
  network: NetworkLogEntry[];
  errors: ErrorLogEntry[];
  clicks: ClickLogEntry[];
  navigationLog: NavigationLogEntry[];
  consoleLog: { level: string; message: string; timestamp: number }[];
  keyboard: KeyboardLogEntry[];
  focus: FocusLogEntry[];
  inputChanges: InputChangeLogEntry[];
  scroll: ScrollLogEntry[];
  vitals: WebVitalsData;
  longTasks: LongTaskEntry[];
}

let globalCollector: TelemetryCollector | null = null;

export class TelemetryCollector {
  private buffer: RollingBuffer;
  private vitals: WebVitalsData = {};
  private longTasks: LongTaskEntry[] = [];
  private longTaskObserver: PerformanceObserver | null = null;
  private vitalsLoaded = false;

  private keyboardLog: KeyboardLogEntry[] = [];
  private focusLog: FocusLogEntry[] = [];
  private inputChangeLog: InputChangeLogEntry[] = [];
  private scrollLog: ScrollLogEntry[] = [];
  private sessionStartTime = 0;

  constructor(bufferSeconds = 30, enabled = true) {
    this.buffer = new RollingBuffer(bufferSeconds, enabled);
  }

  setEnabled(enabled: boolean): void {
    this.buffer.setEnabled(enabled);
    if (!enabled) {
      this.keyboardLog = [];
      this.focusLog = [];
      this.inputChangeLog = [];
      this.scrollLog = [];
    }
  }

  resetSession(startTime: number): void {
    this.sessionStartTime = startTime;
    this.keyboardLog = [];
    this.focusLog = [];
    this.inputChangeLog = [];
    this.scrollLog = [];
    this.buffer.clear();
  }

  start(): void {
    this.loadWebVitals();
    this.observeLongTasks();
  }

  stop(): void {
    this.longTaskObserver?.disconnect();
    this.longTaskObserver = null;
  }

  addRrwebEvent(event: eventWithTime): void {
    this.buffer.addRrwebEvent(event);
  }

  addError(error: ErrorLogEntry): void {
    this.buffer.addError(error);
  }

  addNetworkLog(log: NetworkLogEntry): void {
    this.buffer.addNetworkLog(log);
  }

  addClick(click: ClickLogEntry): void {
    this.buffer.addClick(click);
  }

  addNavigation(entry: NavigationLogEntry): void {
    this.buffer.addNavigation(entry);
  }

  addConsoleLog(entry: { level: string; message: string; timestamp: number }): void {
    this.buffer.addConsoleLog(entry);
  }

  addKeyboard(entry: KeyboardLogEntry): void {
    if (!this.buffer.isEnabled()) return;
    this.keyboardLog.push(entry);
    if (this.keyboardLog.length > 2000) this.keyboardLog = this.keyboardLog.slice(-2000);
  }

  addFocus(entry: FocusLogEntry): void {
    if (!this.buffer.isEnabled()) return;
    this.focusLog.push(entry);
    if (this.focusLog.length > 500) this.focusLog = this.focusLog.slice(-500);
  }

  addInputChange(entry: InputChangeLogEntry): void {
    if (!this.buffer.isEnabled()) return;
    this.inputChangeLog.push(entry);
    if (this.inputChangeLog.length > 500) this.inputChangeLog = this.inputChangeLog.slice(-500);
  }

  addScroll(entry: ScrollLogEntry): void {
    if (!this.buffer.isEnabled()) return;
    this.scrollLog.push(entry);
    if (this.scrollLog.length > 200) this.scrollLog = this.scrollLog.slice(-200);
  }

  private filterByStart<T extends { timestamp: number }>(arr: T[], startTime: number): T[] {
    return startTime > 0 ? arr.filter((e) => e.timestamp >= startTime) : arr;
  }

  getSnapshot(seconds?: number): BugReportTelemetry {
    const buffered = this.buffer.getLastNSeconds(seconds);
    return {
      events: buffered.rrwebEvents,
      network: buffered.networkLogs,
      errors: buffered.errors,
      clicks: buffered.clicks,
      navigationLog: buffered.navigationLog,
      consoleLog: buffered.consoleLog,
      keyboard: [...this.filterByStart(this.keyboardLog, this.sessionStartTime)],
      focus: [...this.filterByStart(this.focusLog, this.sessionStartTime)],
      inputChanges: [...this.filterByStart(this.inputChangeLog, this.sessionStartTime)],
      scroll: [...this.filterByStart(this.scrollLog, this.sessionStartTime)],
      vitals: { ...this.vitals },
      longTasks: [...this.longTasks],
    };
  }

  getPreCaptureSnapshot(seconds = 30): BugReportTelemetry {
    return this.getSnapshot(seconds);
  }

  getSessionSince(startTime: number): BugReportTelemetry {
    const buffered = this.buffer.getSessionSince(startTime);
    return {
      events: buffered.rrwebEvents,
      network: buffered.networkLogs,
      errors: buffered.errors,
      clicks: buffered.clicks,
      navigationLog: buffered.navigationLog,
      consoleLog: buffered.consoleLog,
      keyboard: [...this.filterByStart(this.keyboardLog, startTime)],
      focus: [...this.filterByStart(this.focusLog, startTime)],
      inputChanges: [...this.filterByStart(this.inputChangeLog, startTime)],
      scroll: [...this.filterByStart(this.scrollLog, startTime)],
      vitals: { ...this.vitals },
      longTasks: [...this.longTasks],
    };
  }

  private async loadWebVitals(): Promise<void> {
    if (this.vitalsLoaded || typeof window === 'undefined') return;
    this.vitalsLoaded = true;

    try {
      const webVitals = await import('web-vitals');
      webVitals.onCLS((metric) => {
        this.vitals.cls = metric.value;
      });
      webVitals.onLCP((metric) => {
        this.vitals.lcp = metric.value;
      });
      if ('onFID' in webVitals && typeof webVitals.onFID === 'function') {
        webVitals.onFID((metric: { value: number }) => {
          this.vitals.fid = metric.value;
        });
      }
      if ('onINP' in webVitals && typeof webVitals.onINP === 'function') {
        webVitals.onINP((metric) => {
          this.vitals.inp = metric.value;
        });
      }
      webVitals.onTTFB((metric) => {
        this.vitals.ttfb = metric.value;
      });
    } catch {
      /* web-vitals optional */
    }
  }

  private observeLongTasks(): void {
    if (typeof PerformanceObserver === 'undefined') return;

    try {
      this.longTaskObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          this.longTasks.push({
            duration: entry.duration,
            startTime: entry.startTime,
            timestamp: Date.now(),
          });
          if (this.longTasks.length > 50) {
            this.longTasks = this.longTasks.slice(-50);
          }
        }
      });
      this.longTaskObserver.observe({ entryTypes: ['longtask'] });
    } catch {
      /* longtask not supported */
    }
  }
}

export function getGlobalTelemetryCollector(bufferSeconds = 30, enabled = true): TelemetryCollector {
  if (!globalCollector) {
    globalCollector = new TelemetryCollector(bufferSeconds, enabled);
    globalCollector.start();
  }
  return globalCollector;
}

export function resetGlobalTelemetryCollector(): void {
  globalCollector?.stop();
  globalCollector = null;
}
