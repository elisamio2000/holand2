import type { eventWithTime } from 'rrweb/typings/types';
import { EventType } from '@rrweb/types';
import type { ErrorLogEntry } from '../interceptors/error-interceptor';
import type { NetworkLogEntry } from '../interceptors/network-interceptor';
import type { ClickLogEntry } from '../interceptors/click-logger';
import type { NavigationLogEntry } from '../interceptors/navigation-tracker';
import { findLatestBaselineIndex } from './replay-events';

function isBaselineEvent(event: eventWithTime): boolean {
  return event.type === EventType.FullSnapshot || event.type === EventType.Meta;
}

/** Time-window filter that keeps a DOM baseline for rrweb replay. */
function filterRrwebEventsWithBaseline(
  events: eventWithTime[],
  cutoff: number
): eventWithTime[] {
  const inWindow = events.filter((event) => event.timestamp >= cutoff);
  if (inWindow.some(isBaselineEvent)) return inWindow;

  const baselineIdx = findLatestBaselineIndex(events);
  if (baselineIdx === -1) return inWindow;

  const baseline = events[baselineIdx];
  if (baseline.timestamp >= cutoff) return inWindow;

  return [
    baseline,
    ...inWindow.filter((event) => event.timestamp > baseline.timestamp),
  ];
}

/** Memory trim that never drops the latest DOM baseline. */
function trimRrwebEventsPreservingBaseline(events: eventWithTime[], trimRatio: number): eventWithTime[] {
  if (events.length === 0) return events;

  const trimStart = Math.floor(events.length * trimRatio);
  if (trimStart <= 0) return events;

  const trimmed = events.slice(trimStart);
  if (trimmed.some(isBaselineEvent)) return trimmed;

  const baselineIdx = findLatestBaselineIndex(events.slice(0, trimStart));
  if (baselineIdx === -1) return trimmed;

  const baseline = events[baselineIdx];
  return [baseline, ...trimmed.filter((event) => event.timestamp > baseline.timestamp)];
}

export interface BufferedSession {
  rrwebEvents: eventWithTime[];
  errors: ErrorLogEntry[];
  networkLogs: NetworkLogEntry[];
  clicks: ClickLogEntry[];
  navigationLog: NavigationLogEntry[];
  consoleLog: { level: string; message: string; timestamp: number }[];
  startTime: number;
}

const DEFAULT_BUFFER_SECONDS = 30;
const MAX_MEMORY_BYTES = 10 * 1024 * 1024;

export class RollingBuffer {
  private rrwebEvents: eventWithTime[] = [];
  private errors: ErrorLogEntry[] = [];
  private networkLogs: NetworkLogEntry[] = [];
  private clicks: ClickLogEntry[] = [];
  private navigationLog: NavigationLogEntry[] = [];
  private consoleLog: { level: string; message: string; timestamp: number }[] = [];
  private bufferSeconds: number;
  private startTime: number;
  private enabled: boolean;

  constructor(bufferSeconds: number = DEFAULT_BUFFER_SECONDS, enabled = true) {
    this.bufferSeconds = bufferSeconds;
    this.startTime = Date.now();
    this.enabled = enabled;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) this.clear();
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  addRrwebEvent(event: eventWithTime): void {
    if (!this.enabled) return;
    this.rrwebEvents.push(event);
    this.cleanup();
  }

  addError(error: ErrorLogEntry): void {
    if (!this.enabled) return;
    this.errors.push(error);
    this.cleanup();
  }

  addNetworkLog(log: NetworkLogEntry): void {
    if (!this.enabled) return;
    this.networkLogs.push(log);
    this.cleanup();
  }

  addClick(click: ClickLogEntry): void {
    if (!this.enabled) return;
    this.clicks.push(click);
    this.cleanup();
  }

  addNavigation(entry: NavigationLogEntry): void {
    if (!this.enabled) return;
    this.navigationLog.push(entry);
    this.cleanup();
  }

  addConsoleLog(entry: { level: string; message: string; timestamp: number }): void {
    if (!this.enabled) return;
    this.consoleLog.push(entry);
    this.cleanup();
  }

  getLastNSeconds(seconds?: number): BufferedSession {
    const targetSeconds = seconds || this.bufferSeconds;
    const cutoff = Date.now() - targetSeconds * 1000;

    return {
      rrwebEvents: filterRrwebEventsWithBaseline(this.rrwebEvents, cutoff),
      errors: this.errors.filter((e) => e.timestamp >= cutoff),
      networkLogs: this.networkLogs.filter((n) => n.timestamp >= cutoff),
      clicks: this.clicks.filter((c) => c.timestamp >= cutoff),
      navigationLog: this.navigationLog.filter((n) => n.timestamp >= cutoff),
      consoleLog: this.consoleLog.filter((c) => c.timestamp >= cutoff),
      startTime: Math.max(this.startTime, cutoff),
    };
  }

  getSessionSince(startTime: number): BufferedSession {
    return {
      rrwebEvents: filterRrwebEventsWithBaseline(this.rrwebEvents, startTime),
      errors: this.errors.filter((e) => e.timestamp >= startTime),
      networkLogs: this.networkLogs.filter((n) => n.timestamp >= startTime),
      clicks: this.clicks.filter((c) => c.timestamp >= startTime),
      navigationLog: this.navigationLog.filter((n) => n.timestamp >= startTime),
      consoleLog: this.consoleLog.filter((c) => c.timestamp >= startTime),
      startTime,
    };
  }

  clear(): void {
    this.rrwebEvents = [];
    this.errors = [];
    this.networkLogs = [];
    this.clicks = [];
    this.navigationLog = [];
    this.consoleLog = [];
    this.startTime = Date.now();
  }

  private cleanup(): void {
    const cutoff = Date.now() - this.bufferSeconds * 1000;
    this.rrwebEvents = filterRrwebEventsWithBaseline(this.rrwebEvents, cutoff);
    this.errors = this.errors.filter((e) => e.timestamp >= cutoff);
    this.networkLogs = this.networkLogs.filter((n) => n.timestamp >= cutoff);
    this.clicks = this.clicks.filter((c) => c.timestamp >= cutoff);
    this.navigationLog = this.navigationLog.filter((n) => n.timestamp >= cutoff);
    this.consoleLog = this.consoleLog.filter((c) => c.timestamp >= cutoff);

    const usage = this.getMemoryUsage();
    if (usage.estimatedBytes > MAX_MEMORY_BYTES) {
      const trimRatio = 0.25;
      const trim = <T,>(arr: T[]) => arr.slice(Math.floor(arr.length * trimRatio));
      this.rrwebEvents = trimRrwebEventsPreservingBaseline(this.rrwebEvents, trimRatio);
      this.networkLogs = trim(this.networkLogs);
      this.clicks = trim(this.clicks);
    }
  }

  getMemoryUsage(): { itemCount: number; estimatedBytes: number } {
    const itemCount =
      this.rrwebEvents.length +
      this.errors.length +
      this.networkLogs.length +
      this.clicks.length +
      this.navigationLog.length +
      this.consoleLog.length;
    const estimatedBytes =
      JSON.stringify(this.rrwebEvents).length +
      JSON.stringify(this.errors).length +
      JSON.stringify(this.networkLogs).length +
      JSON.stringify(this.clicks).length +
      JSON.stringify(this.navigationLog).length +
      JSON.stringify(this.consoleLog).length;
    return { itemCount, estimatedBytes };
  }
}
