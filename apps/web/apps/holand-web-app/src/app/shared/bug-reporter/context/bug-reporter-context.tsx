'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import type { eventWithTime } from 'rrweb/typings/types';
import { useBugReportConfig } from '../config/use-bug-report-config';
import type { BugReportConfig } from '../config/bug-report-config';
import { getGlobalTelemetryCollector } from '../capture/telemetry-collector';
import { captureViewportScreenshot } from '../capture/screenshot-capture';
import { mergeRrwebEvents, normalizeReplayEvents } from '../capture/replay-events';
import { startErrorInterception } from '../interceptors/error-interceptor';
import { startNetworkInterception } from '../interceptors/network-interceptor';
import { startClickLogging } from '../interceptors/click-logger';
import { startInteractionLogging } from '../interceptors/interaction-logger';
import {
  createNavigationEntry,
  startPopstateTracking,
} from '../interceptors/navigation-tracker';
import { useVideoRecorder } from '../capture/use-video-recorder';
import type {
  BugReportAction,
  BugReportSession,
  ConsoleLogEntry,
  ClickAction,
  ApiCallAction,
  ErrorAction,
} from '../types';
import BugReportComposer from '../components/bug-report-composer';

export type CapturePhase = 'idle' | 'recording' | 'composing';

function createSessionId() {
  return `bug-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Time window to consider API call as triggered by a click (ms) */
const CLICK_TO_API_WINDOW_MS = 500;

/** Generate unique ID for API calls (index avoids duplicate React keys for burst requests). */
function generateApiId(
  log: { method: string; url: string; timestamp: number },
  index: number
) {
  return `api-${log.timestamp}-${index}-${log.method}-${extractEndpoint(log.url)}`;
}

/** Extract short endpoint from full URL */
function extractEndpoint(url: string): string {
  try {
    const parsed = new URL(url, window.location.origin);
    return parsed.pathname + (parsed.search ? '?...' : '');
  } catch {
    return url.slice(0, 60);
  }
}

function buildActionsFromTelemetry(
  snapshot: ReturnType<ReturnType<typeof getGlobalTelemetryCollector>['getSessionSince']>,
  startTime: number
): BugReportAction[] {
  const actions: BugReportAction[] = [];

  // 1. Build enriched API call actions with full details
  const apiActions: ApiCallAction[] = snapshot.network.map((log, index) => ({
    type: 'api_call' as const,
    id: generateApiId(log, index),
    timestamp: log.timestamp,
    method: log.method,
    url: log.url,
    endpoint: extractEndpoint(log.url),
    status: log.status,
    statusText: log.statusText,
    duration: log.timing.duration,
    requestBody: log.requestBody,
    responseBody: log.responseBody,
    error: log.error,
    triggeredByClick: undefined,
  }));

  // 2. Build enriched click actions with full element details
  const clickActions: ClickAction[] = snapshot.clicks.map((click) => {
    const clickAction: ClickAction = {
      type: 'click',
      timestamp: click.timestamp,
      target: click.target.ariaLabel || click.target.textContent || click.target.tagName,
      selector: click.target.selector,
      testId: click.target.testId,
      role: click.target.role,
      tagName: click.target.tagName,
      href: click.target.href,
      inputType: click.target.type,
      coordinates: click.coordinates ? { x: click.coordinates.clientX, y: click.coordinates.clientY } : undefined,
      modifiers: click.modifiers,
      triggeredApiCalls: [],
    };

    // Find API calls triggered by this click (within CLICK_TO_API_WINDOW_MS)
    for (const api of apiActions) {
      const timeDiff = api.timestamp - click.timestamp;
      if (timeDiff >= 0 && timeDiff <= CLICK_TO_API_WINDOW_MS) {
        clickAction.triggeredApiCalls!.push(api.id);
        api.triggeredByClick = click.timestamp;
      }
    }

    return clickAction;
  });

  // 3. Build enriched error actions
  const errorActions: ErrorAction[] = snapshot.errors.map((err) => {
    const errorAction: ErrorAction = {
      type: 'error',
      timestamp: err.timestamp,
      message: err.message,
      stack: err.stack,
      source: err.filename,
      lineno: err.lineno,
      colno: err.colno,
      relatedApiCall: undefined,
    };

    // Check if error is related to a failed API call (within 100ms)
    for (const api of apiActions) {
      if (api.error && Math.abs(api.timestamp - err.timestamp) < 100) {
        errorAction.relatedApiCall = api.id;
        break;
      }
    }

    return errorAction;
  });

  // Add navigation
  for (const nav of snapshot.navigationLog) {
    actions.push({ type: 'navigation', from: nav.from, to: nav.to, timestamp: nav.timestamp });
  }

  // Add click actions
  actions.push(...clickActions);

  // Add API call actions
  actions.push(...apiActions);

  // Add error actions
  actions.push(...errorActions);

  // Keyboard: modifier+key combos and special keys only
  for (const kb of snapshot.keyboard) {
    const hasModifier = kb.modifiers.ctrl || kb.modifiers.alt || kb.modifiers.meta;
    const isSpecial = [
      'Enter', 'Escape', 'Tab', 'Backspace', 'Delete',
      'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
      'F1','F2','F3','F4','F5','F6','F7','F8','F9','F10','F11','F12',
    ].includes(kb.key);

    if (hasModifier || isSpecial) {
      const modStr = [
        kb.modifiers.ctrl && 'Ctrl',
        kb.modifiers.shift && 'Shift',
        kb.modifiers.alt && 'Alt',
        kb.modifiers.meta && 'Meta',
      ].filter(Boolean).join('+');

      actions.push({
        type: 'keyboard',
        key: kb.key,
        target: kb.target,
        modifiers: modStr || undefined,
        timestamp: kb.timestamp,
      });
    }
  }

  // Focus: field interactions
  for (const focus of snapshot.focus) {
    if (focus.type === 'focus') {
      actions.push({
        type: 'focus',
        target: focus.target.ariaLabel || focus.target.name || focus.target.tagName,
        fieldType: focus.target.type,
        label: focus.target.ariaLabel || focus.target.placeholder,
        timestamp: focus.timestamp,
      });
    }
  }

  // Input changes: group rapid inputs
  const inputGroups = new Map<string, { last: number; count: number }>();
  for (const inp of snapshot.inputChanges) {
    const key = inp.target.selector ?? inp.target.name ?? inp.target.id ?? 'field';
    const group = inputGroups.get(key);
    const shouldLog = !group || (inp.timestamp - group.last) > 2000;

    if (shouldLog) {
      inputGroups.set(key, { last: inp.timestamp, count: 1 });
      actions.push({
        type: 'input',
        target: inp.target.label || inp.target.ariaLabel || inp.target.name || inp.target.tagName,
        label: inp.target.label || inp.target.placeholder,
        valueLength: inp.isPassword ? undefined : inp.valueLength,
        timestamp: inp.timestamp,
      });
    } else if (group) {
      group.last = inp.timestamp;
      group.count++;
    }
  }

  // Scroll: significant scrolls only
  for (const scroll of snapshot.scroll) {
    if (Math.abs(scroll.deltaY ?? 0) >= 100 || Math.abs(scroll.deltaX ?? 0) >= 100) {
      actions.push({
        type: 'scroll',
        direction: scroll.direction ?? 'down',
        scrollY: scroll.scrollY,
        timestamp: scroll.timestamp,
      });
    }
  }

  return actions
    .filter((a) => a.timestamp >= startTime)
    .sort((a, b) => a.timestamp - b.timestamp);
}

interface BugReporterContextValue {
  config: BugReportConfig;
  isEnabled: boolean;
  capturePhase: CapturePhase;
  recordingDuration: number;
  sessionData: BugReportSession | null;
  composerOpen: boolean;
  toggleCapture: () => Promise<void>;
  updateSession: (updater: (s: BugReportSession) => BugReportSession) => void;
  closeComposer: () => void;
  clearSession: () => void;
  setVideoBlob: (blob: Blob | null) => void;
  video: ReturnType<typeof useVideoRecorder>;
}

const BugReporterContext = createContext<BugReporterContextValue | null>(null);

let globalStopRrweb: (() => void) | null = null;
let globalTakeFullSnapshot: (() => void) | null = null;

export function BugReporterProvider({ children }: { children: ReactNode }) {
  const { data: session } = useSession();
  const pathname = usePathname();
  const { config, isEnabled } = useBugReportConfig();

  const [sessionData, setSessionData] = useState<BugReportSession | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [capturePhase, setCapturePhase] = useState<CapturePhase>('idle');
  const [recordingDuration, setRecordingDuration] = useState(0);

  const videoBlobRef = useRef<Blob | null>(null);
  const extraScreenshotsRef = useRef<BugReportSession['screenshots']>([]);
  const prevPathnameRef = useRef<string | null>(null);
  const sessionStartRef = useRef<number>(Date.now());
  const rrwebEventsRef = useRef<eventWithTime[]>([]);
  const durationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const restoreConsoleRef = useRef<(() => void) | null>(null);
  const restoreErrorRef = useRef<(() => void) | null>(null);
  const restoreNetworkRef = useRef<(() => void) | null>(null);
  const restoreClickRef = useRef<(() => void) | null>(null);
  const restorePopstateRef = useRef<(() => void) | null>(null);
  const restoreInteractionRef = useRef<(() => void) | null>(null);

  const capturePhaseRef = useRef<CapturePhase>('idle');
  capturePhaseRef.current = capturePhase;

  const video = useVideoRecorder();

  const telemetry = useMemo(
    () => getGlobalTelemetryCollector(config.bufferSeconds, true),
    [config.bufferSeconds]
  );

  const rrwebStartedRef = useRef(false);
  const backgroundStartedRef = useRef(false);

  const stopAllCapture = useCallback(() => {
    if (durationTimerRef.current) {
      clearInterval(durationTimerRef.current);
      durationTimerRef.current = null;
    }
    globalStopRrweb?.();
    globalStopRrweb = null;
    globalTakeFullSnapshot = null;
    restoreConsoleRef.current?.();
    restoreConsoleRef.current = null;
    restoreErrorRef.current?.();
    restoreErrorRef.current = null;
    restoreNetworkRef.current?.();
    restoreNetworkRef.current = null;
    restoreClickRef.current?.();
    restoreClickRef.current = null;
    restorePopstateRef.current?.();
    restorePopstateRef.current = null;
    restoreInteractionRef.current?.();
    restoreInteractionRef.current = null;
    backgroundStartedRef.current = false;
    rrwebStartedRef.current = false;
    telemetry.setEnabled(false);
  }, [telemetry]);

  const startRrwebCapture = useCallback(async () => {
    if (rrwebStartedRef.current) return;
    rrwebStartedRef.current = true;

    try {
      const { record, takeFullSnapshot } = await import('rrweb');
      globalTakeFullSnapshot = takeFullSnapshot;

      const stopFn = record({
        emit(event) {
          rrwebEventsRef.current.push(event);
          telemetry.addRrwebEvent(event);
        },
        maskAllInputs: false,
        maskInputOptions: { password: true },
        blockClass: 'rr-block',
        recordCanvas: false,
        collectFonts: false,
        inlineStylesheet: true,
        sampling: {
          mousemove: false,
          mouseInteraction: true,
          scroll: 100,
          media: 800,
          input: 'all',
        },
        plugins: [],
      });

      globalStopRrweb = stopFn ?? null;
      takeFullSnapshot();
    } catch (err) {
      console.error('[BugReporter] rrweb record failed:', err);
      rrwebStartedRef.current = false;
    }
  }, [telemetry]);

  const startManualCapture = useCallback(async () => {
    if (backgroundStartedRef.current) return;
    backgroundStartedRef.current = true;

    rrwebEventsRef.current = [];
    extraScreenshotsRef.current = [];
    videoBlobRef.current = null;
    const captureStart = Date.now();
    sessionStartRef.current = captureStart;

    // CRITICAL: Re-enable telemetry buffer (may have been disabled by previous stopAllCapture)
    telemetry.setEnabled(true);
    telemetry.resetSession(captureStart);

    restoreErrorRef.current = startErrorInterception((error) => {
      telemetry.addError(error);
    });

    restoreNetworkRef.current = startNetworkInterception(
      (log) => telemetry.addNetworkLog(log),
      { maskPii: config.maskPii }
    );

    restoreClickRef.current = startClickLogging((click) => {
      telemetry.addClick(click);
    });

    const orig = {
      log: console.log,
      warn: console.warn,
      error: console.error,
      info: console.info,
      debug: console.debug,
    };

    (['log', 'warn', 'error', 'info', 'debug'] as const).forEach((level) => {
      console[level] = (...args: unknown[]) => {
        const message = args
          .map((a) => (typeof a === 'string' ? a : JSON.stringify(a)))
          .join(' ');
        telemetry.addConsoleLog({ level, message, timestamp: Date.now() });
        orig[level].apply(console, args as []);
      };
    });

    restoreConsoleRef.current = () => {
      console.log = orig.log;
      console.warn = orig.warn;
      console.error = orig.error;
      console.info = orig.info;
      console.debug = orig.debug;
    };

    restorePopstateRef.current = startPopstateTracking((entry) => {
      telemetry.addNavigation(entry);
      globalTakeFullSnapshot?.();
    });

    restoreInteractionRef.current = startInteractionLogging((e) => {
      if (e.kind === 'keyboard') telemetry.addKeyboard(e.entry);
      else if (e.kind === 'focus') telemetry.addFocus(e.entry);
      else if (e.kind === 'input') telemetry.addInputChange(e.entry);
      else if (e.kind === 'scroll') telemetry.addScroll(e.entry);
    }, config.maskPii);

    prevPathnameRef.current = pathname;

    setRecordingDuration(0);
    durationTimerRef.current = setInterval(() => {
      setRecordingDuration((prev) => prev + 1);
    }, 1000);

    setCapturePhase('recording');

    await startRrwebCapture();
  }, [config.maskPii, pathname, startRrwebCapture, telemetry]);

  useEffect(() => {
    if (capturePhase !== 'recording') return;
    const prev = prevPathnameRef.current;
    if (prev && prev !== pathname) {
      const entry = createNavigationEntry(prev, pathname, 'push');
      telemetry.addNavigation(entry);
      globalTakeFullSnapshot?.();
    }
    prevPathnameRef.current = pathname;
  }, [capturePhase, pathname, telemetry]);

  const captureScreenshot = useCallback(async (label?: string) => {
    try {
      const shot = await captureViewportScreenshot(label);
      extraScreenshotsRef.current.push(shot);
    } catch {
      /* ignore */
    }
  }, []);

  const setVideoBlob = useCallback((blob: Blob | null) => {
    videoBlobRef.current = blob;
  }, []);

  const stopManualCapture = useCallback(async (): Promise<BugReportSession | null> => {
    if (!backgroundStartedRef.current) return null;

    if (durationTimerRef.current) {
      clearInterval(durationTimerRef.current);
      durationTimerRef.current = null;
    }

    if (globalTakeFullSnapshot) {
      const beforeCount = rrwebEventsRef.current.length;
      globalTakeFullSnapshot();
      await new Promise<void>((resolve) => {
        const deadline = Date.now() + 500;
        const check = () => {
          const hasNewBaseline = rrwebEventsRef.current
            .slice(beforeCount)
            .some((event) => event.type === 2 || event.type === 4);
          if (hasNewBaseline || Date.now() >= deadline) {
            resolve();
            return;
          }
          requestAnimationFrame(check);
        };
        requestAnimationFrame(check);
      });
    }

    await captureScreenshot('report_capture');

    const startTime = sessionStartRef.current;
    const endTime = Date.now();

    // Use getSessionSince to capture ALL events from the exact recording start time
    const snapshot = telemetry.getSessionSince(startTime);
    const replayEvents = normalizeReplayEvents(
      mergeRrwebEvents(snapshot.events, rrwebEventsRef.current)
    );
    const sessionId = createSessionId();

    const consoleLog: ConsoleLogEntry[] = snapshot.consoleLog.map((entry) => ({
      level: entry.level as ConsoleLogEntry['level'],
      message: entry.message,
      timestamp: entry.timestamp,
    }));

    const payload: BugReportSession = {
      id: sessionId,
      startTime,
      endTime,
      actions: buildActionsFromTelemetry(snapshot, startTime),
      rrwebEvents: replayEvents.length > 0 ? replayEvents : mergeRrwebEvents(snapshot.events, rrwebEventsRef.current),
      screenshots: [...extraScreenshotsRef.current],
      consoleLog,
      networkLog: [...snapshot.network],
      errorLog: [...snapshot.errors],
      clickLog: [...snapshot.clicks],
      navigationLog: [...snapshot.navigationLog],
      videoBlob: videoBlobRef.current ?? undefined,
      telemetry: {
        vitals: snapshot.vitals,
        longTasks: snapshot.longTasks,
        preCapture: false,
      },
      captureMode: 'manual',
      bufferDuration: Math.round((endTime - startTime) / 1000),
      metadata: {
        userAgent: navigator.userAgent,
        viewport: { width: window.innerWidth, height: window.innerHeight },
        url: window.location.href,
        pathname: window.location.pathname,
        userId: session?.user?.id,
        userName: session?.user?.name ?? undefined,
      },
    };

    stopAllCapture();
    setSessionData(payload);
    return payload;
  }, [captureScreenshot, session?.user?.id, session?.user?.name, stopAllCapture, telemetry]);

  const toggleCapture = useCallback(async () => {
    if (!isEnabled) return;

    const phase = capturePhaseRef.current;

    if (phase === 'idle') {
      await startManualCapture();
    } else if (phase === 'recording') {
      const data = await stopManualCapture();
      if (data) {
        setCapturePhase('composing');
        setComposerOpen(true);
      }
    }
    // composing: noop — modal is open
  }, [isEnabled, startManualCapture, stopManualCapture]);

  const closeComposer = useCallback(() => {
    setComposerOpen(false);
    setCapturePhase('idle');
    setRecordingDuration(0);
  }, []);

  const clearSession = useCallback(() => {
    setSessionData(null);
    extraScreenshotsRef.current = [];
    videoBlobRef.current = null;
  }, []);

  const updateSession = useCallback((updater: (s: BugReportSession) => BugReportSession) => {
    setSessionData((prev) => (prev ? updater(prev) : prev));
  }, []);

  useEffect(() => {
    return () => {
      stopAllCapture();
    };
  }, [stopAllCapture]);

  const value = useMemo<BugReporterContextValue>(
    () => ({
      config,
      isEnabled,
      capturePhase,
      recordingDuration,
      sessionData,
      composerOpen,
      toggleCapture,
      updateSession,
      closeComposer,
      clearSession,
      setVideoBlob,
      video,
    }),
    [
      config,
      isEnabled,
      capturePhase,
      recordingDuration,
      sessionData,
      composerOpen,
      toggleCapture,
      updateSession,
      closeComposer,
      clearSession,
      setVideoBlob,
      video,
    ]
  );

  return (
    <BugReporterContext.Provider value={value}>
      {children}
      {composerOpen && sessionData && (
        <BugReportComposer
          session={sessionData}
          config={config}
          onClose={() => {
            closeComposer();
            clearSession();
          }}
          onUpdateSession={updateSession}
          video={video}
          setVideoBlob={setVideoBlob}
        />
      )}
    </BugReporterContext.Provider>
  );
}

export function useBugReporter(): BugReporterContextValue {
  const ctx = useContext(BugReporterContext);
  if (!ctx) {
    throw new Error('useBugReporter must be used within BugReporterProvider');
  }
  return ctx;
}
