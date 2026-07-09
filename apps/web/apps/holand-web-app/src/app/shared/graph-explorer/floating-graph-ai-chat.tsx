// ============================================
// Floating Graph AI Chat — same dock UX as native chat (FAB + smart panel)
// Payload matches graph-ai-chat-contract (GRAPH_AI_CHAT_CONTEXT_KEY).
// ============================================

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
import { useTranslation } from 'react-i18next';
import { isAxiosError } from 'axios';
import {
  PiSparkle,
  PiX,
  PiCaretDown,
  PiCaretUp,
  PiArrowSquareOut,
  PiGraph,
  PiEyeSlash,
} from 'react-icons/pi';
import { ActionIcon, Button, Switch, Text, Textarea, Title } from 'rizzui';
import cn from '@core/utils/class-names';
import { routes } from '@/config/routes';
import ChatInput from '@/app/shared/ai-chat/chat-input';
import { useChatDock } from '@/hooks/use-chat-dock';
import { chatService } from '@/services/chat.service';
import type { ChatRequest } from '@/types/chat.types';
import { GRAPH_AI_CHAT_CONTEXT_KEY } from './graph-ai-chat-contract';
import { buildGraphAiChatRequestContext } from './graph-ai-chat-build-context';
import type { GraphData, GraphNode, InspectorTarget } from '@/types/graph-explorer.types';
import type { PathfindingMode } from './graph-pathfinding';
import type { PathfindingLayerState } from './pathfinding-layer-state';
import {
  clampFabPosition,
  clampNativePanelSize,
  NATIVE_AI_CHAT_VISIBILITY_EVENT,
  NATIVE_PANEL_DEFAULT_SIZE,
  readFabPosition,
  readLauncherHidden,
  readPanelSize,
  writeFabPosition,
  writeLauncherHidden,
  writePanelSize,
  type FabPos,
  type NativeAiChatSurface,
  type NativePanelSize,
} from '@/app/shared/native-ai-chat/native-ai-chat-bridge';
import {
  clampPanelPlacement,
  computeFabRestoreNearPanel,
  computeSmartPanelPosition,
  NATIVE_CHAT_FAB_SIZE_PX,
} from '@/app/shared/native-ai-chat/native-ai-chat-panel-layout';

const DOCK_SURFACE: NativeAiChatSurface = 'graph_visual_explorer';

export interface FloatingGraphAiChatProps {
  pathname: string;
  caseIdsFromRoute?: string[];
  dataSource: 'route' | 'session';
  graphData: GraphData;
  inspectorTarget: InspectorTarget;
  visibleNodes: number;
  visibleLinks: number;
  queryFilterActive: boolean;
  pathfindingOpen: boolean;
  pathMode: PathfindingMode | null;
  pathSourceNode: GraphNode | null;
  pathTargetNode: GraphNode | null;
  pathLayers?: PathfindingLayerState[];
}

function selectionSummary(target: InspectorTarget): string {
  if (!target) return '';
  if (target.kind === 'node') {
    return `${target.item.label} (${target.item.type})`;
  }
  if (target.kind === 'link') {
    return `${target.item.relation} · ${target.item.id}`;
  }
  return target.item.title;
}

export default function FloatingGraphAiChat({
  pathname,
  caseIdsFromRoute,
  dataSource,
  graphData,
  inspectorTarget,
  visibleNodes,
  visibleLinks,
  queryFilterActive,
  pathfindingOpen,
  pathMode,
  pathSourceNode,
  pathTargetNode,
  pathLayers = [],
}: FloatingGraphAiChatProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [contextExpanded, setContextExpanded] = useState(true);
  const [payloadPreviewOpen, setPayloadPreviewOpen] = useState(false);
  const [includeHeavy, setIncludeHeavy] = useState(false);
  const [userNote, setUserNote] = useState('');
  const [href, setHref] = useState('');
  const [launcherHidden, setLauncherHidden] = useState(false);
  const [fabPos, setFabPos] = useState<FabPos | null>(null);
  const [panelPos, setPanelPos] = useState({ top: 80, left: 16 });
  const [viewportW, setViewportW] = useState(1200);
  const [panelSize, setPanelSize] = useState<NativePanelSize>(() => ({ ...NATIVE_PANEL_DEFAULT_SIZE }));
  const [isSending, setIsSending] = useState(false);
  const sendingLockRef = useRef(false);

  const fabRef = useRef<HTMLButtonElement>(null);
  const panelShellRef = useRef<HTMLDivElement>(null);
  const anchorRectRef = useRef<DOMRect | null>(null);
  const panelSizeRef = useRef<NativePanelSize>(panelSize);
  const resizeDragRef = useRef<{
    startX: number;
    startY: number;
    originW: number;
    originH: number;
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
    setHref(typeof window !== 'undefined' ? window.location.href : '');
  }, [pathname]);

  useLayoutEffect(() => {
    setLauncherHidden(readLauncherHidden(DOCK_SURFACE));
    const vw0 = typeof window !== 'undefined' ? window.innerWidth : 1200;
    const vh0 = typeof window !== 'undefined' ? window.innerHeight : 800;
    setViewportW(vw0);
    const saved = readFabPosition(DOCK_SURFACE);
    if (saved) {
      setFabPos(clampFabPosition(saved, NATIVE_CHAT_FAB_SIZE_PX, vw0, vh0, 8));
    } else {
      setFabPos({
        left: vw0 - NATIVE_CHAT_FAB_SIZE_PX - 20,
        top: vh0 - NATIVE_CHAT_FAB_SIZE_PX - 20,
      });
    }
    const savedSize = readPanelSize(DOCK_SURFACE);
    if (savedSize) {
      setPanelSize(clampNativePanelSize(savedSize.width, savedSize.height, vw0, vh0));
    } else {
      setPanelSize({ ...NATIVE_PANEL_DEFAULT_SIZE });
    }
  }, []);

  useEffect(() => {
    panelSizeRef.current = panelSize;
  }, [panelSize]);

  useEffect(() => {
    const onVis = (e: Event) => {
      const ce = e as CustomEvent<{ surface: string; hidden: boolean }>;
      if (ce.detail?.surface === DOCK_SURFACE) {
        setLauncherHidden(!!ce.detail.hidden);
      }
    };
    window.addEventListener(NATIVE_AI_CHAT_VISIBILITY_EVENT, onVis as EventListener);
    return () =>
      window.removeEventListener(NATIVE_AI_CHAT_VISIBILITY_EVENT, onVis as EventListener);
  }, []);

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
    if (!open || typeof window === 'undefined') return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const w = Math.min(panelSize.width, vw - 16);
    const h = Math.min(panelSize.height, vh - 24);
    setPanelPos((prev) => clampPanelPlacement(prev, w, h, vw, vh));
  }, [open, panelSize.width, panelSize.height]);

  const routeCaseIds = useMemo(
    () => (caseIdsFromRoute?.filter(Boolean) ?? []),
    [caseIdsFromRoute]
  );

  const contextBlock = useMemo(
    () =>
      buildGraphAiChatRequestContext({
        pathname,
        href: href || pathname,
        dataSource,
        routeCaseIds,
        graphData,
        visibleNodes,
        visibleLinks,
        inspectorTarget,
        queryFilterActive,
        pathfindingOpen,
        pathMode,
        pathSourceNode,
        pathTargetNode,
        pathLayers,
        userNoteTrimmed: userNote.trim() || null,
        includeHeavy,
      }),
    [
      pathname,
      href,
      dataSource,
      routeCaseIds,
      graphData,
      visibleNodes,
      visibleLinks,
      inspectorTarget,
      queryFilterActive,
      pathfindingOpen,
      pathMode,
      pathSourceNode,
      pathTargetNode,
      pathLayers,
      userNote,
      includeHeavy,
    ]
  );

  const payloadJson = useMemo(
    () => JSON.stringify(contextBlock, null, 2),
    [contextBlock]
  );

  const buildDockContext = useCallback(() => {
    const caseId = routeCaseIds[0];
    const focusId =
      inspectorTarget?.kind === 'node'
        ? inspectorTarget.item.id
        : inspectorTarget?.kind === 'link'
          ? inspectorTarget.item.id
          : inspectorTarget?.kind === 'community'
            ? String(inspectorTarget.item.community_id ?? '')
            : undefined;
    return {
      ...(caseId ? { case_id: caseId } : {}),
      ...(focusId ? { graph_id: focusId } : {}),
    };
  }, [routeCaseIds, inspectorTarget]);

  const dock = useChatDock({
    surface: DOCK_SURFACE,
    pathname,
    buildContext: buildDockContext,
  });

  const fullChatHref =
    dock.sessionId != null
      ? `${routes.aiChat.root}?session=${dock.sessionId}`
      : routes.aiChat.root;

  const recomputePanel = useCallback(() => {
    if (!open || typeof window === 'undefined') return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const panelW = Math.min(panelSize.width, vw - 16);
    const panelH = Math.min(panelSize.height, vh - 24);
    const anchor =
      anchorRectRef.current ?? fabRef.current?.getBoundingClientRect() ?? null;
    if (!anchor) return;
    setPanelPos(computeSmartPanelPosition(anchor, panelW, panelH, vw, vh));
  }, [open, panelSize.width, panelSize.height]);

  useLayoutEffect(() => {
    recomputePanel();
  }, [open, recomputePanel, panelSize.width, panelSize.height]);

  useEffect(() => {
    if (!open || !scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [dock.messages, open]);

  const persistFab = useCallback((p: FabPos) => {
    if (typeof window === 'undefined') return;
    const clamped = clampFabPosition(
      p,
      NATIVE_CHAT_FAB_SIZE_PX,
      window.innerWidth,
      window.innerHeight,
      8
    );
    setFabPos(clamped);
    writeFabPosition(DOCK_SURFACE, clamped);
  }, []);

  const syncFabToLastPanelFrame = useCallback(() => {
    if (typeof window === 'undefined') return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const el = panelShellRef.current;
    if (el) {
      persistFab(computeFabRestoreNearPanel(el.getBoundingClientRect(), NATIVE_CHAT_FAB_SIZE_PX, vw, vh, 8));
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

  const closePanel = useCallback(() => {
    syncFabToLastPanelFrame();
    setOpen(false);
  }, [syncFabToLastPanelFrame]);

  const hideLauncher = useCallback(() => {
    if (open) syncFabToLastPanelFrame();
    writeLauncherHidden(DOCK_SURFACE, true);
    setOpen(false);
    setLauncherHidden(true);
  }, [open, syncFabToLastPanelFrame]);

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

  const handleFabPointerUp = useCallback((e: React.PointerEvent) => {
    const d = dragRef.current;
    dragRef.current = null;
    try {
      fabRef.current?.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    if (!d?.dragging) {
      anchorRectRef.current = fabRef.current?.getBoundingClientRect() ?? null;
      setOpen(true);
      void dock.loadDock();
    }
  }, [dock]);

  const handlePanelHandlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
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

  const handlePanelHandlePointerMove = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
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
    setPanelPos(
      clampPanelPlacement(
        { left: d.origin.left + dx, top: d.origin.top + dy },
        panelW,
        panelH,
        vw,
        vh
      )
    );
  }, [panelSize.width, panelSize.height]);

  const handleResizePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    resizeDragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      originW: panelSizeRef.current.width,
      originH: panelSizeRef.current.height,
    };
  }, []);

  const handleResizePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const d = resizeDragRef.current;
    if (!d || typeof window === 'undefined') return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const dw = e.clientX - d.startX;
    const dh = e.clientY - d.startY;
    setPanelSize(clampNativePanelSize(d.originW + dw, d.originH + dh, vw, vh));
  }, []);

  const handleResizePointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    resizeDragRef.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    writePanelSize(DOCK_SURFACE, panelSizeRef.current);
  }, []);

  const handlePanelHandlePointerUp = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    panelDragRef.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  }, []);

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
        context: { [GRAPH_AI_CHAT_CONTEXT_KEY]: contextBlock },
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

  if (launcherHidden || !fabPos) {
    return null;
  }

  return (
    <>
      <div
        className="pointer-events-none fixed z-[980]"
        dir="ltr"
        style={{
          left: panelPos.left,
          top: panelPos.top,
          width: Math.min(panelSize.width, viewportW - 16),
          height: panelSize.height,
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
          <div className="flex items-start justify-between gap-2 border-b border-muted bg-gradient-to-l from-primary/10 to-transparent px-3 py-2.5">
            <div className="flex min-w-0 flex-1 items-start gap-2">
              <Tooltip content={t('nativeAiChat.dragHandleTooltip')} placement="bottom">
                <button
                  type="button"
                  onPointerDown={handlePanelHandlePointerDown}
                  onPointerMove={handlePanelHandlePointerMove}
                  onPointerUp={handlePanelHandlePointerUp}
                  onPointerCancel={handlePanelHandlePointerUp}
                  aria-label={t('nativeAiChat.dragHandleAria')}
                  style={{ touchAction: 'none' }}
                  className={cn(
                    'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary',
                    'cursor-grab active:cursor-grabbing focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary'
                  )}
                >
                  <PiSparkle className="h-4 w-4" aria-hidden />
                </button>
              </Tooltip>
              <div className="min-w-0 pt-0.5">
                <div className="flex items-center gap-1.5">
                  <PiGraph className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
                  <Title as="h3" className="truncate text-sm font-semibold text-gray-900 dark:text-gray-0">
                    {t('graphExplorer.floatingAiChat.title')}
                  </Title>
                </div>
                <Text className="text-[11px] text-gray-500 dark:text-gray-400">
                  {t('graphExplorer.floatingAiChat.subtitle')}
                </Text>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-0.5">
              <Tooltip content={t('nativeAiChat.hideLauncherTooltip')} placement="bottom">
                <ActionIcon
                  variant="text"
                  size="sm"
                  aria-label={t('nativeAiChat.hideLauncherTooltip')}
                  onClick={hideLauncher}
                >
                  <PiEyeSlash className="h-4 w-4" />
                </ActionIcon>
              </Tooltip>
              <Link
                href={fullChatHref}
                className="inline-flex h-8 items-center rounded-lg px-2 text-xs font-medium text-primary hover:bg-primary/10"
              >
                <PiArrowSquareOut className="me-1 h-3.5 w-3.5" />
                {t('graphExplorer.floatingAiChat.openFullChat')}
              </Link>
              <ActionIcon
                variant="text"
                size="sm"
                aria-label={t('graphExplorer.floatingAiChat.closePanel')}
                onClick={closePanel}
              >
                <PiX className="h-4 w-4" />
              </ActionIcon>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setContextExpanded((v) => !v)}
            className="flex w-full items-center justify-between border-b border-muted/80 px-3 py-2 text-start text-xs text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-100/80"
          >
            <span className="font-medium">{t('graphExplorer.floatingAiChat.contextTitle')}</span>
            {contextExpanded ? (
              <PiCaretUp className="h-3.5 w-3.5 shrink-0 text-gray-400" />
            ) : (
              <PiCaretDown className="h-3.5 w-3.5 shrink-0 text-gray-400" />
            )}
          </button>

          {contextExpanded && (
            <div className="max-h-[38vh] space-y-2 overflow-y-auto border-b border-muted/80 px-3 py-2 text-[11px] leading-relaxed">
              <div>
                <span className="font-semibold text-gray-700 dark:text-gray-200">
                  {t('graphExplorer.floatingAiChat.contextPath')}
                </span>
                <div className="mt-0.5 break-all rounded-md bg-gray-100 px-2 py-1 font-mono text-[10px] text-gray-600 dark:bg-gray-200/40 dark:text-gray-700">
                  {pathname}
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <span className="w-full font-semibold text-gray-700 dark:text-gray-200">
                  {t('graphExplorer.floatingAiChat.contextCases')}
                </span>
                {routeCaseIds.length === 0 ? (
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-gray-500 dark:bg-gray-200/30">
                    —
                  </span>
                ) : (
                  routeCaseIds.map((id) => (
                    <span
                      key={id}
                      className="rounded-full border border-muted bg-gray-0 px-2 py-0.5 font-mono text-[10px] text-gray-700 dark:bg-gray-100/60"
                    >
                      {id}
                    </span>
                  ))
                )}
              </div>
              <div className="text-gray-600 dark:text-gray-300">
                {t('graphExplorer.floatingAiChat.nodesLinks', {
                  nodes: visibleNodes,
                  links: visibleLinks,
                })}
              </div>
              <div>
                <span className="font-semibold text-gray-700 dark:text-gray-200">
                  {t('graphExplorer.floatingAiChat.contextSelection')}
                </span>
                <div className="mt-0.5 text-gray-600 dark:text-gray-300">
                  {inspectorTarget ? selectionSummary(inspectorTarget) : t('graphExplorer.floatingAiChat.contextNone')}
                </div>
              </div>
              {(pathfindingOpen || pathLayers.length > 0) && (
                <div className="rounded-lg border border-amber-200/80 bg-amber-50/80 px-2 py-1.5 text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100">
                  <span className="font-semibold">{t('graphExplorer.floatingAiChat.contextPathfinding')}</span>
                  {pathfindingOpen && (
                    <div className="mt-0.5 font-mono text-[10px]">
                      {t('graphExplorer.floatingAiChat.contextPathfindingPanel')}:
                      {pathMode ?? '—'} · {pathSourceNode?.id ?? '—'} → {pathTargetNode?.id ?? '—'}
                    </div>
                  )}
                  {pathLayers.length > 0 && (
                    <ul className="mt-1 max-h-24 space-y-0.5 overflow-y-auto font-mono text-[9px] leading-tight">
                      {pathLayers.map((l) => (
                        <li key={l.id}>
                          {l.highlightEnabled ? '●' : '○'} {l.sourceNode.label} → {l.targetNode.label} ({l.mode})
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
              <Textarea
                label={t('graphExplorer.floatingAiChat.noteLabel')}
                value={userNote}
                onChange={(e) => setUserNote(e.target.value)}
                placeholder={t('graphExplorer.floatingAiChat.notePlaceholder')}
                textareaClassName="min-h-[52px] resize-y text-xs"
              />
              <div className="rounded-lg border border-muted bg-gray-50/80 p-2 dark:bg-gray-200/20">
                <Switch
                  label={t('graphExplorer.floatingAiChat.attachHeavyLabel')}
                  checked={includeHeavy}
                  onChange={() => setIncludeHeavy((v) => !v)}
                />
                <Text className="mt-1 text-[10px] text-gray-500 dark:text-gray-400">
                  {t('graphExplorer.floatingAiChat.attachHeavyHint')}
                </Text>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-8 w-full text-[11px]"
                onClick={() => setPayloadPreviewOpen((v) => !v)}
              >
                {payloadPreviewOpen
                  ? t('graphExplorer.floatingAiChat.hidePayload')
                  : t('graphExplorer.floatingAiChat.previewPayload')}
              </Button>
              {payloadPreviewOpen && (
                <pre className="max-h-40 overflow-auto rounded-lg bg-gray-900/95 p-2 text-[9px] text-emerald-100/95">
                  {payloadJson}
                </pre>
              )}
              <Text className="text-[10px] text-gray-400">
                Key: <span className="font-mono">{GRAPH_AI_CHAT_CONTEXT_KEY}</span> —{' '}
                {t('graphExplorer.floatingAiChat.previewHint')}
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
                {t('graphExplorer.floatingAiChat.emptyHint')}
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

          <Tooltip content={t('nativeAiChat.resizeHandleTooltip')} placement="left">
            <div
              role="separator"
              aria-label={t('nativeAiChat.resizeHandleAria')}
              onPointerDown={handleResizePointerDown}
              onPointerMove={handleResizePointerMove}
              onPointerUp={handleResizePointerUp}
              onPointerCancel={handleResizePointerUp}
              style={{ touchAction: 'none' }}
              className={cn(
                'absolute bottom-0 end-0 z-[2] h-5 w-5 cursor-nwse-resize rounded-ss-md border-s border-t border-muted/60 bg-gray-0/80 dark:bg-gray-50/80',
                'hover:bg-primary/10'
              )}
            />
          </Tooltip>
        </div>
      </div>

      {!open && (
        <button
          ref={fabRef}
          type="button"
          onPointerDown={handleFabPointerDown}
          onPointerMove={handleFabPointerMove}
          onPointerUp={handleFabPointerUp}
          onPointerCancel={handleFabPointerUp}
          aria-expanded={open}
          aria-label={t('graphExplorer.floatingAiChat.fabAria')}
          style={{
            position: 'fixed',
            left: fabPos.left,
            top: fabPos.top,
            width: NATIVE_CHAT_FAB_SIZE_PX,
            height: NATIVE_CHAT_FAB_SIZE_PX,
            zIndex: 981,
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
