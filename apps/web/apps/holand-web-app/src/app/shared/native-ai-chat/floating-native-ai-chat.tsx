'use client';

import { Tooltip } from '@/components/tooltip';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { isAxiosError } from 'axios';
import { useTranslation } from 'react-i18next';
import {
  PiSparkle,
  PiX,
  PiCaretDown,
  PiCaretUp,
  PiArrowSquareOut,
  PiArrowsInSimple,
} from 'react-icons/pi';
import { ActionIcon, Button, Text, Textarea, Title } from 'rizzui';
import cn from '@core/utils/class-names';
import { routes } from '@/config/routes';
import ChatInput from '@/app/shared/ai-chat/chat-input';
import { useChatDock } from '@/hooks/use-chat-dock';
import { chatService } from '@/services/chat.service';
import type { ChatRequest } from '@/types/chat.types';
import {
  clampFabPosition,
  clampNativePanelSize,
  dispatchNativeAiChatPanelState,
  NATIVE_AI_CHAT_MINIMIZE_EVENT,
  NATIVE_AI_CHAT_OPEN_EVENT,
  NATIVE_AI_CHAT_TOGGLE_EVENT,
  NATIVE_PANEL_DEFAULT_SIZE,
  readFabPinned,
  readFabPosition,
  readPanelSize,
  writeFabPinned,
  writeFabPosition,
  writePanelSize,
  type FabPos,
  type NativeAiChatAnchorRect,
  type NativeAiChatSurface,
  type NativePanelSize,
} from './native-ai-chat-bridge';
import {
  clampPanelPlacement,
  computeFabRestoreNearPanel,
  computeSmartPanelPosition,
  NATIVE_CHAT_FAB_SIZE_PX,
  NATIVE_CHAT_FAB_Z_INDEX,
  NATIVE_CHAT_PANEL_Z_INDEX,
  resizePanelFromBottomStart,
} from './native-ai-chat-panel-layout';

/** Stable key for ChatRequest.context (align with backend doc later). */
export const NATIVE_HOST_CONTEXT_KEY = 'native_host_context_v1' as const;

export interface FloatingNativeAiChatProps {
  surface: NativeAiChatSurface;
  /** Returns serializable page snapshot (merged under native_host_context_v1). */
  buildContext: () => Record<string, unknown>;
}

function buildEnvelope(
  surface: NativeAiChatSurface,
  pathname: string,
  href: string,
  extra: Record<string, unknown>,
  userNote: string | null
) {
  return {
    schema_version: 1 as const,
    surface,
    pathname,
    href,
    user_note: userNote,
    ...extra,
  };
}

function anchorRectToDomRect(rect: NativeAiChatAnchorRect): DOMRect {
  return {
    left: rect.left,
    top: rect.top,
    right: rect.right,
    bottom: rect.bottom,
    width: rect.width,
    height: rect.height,
    x: rect.left,
    y: rect.top,
    toJSON: () => ({}),
  } as DOMRect;
}

export default function FloatingNativeAiChat({
  surface,
  buildContext,
}: FloatingNativeAiChatProps) {
  const { t } = useTranslation();
  const pathname = usePathname() ?? '/';
  const [href, setHref] = useState('');
  const [open, setOpen] = useState(false);
  const [fabPinned, setFabPinned] = useState(false);
  const [contextExpanded, setContextExpanded] = useState(true);
  const [payloadPreviewOpen, setPayloadPreviewOpen] = useState(false);
  const [userNote, setUserNote] = useState('');
  const [fabPos, setFabPos] = useState<FabPos | null>(null);
  const [panelPos, setPanelPos] = useState<{ top: number; left: number }>({
    top: 80,
    left: 16,
  });
  const [viewportW, setViewportW] = useState(1200);
  const [panelSize, setPanelSize] = useState<NativePanelSize>(() => ({ ...NATIVE_PANEL_DEFAULT_SIZE }));
  const [isSending, setIsSending] = useState(false);
  const sendingLockRef = useRef(false);
  const isResizingRef = useRef(false);

  const fabRef = useRef<HTMLButtonElement>(null);
  const panelShellRef = useRef<HTMLDivElement>(null);
  const anchorRectRef = useRef<DOMRect | null>(null);
  const panelSizeRef = useRef<NativePanelSize>(panelSize);
  const openRef = useRef(open);
  const fabPinnedRef = useRef(fabPinned);
  const resizeDragRef = useRef<{
    startX: number;
    startY: number;
    originW: number;
    originH: number;
    originLeft: number;
    originTop: number;
  } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    startX: number;
    startY: number;
    origin: FabPos;
    dragging: boolean;
  } | null>(null);
  const panelDragRef = useRef<{
    startX: number;
    startY: number;
    origin: { top: number; left: number };
    dragging: boolean;
  } | null>(null);

  useEffect(() => {
    openRef.current = open;
  }, [open]);

  useEffect(() => {
    fabPinnedRef.current = fabPinned;
  }, [fabPinned]);

  useEffect(() => {
    setHref(typeof window !== 'undefined' ? window.location.href : '');
  }, [pathname]);

  const broadcastState = useCallback(
    (nextOpen: boolean, nextPinned: boolean) => {
      dispatchNativeAiChatPanelState(surface, nextOpen, nextPinned);
    },
    [surface]
  );

  const dock = useChatDock({ surface, pathname, buildContext });

  useLayoutEffect(() => {
    const pinned = readFabPinned(surface);
    setFabPinned(pinned);
    fabPinnedRef.current = pinned;

    const vw0 = typeof window !== 'undefined' ? window.innerWidth : 1200;
    const vh0 = typeof window !== 'undefined' ? window.innerHeight : 800;
    setViewportW(vw0);
    const saved = readFabPosition(surface);
    if (saved) {
      setFabPos(clampFabPosition(saved, NATIVE_CHAT_FAB_SIZE_PX, vw0, vh0, 8));
    } else {
      setFabPos({
        left: vw0 - NATIVE_CHAT_FAB_SIZE_PX - 20,
        top: vh0 - NATIVE_CHAT_FAB_SIZE_PX - 20,
      });
    }
    const savedSize = readPanelSize(surface);
    if (savedSize) {
      setPanelSize(clampNativePanelSize(savedSize.width, savedSize.height, vw0, vh0));
    } else {
      setPanelSize({ ...NATIVE_PANEL_DEFAULT_SIZE });
    }

    broadcastState(false, pinned);
  }, [surface, broadcastState]);

  useEffect(() => {
    panelSizeRef.current = panelSize;
  }, [panelSize]);

  const persistFab = useCallback(
    (p: FabPos) => {
      if (typeof window === 'undefined') return;
      const clamped = clampFabPosition(
        p,
        NATIVE_CHAT_FAB_SIZE_PX,
        window.innerWidth,
        window.innerHeight,
        8
      );
      setFabPos(clamped);
      writeFabPosition(surface, clamped);
    },
    [surface]
  );

  const syncFabToLastPanelFrame = useCallback(() => {
    if (typeof window === 'undefined') return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const el = panelShellRef.current;
    if (el) {
      const next = computeFabRestoreNearPanel(
        el.getBoundingClientRect(),
        NATIVE_CHAT_FAB_SIZE_PX,
        vw,
        vh,
        8
      );
      persistFab(next);
      return;
    }
    const a = anchorRectRef.current;
    if (a) {
      persistFab({
        left: a.right - NATIVE_CHAT_FAB_SIZE_PX,
        top: a.top,
      });
    }
  }, [persistFab]);

  const openPanel = useCallback(
    (anchor?: DOMRect | NativeAiChatAnchorRect | null) => {
      if (anchor) {
        anchorRectRef.current =
          anchor instanceof DOMRect ? anchor : anchorRectToDomRect(anchor);
      } else {
        anchorRectRef.current = fabRef.current?.getBoundingClientRect() ?? null;
      }
      setOpen(true);
      broadcastState(true, fabPinnedRef.current);
      void dock.loadDock();
    },
    [broadcastState, dock]
  );

  const closePanel = useCallback(
    (options?: { pinFab?: boolean }) => {
      const pinFab = options?.pinFab ?? false;
      setOpen(false);

      if (pinFab) {
        syncFabToLastPanelFrame();
        writeFabPinned(surface, true);
        setFabPinned(true);
        fabPinnedRef.current = true;
        broadcastState(false, true);
        return;
      }

      // Full dismiss: close panel, hide floating FAB, clear header active state
      writeFabPinned(surface, false);
      setFabPinned(false);
      fabPinnedRef.current = false;
      broadcastState(false, false);
    },
    [surface, syncFabToLastPanelFrame, broadcastState]
  );

  useEffect(() => {
    const onToggle = (e: Event) => {
      const ce = e as CustomEvent<{ surface: string; anchorRect?: NativeAiChatAnchorRect }>;
      if (ce.detail?.surface !== surface) return;
      if (openRef.current) {
        closePanel();
      } else {
        openPanel(ce.detail?.anchorRect ?? null);
      }
    };
    const onMinimize = (e: Event) => {
      const ce = e as CustomEvent<{ surface: string }>;
      if (ce.detail?.surface !== surface) return;
      closePanel({ pinFab: true });
    };
    const onOpen = (e: Event) => {
      const ce = e as CustomEvent<{ surface: string; anchorRect?: NativeAiChatAnchorRect }>;
      if (ce.detail?.surface !== surface) return;
      openPanel(ce.detail?.anchorRect ?? null);
    };

    window.addEventListener(NATIVE_AI_CHAT_TOGGLE_EVENT, onToggle as EventListener);
    window.addEventListener(NATIVE_AI_CHAT_MINIMIZE_EVENT, onMinimize as EventListener);
    window.addEventListener(NATIVE_AI_CHAT_OPEN_EVENT, onOpen as EventListener);
    return () => {
      window.removeEventListener(NATIVE_AI_CHAT_TOGGLE_EVENT, onToggle as EventListener);
      window.removeEventListener(NATIVE_AI_CHAT_MINIMIZE_EVENT, onMinimize as EventListener);
      window.removeEventListener(NATIVE_AI_CHAT_OPEN_EVENT, onOpen as EventListener);
    };
  }, [surface, closePanel, openPanel]);

  useEffect(() => {
    const onResize = () => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      setViewportW(vw);
      setFabPos((prev) =>
        prev ? clampFabPosition(prev, NATIVE_CHAT_FAB_SIZE_PX, vw, vh, 8) : prev
      );
      setPanelSize((prev) => clampNativePanelSize(prev.width, prev.height, vw, vh));
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (!open || isResizingRef.current || typeof window === 'undefined') return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const w = Math.min(panelSize.width, vw - 16);
    const h = Math.min(panelSize.height, vh - 24);
    setPanelPos((prev) => clampPanelPlacement(prev, w, h, vw, vh));
  }, [open, panelSize.width, panelSize.height]);

  const contextBlock = useMemo(() => {
    const extra = buildContext();
    return {
      [NATIVE_HOST_CONTEXT_KEY]: buildEnvelope(
        surface,
        pathname,
        href || pathname,
        extra,
        userNote.trim() || null
      ),
    };
  }, [buildContext, surface, pathname, href, userNote]);

  const payloadJson = useMemo(
    () => JSON.stringify(contextBlock, null, 2),
    [contextBlock]
  );

  const recomputePanel = useCallback(() => {
    if (!open || typeof window === 'undefined' || isResizingRef.current) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const panelW = Math.min(panelSizeRef.current.width, vw - 16);
    const panelH = Math.min(panelSizeRef.current.height, vh - 24);
    const anchor =
      anchorRectRef.current ?? fabRef.current?.getBoundingClientRect() ?? null;
    if (!anchor) return;
    setPanelPos(computeSmartPanelPosition(anchor, panelW, panelH, vw, vh));
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return;
    recomputePanel();
  }, [open, recomputePanel]);

  useEffect(() => {
    if (!open || !scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [dock.messages, open]);

  const handleFabPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!fabPos) return;
      fabRef.current?.setPointerCapture(e.pointerId);
      dragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        origin: { ...fabPos },
        dragging: false,
      };
    },
    [fabPos]
  );

  const handleFabPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const d = dragRef.current;
      if (!d || !fabPos) return;
      const dx = e.clientX - d.startX;
      const dy = e.clientY - d.startY;
      if (!d.dragging && (Math.abs(dx) > 6 || Math.abs(dy) > 6)) {
        d.dragging = true;
      }
      if (!d.dragging) return;
      persistFab({ left: d.origin.left + dx, top: d.origin.top + dy });
    },
    [fabPos, persistFab]
  );

  const handleFabPointerUp = useCallback(
    (e: React.PointerEvent) => {
      const d = dragRef.current;
      dragRef.current = null;
      try {
        fabRef.current?.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      if (!d?.dragging) {
        openPanel(fabRef.current?.getBoundingClientRect() ?? null);
      }
    },
    [openPanel]
  );

  const handlePanelHeaderPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!open) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      panelDragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        origin: { ...panelPos },
        dragging: false,
      };
    },
    [open, panelPos]
  );

  const handlePanelHeaderPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const d = panelDragRef.current;
      if (!d) return;
      const dx = e.clientX - d.startX;
      const dy = e.clientY - d.startY;
      if (!d.dragging && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) {
        d.dragging = true;
      }
      if (!d.dragging || typeof window === 'undefined') return;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const el = panelShellRef.current;
      const rect = el?.getBoundingClientRect();
      const panelW = rect?.width ?? Math.min(panelSize.width, vw - 16);
      const panelH = rect?.height ?? Math.min(panelSize.height, vh - 24);
      const next = clampPanelPlacement(
        { left: d.origin.left + dx, top: d.origin.top + dy },
        panelW,
        panelH,
        vw,
        vh
      );
      setPanelPos(next);
    },
    [panelSize.width, panelSize.height]
  );

  const handlePanelHeaderPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    panelDragRef.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  }, []);

  const stopHeaderDrag = useCallback((e: React.PointerEvent) => {
    e.stopPropagation();
  }, []);

  const handleResizePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.stopPropagation();
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      isResizingRef.current = true;
      resizeDragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        originW: panelSizeRef.current.width,
        originH: panelSizeRef.current.height,
        originLeft: panelPos.left,
        originTop: panelPos.top,
      };
    },
    [panelPos.left, panelPos.top]
  );

  const handleResizePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const d = resizeDragRef.current;
    if (!d || typeof window === 'undefined') return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const dw = e.clientX - d.startX;
    const dh = e.clientY - d.startY;
    const { placement, size } = resizePanelFromBottomStart(
      {
        left: d.originLeft,
        top: d.originTop,
        width: d.originW,
        height: d.originH,
      },
      dw,
      dh,
      vw,
      vh
    );
    setPanelSize(size);
    setPanelPos(placement);
  }, []);

  const handleResizePointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      resizeDragRef.current = null;
      isResizingRef.current = false;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      writePanelSize(surface, panelSizeRef.current);
    },
    [surface]
  );

  const handleSend = useCallback(
    async (content: string) => {
      const trimmed = content.trim();
      if (!trimmed || sendingLockRef.current) return;
      sendingLockRef.current = true;

      const userId = `u-${Date.now()}`;
      dock.setMessages((prev) => [
        ...prev,
        {
          id: userId,
          session_id: dock.sessionId ?? '',
          role: 'user' as const,
          content: trimmed,
        },
      ]);
      setIsSending(true);

      const req: ChatRequest = {
        message: trimmed,
        session_id: dock.sessionId,
        context: contextBlock,
        stream: false,
        use_memory: true,
        show_thinking: false,
        include_suggestions: false,
      };

      try {
        const res = await chatService.sendMessage(req);
        if (res.session_id && !dock.sessionId) {
          void dock.loadDock();
        }
        const answer = (res.answer ?? '').trim() || t('nativeAiChat.emptyAnswerFallback');
        dock.setMessages((prev) => [
          ...prev,
          {
            id: `a-${Date.now()}`,
            session_id: res.session_id ?? dock.sessionId ?? '',
            role: 'assistant' as const,
            content: answer,
          },
        ]);
      } catch (err: unknown) {
        let detail = '';
        if (isAxiosError(err)) {
          const d = err.response?.data as { detail?: unknown; message?: unknown } | undefined;
          const raw = d?.detail ?? d?.message ?? err.message;
          detail = typeof raw === 'string' ? raw : JSON.stringify(raw ?? '');
        } else if (err instanceof Error) {
          detail = err.message;
        }
        const msg = detail.trim()
          ? t('nativeAiChat.gatewayErrorWithDetail', { detail })
          : t('nativeAiChat.gatewayError');
        dock.setMessages((prev) => [
          ...prev,
          {
            id: `e-${Date.now()}`,
            session_id: dock.sessionId ?? '',
            role: 'assistant' as const,
            content: msg,
          },
        ]);
      } finally {
        sendingLockRef.current = false;
        setIsSending(false);
      }
    },
    [contextBlock, dock, t]
  );

  const handleNewConversation = useCallback(() => {
    void dock.startNewConversation();
  }, [dock]);

  const fullChatHref =
    dock.sessionId != null
      ? `${routes.aiChat.root}?session=${dock.sessionId}`
      : routes.aiChat.root;

  const minimizePanel = useCallback(() => {
    closePanel({ pinFab: true });
  }, [closePanel]);

  const dismissPanel = useCallback(() => {
    closePanel({ pinFab: false });
  }, [closePanel]);

  if (!fabPos) {
    return null;
  }

  const title = t(`nativeAiChat.surfaces.${surface}.title`);
  const subtitle = t(`nativeAiChat.surfaces.${surface}.subtitle`);
  const showFab = fabPinned && !open;

  return (
    <>
      <div
        className="pointer-events-none fixed"
        style={{
          left: panelPos.left,
          top: panelPos.top,
          width: Math.min(panelSize.width, viewportW - 16),
          height: panelSize.height,
          zIndex: NATIVE_CHAT_PANEL_Z_INDEX,
        }}
      >
        <div
          ref={panelShellRef}
          className={cn(
            'pointer-events-auto relative flex h-full w-full min-h-0 flex-col overflow-hidden rounded-2xl border border-muted bg-gray-0/95 shadow-[0_16px_48px_rgba(0,0,0,0.18)] backdrop-blur-md transition-[opacity,transform] duration-200 dark:bg-gray-50/95',
            open
              ? 'translate-y-0 scale-100 opacity-100'
              : 'pointer-events-none invisible translate-y-2 scale-95 opacity-0'
          )}
          aria-hidden={!open}
        >
          <div
            className={cn(
              'flex cursor-grab items-start justify-between gap-2 border-b border-muted bg-gradient-to-l from-primary/10 to-transparent px-3 py-2.5 active:cursor-grabbing'
            )}
            onPointerDown={handlePanelHeaderPointerDown}
            onPointerMove={handlePanelHeaderPointerMove}
            onPointerUp={handlePanelHeaderPointerUp}
            onPointerCancel={handlePanelHeaderPointerUp}
            style={{ touchAction: 'none' }}
            aria-label={t('nativeAiChat.dragHandleAria')}
          >
            <div className="flex min-w-0 flex-1 items-start gap-2 select-none">
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary"
                aria-hidden
              >
                <PiSparkle className="h-4 w-4" />
              </div>
              <div className="min-w-0 pt-0.5">
                <Title as="h3" className="truncate text-sm font-semibold text-gray-900 dark:text-gray-0">
                  {title}
                </Title>
                <Text className="text-[11px] text-gray-500 dark:text-gray-400">{subtitle}</Text>
              </div>
            </div>
            <div
              className="flex shrink-0 items-center gap-0.5"
              onPointerDown={stopHeaderDrag}
            >
              <Link
                href={fullChatHref}
                className="inline-flex h-8 cursor-pointer items-center rounded-lg px-2 text-xs font-medium text-primary hover:bg-primary/10"
                onPointerDown={stopHeaderDrag}
              >
                <PiArrowSquareOut className="me-1 h-3.5 w-3.5" />
                <span className="hidden xs:inline">{t('nativeAiChat.openFullChat')}</span>
              </Link>
              <Tooltip content={t('nativeAiChat.minimizePanelTooltip')} placement="bottom">
                <ActionIcon
                  variant="text"
                  size="sm"
                  aria-label={t('nativeAiChat.minimizePanelTooltip')}
                  className="cursor-pointer"
                  onPointerDown={stopHeaderDrag}
                  onClick={minimizePanel}
                >
                  <PiArrowsInSimple className="h-4 w-4" />
                </ActionIcon>
              </Tooltip>
              <Tooltip content={t('nativeAiChat.closePanel')} placement="bottom">
                <ActionIcon
                  variant="text"
                  size="sm"
                  aria-label={t('nativeAiChat.closePanel')}
                  className="cursor-pointer"
                  onPointerDown={stopHeaderDrag}
                  onClick={dismissPanel}
                >
                  <PiX className="h-4 w-4" />
                </ActionIcon>
              </Tooltip>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setContextExpanded((v) => !v)}
            className="flex w-full items-center justify-between border-b border-muted/80 px-3 py-2 text-start text-xs text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-100/80"
          >
            <span className="font-medium">{t('nativeAiChat.contextTitle')}</span>
            {contextExpanded ? (
              <PiCaretUp className="h-3.5 w-3.5 shrink-0 text-gray-400" />
            ) : (
              <PiCaretDown className="h-3.5 w-3.5 shrink-0 text-gray-400" />
            )}
          </button>

          {contextExpanded && (
            <div className="max-h-[32vh] space-y-2 overflow-y-auto border-b border-muted/80 px-3 py-2 text-[11px] leading-relaxed">
              <div>
                <span className="font-semibold text-gray-700 dark:text-gray-200">
                  {t('nativeAiChat.contextPath')}
                </span>
                <div className="mt-0.5 break-all rounded-md bg-gray-100 px-2 py-1 font-mono text-[10px] text-gray-600 dark:bg-gray-200/40 dark:text-gray-700">
                  {pathname}
                </div>
              </div>
              <Textarea
                label={t('nativeAiChat.noteLabel')}
                value={userNote}
                onChange={(e) => setUserNote(e.target.value)}
                placeholder={t('nativeAiChat.notePlaceholder')}
                textareaClassName="min-h-[48px] resize-y text-xs"
              />
              <Button
                variant="outline"
                size="sm"
                className="h-8 w-full text-[11px]"
                onClick={() => setPayloadPreviewOpen((v) => !v)}
              >
                {payloadPreviewOpen ? t('nativeAiChat.hidePayload') : t('nativeAiChat.previewPayload')}
              </Button>
              {payloadPreviewOpen && (
                <pre className="max-h-36 overflow-auto rounded-lg bg-gray-900/95 p-2 text-[9px] text-emerald-100/95">
                  {payloadJson}
                </pre>
              )}
              <Text className="text-[10px] text-gray-400">
                Key: <span className="font-mono">{NATIVE_HOST_CONTEXT_KEY}</span> —{' '}
                {t('nativeAiChat.previewHint')}
              </Text>
            </div>
          )}

          <div
            ref={scrollRef}
            className="custom-scrollbar min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-2"
          >
            {dock.isLoading ? (
              <Text className="px-1 py-6 text-center text-xs text-gray-400">
                {t('common.loading')}
              </Text>
            ) : dock.messages.length === 0 ? (
              <Text className="px-1 py-6 text-center text-xs text-gray-400">
                {t('nativeAiChat.emptyHint')}
              </Text>
            ) : (
              dock.messages.map((m) => (
                <div
                  key={m.id}
                  className={cn(
                    'max-w-[95%] rounded-2xl px-3 py-2 text-xs leading-relaxed',
                    m.role === 'user'
                      ? 'ms-auto bg-primary text-gray-0'
                      : 'me-auto border border-muted bg-gray-50 text-gray-800 dark:bg-gray-200/30 dark:text-gray-100'
                  )}
                >
                  {m.content}
                </div>
              ))
            )}
          </div>

          <div className="border-t border-muted bg-gray-0/90 px-2 pb-2 pt-1 dark:bg-gray-50/90">
            <div className="mb-1 flex justify-end">
              <Button
                variant="text"
                size="sm"
                className="h-7 text-[11px] text-primary"
                onClick={handleNewConversation}
                disabled={dock.isLoading || isSending}
              >
                {t('nativeAiChat.newConversation')}
              </Button>
            </div>
            <ChatInput
              onSend={(text) => {
                void handleSend(text);
              }}
              isStreaming={isSending}
              onStop={() => {}}
              disabled={isSending}
            />
          </div>

          <div
            role="separator"
            aria-label={t('nativeAiChat.resizeHandleAria')}
            title={t('nativeAiChat.resizeHandleTooltip')}
            onPointerDown={handleResizePointerDown}
            onPointerMove={handleResizePointerMove}
            onPointerUp={handleResizePointerUp}
            onPointerCancel={handleResizePointerUp}
            style={{ touchAction: 'none' }}
            className={cn(
              'absolute bottom-0 left-0 z-[2] h-5 w-5 cursor-nesw-resize rounded-tr-md border-e border-t border-muted/60 bg-gray-0/80 dark:bg-gray-50/80',
              'hover:bg-primary/10'
            )}
          />
        </div>
      </div>

      {showFab && (
        <button
          ref={fabRef}
          type="button"
          onPointerDown={handleFabPointerDown}
          onPointerMove={handleFabPointerMove}
          onPointerUp={handleFabPointerUp}
          onPointerCancel={handleFabPointerUp}
          aria-expanded={open}
          aria-label={t('nativeAiChat.fabAria')}
          style={{
            position: 'fixed',
            left: fabPos.left,
            top: fabPos.top,
            width: NATIVE_CHAT_FAB_SIZE_PX,
            height: NATIVE_CHAT_FAB_SIZE_PX,
            zIndex: NATIVE_CHAT_FAB_Z_INDEX,
            touchAction: 'none',
          }}
          className={cn(
            'flex cursor-grab items-center justify-center rounded-full shadow-lg transition active:cursor-grabbing',
            'bg-gradient-to-br from-primary to-[#5b21b6] text-white hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary'
          )}
        >
          <PiSparkle className="h-7 w-7" aria-hidden />
        </button>
      )}
    </>
  );
}
