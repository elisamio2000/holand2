// ============================================
// Native AI chat — header ↔ floating panel bridge
// ============================================

export const CONTEXTUAL_ASSISTANT_PANEL_STATE_EVENT = 'contextual-assistant:panel-state';
export const CONTEXTUAL_ASSISTANT_TOGGLE_EVENT = 'contextual-assistant:toggle-panel';
export const CONTEXTUAL_ASSISTANT_MINIMIZE_EVENT = 'contextual-assistant:minimize-panel';
/** @deprecated Use panel-state / toggle events */
export const CONTEXTUAL_ASSISTANT_VISIBILITY_EVENT = 'contextual-assistant:launcher-visibility';
export const CONTEXTUAL_ASSISTANT_OPEN_EVENT = 'contextual-assistant:open-panel';

// Backward-compatible aliases for existing imports during migration.
export const NATIVE_AI_CHAT_PANEL_STATE_EVENT = CONTEXTUAL_ASSISTANT_PANEL_STATE_EVENT;
export const NATIVE_AI_CHAT_TOGGLE_EVENT = CONTEXTUAL_ASSISTANT_TOGGLE_EVENT;
export const NATIVE_AI_CHAT_MINIMIZE_EVENT = CONTEXTUAL_ASSISTANT_MINIMIZE_EVENT;
export const NATIVE_AI_CHAT_VISIBILITY_EVENT = CONTEXTUAL_ASSISTANT_VISIBILITY_EVENT;
export const NATIVE_AI_CHAT_OPEN_EVENT = CONTEXTUAL_ASSISTANT_OPEN_EVENT;

export type ContextualAssistantSurface =
  | 'general'
  | 'file_explorer'
  | 'offline_map'
  | 'geo_location'
  | 'tts_plugin'
  | 'graph_edit_entities'
  | 'graph_visual_explorer'
  | 'messages';

export type NativeAiChatSurface = ContextualAssistantSurface;

export type ContextualAssistantAnchorRect = {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
};

export type NativeAiChatAnchorRect = ContextualAssistantAnchorRect;

export type ContextualAssistantPanelStateDetail = {
  surface: string;
  open: boolean;
  fabPinned: boolean;
};

export type NativeAiChatPanelStateDetail = ContextualAssistantPanelStateDetail;

export function dispatchContextualAssistantPanelState(
  surface: string,
  open: boolean,
  fabPinned: boolean
): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent<ContextualAssistantPanelStateDetail>(CONTEXTUAL_ASSISTANT_PANEL_STATE_EVENT, {
      detail: { surface, open, fabPinned },
    })
  );
}

export const dispatchNativeAiChatPanelState = dispatchContextualAssistantPanelState;

export function requestContextualAssistantToggle(
  surface: ContextualAssistantSurface,
  anchorRect?: ContextualAssistantAnchorRect | DOMRect | null
): void {
  if (typeof window === 'undefined') return;
  const rect = anchorRect
    ? {
        left: anchorRect.left,
        top: anchorRect.top,
        right: anchorRect.right,
        bottom: anchorRect.bottom,
        width: anchorRect.width,
        height: anchorRect.height,
      }
    : undefined;
  window.dispatchEvent(
    new CustomEvent(CONTEXTUAL_ASSISTANT_TOGGLE_EVENT, { detail: { surface, anchorRect: rect } })
  );
}

export const requestNativeAiChatToggle = requestContextualAssistantToggle;

export function requestContextualAssistantMinimize(surface: ContextualAssistantSurface): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(CONTEXTUAL_ASSISTANT_MINIMIZE_EVENT, { detail: { surface } })
  );
}

export const requestNativeAiChatMinimize = requestContextualAssistantMinimize;

export function requestContextualAssistantOpen(
  surface: ContextualAssistantSurface,
  anchorRect?: ContextualAssistantAnchorRect | DOMRect | null
): void {
  if (typeof window === 'undefined') return;
  const rect = anchorRect
    ? {
        left: anchorRect.left,
        top: anchorRect.top,
        right: anchorRect.right,
        bottom: anchorRect.bottom,
        width: anchorRect.width,
        height: anchorRect.height,
      }
    : undefined;
  window.dispatchEvent(
    new CustomEvent(CONTEXTUAL_ASSISTANT_OPEN_EVENT, { detail: { surface, anchorRect: rect } })
  );
}

export const requestNativeAiChatOpen = requestContextualAssistantOpen;

const newFabPinnedKey = (surface: string) => `contextualAssistant.fabPinned.${surface}`;
const newHiddenKey = (surface: string) => `contextualAssistant.hidden.${surface}`;
const newFabPosKey = (surface: string) => `contextualAssistant.fabPos.${surface}`;
const newPanelSizeKey = (surface: string) => `contextualAssistant.panelSize.${surface}`;
const legacyFabPinnedKey = (surface: string) => `nativeAiChat.fabPinned.${surface}`;
const legacyHiddenKey = (surface: string) => `nativeAiChat.hidden.${surface}`;
const legacyFabPosKey = (surface: string) => `nativeAiChat.fabPos.${surface}`;
const legacyPanelSizeKey = (surface: string) => `nativeAiChat.panelSize.${surface}`;

function readWithLegacyFallback(primaryKey: string, legacyKey: string): string | null {
  if (typeof window === 'undefined') return null;
  const next = window.localStorage.getItem(primaryKey);
  if (next != null) return next;
  const legacy = window.localStorage.getItem(legacyKey);
  if (legacy != null) {
    window.localStorage.setItem(primaryKey, legacy);
  }
  return legacy;
}

/** Default floating panel size (px). */
export const NATIVE_PANEL_DEFAULT_SIZE = { width: 420, height: 560 } as const;

/** User-resizable bounds (px). */
export const NATIVE_PANEL_SIZE_MIN = { width: 320, height: 360 } as const;

export type NativePanelSize = { width: number; height: number };

export function clampNativePanelSize(
  width: number,
  height: number,
  vw: number,
  vh: number
): NativePanelSize {
  const maxW = Math.max(NATIVE_PANEL_SIZE_MIN.width, vw - 16);
  const maxH = Math.max(NATIVE_PANEL_SIZE_MIN.height, vh - 24);
  return {
    width: Math.min(Math.max(NATIVE_PANEL_SIZE_MIN.width, width), maxW),
    height: Math.min(Math.max(NATIVE_PANEL_SIZE_MIN.height, height), maxH),
  };
}

export function readPanelSize(surface: string): NativePanelSize | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = readWithLegacyFallback(newPanelSizeKey(surface), legacyPanelSizeKey(surface));
    if (!raw) return null;
    const p = JSON.parse(raw) as NativePanelSize;
    if (typeof p.width !== 'number' || typeof p.height !== 'number') return null;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    return clampNativePanelSize(p.width, p.height, vw, vh);
  } catch {
    return null;
  }
}

export function writePanelSize(surface: string, size: NativePanelSize): void {
  if (typeof window === 'undefined') return;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const clamped = clampNativePanelSize(size.width, size.height, vw, vh);
  window.localStorage.setItem(newPanelSizeKey(surface), JSON.stringify(clamped));
}

/** When true, the draggable FAB is shown while the panel is closed. */
export function readFabPinned(surface: string): boolean {
  if (typeof window === 'undefined') return false;
  const raw = readWithLegacyFallback(newFabPinnedKey(surface), legacyFabPinnedKey(surface));
  if (raw === '1') return true;
  if (raw === '0') return false;
  if (readLauncherHidden(surface)) return false;
  // Legacy installs that already had a saved FAB position keep the floating button
  if (readFabPosition(surface)) return true;
  return false;
}

export function writeFabPinned(surface: string, pinned: boolean): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(newFabPinnedKey(surface), pinned ? '1' : '0');
  window.localStorage.removeItem(newHiddenKey(surface));
}

/** @deprecated Legacy hide flag — migrated to fabPinned */
export function readLauncherHidden(surface: string): boolean {
  if (typeof window === 'undefined') return false;
  const raw = readWithLegacyFallback(newHiddenKey(surface), legacyHiddenKey(surface));
  return raw === '1';
}

/** @deprecated */
export function writeLauncherHidden(surface: string, hidden: boolean): void {
  if (typeof window === 'undefined') return;
  if (hidden) window.localStorage.setItem(newHiddenKey(surface), '1');
  else window.localStorage.removeItem(newHiddenKey(surface));
  window.dispatchEvent(
    new CustomEvent(CONTEXTUAL_ASSISTANT_VISIBILITY_EVENT, { detail: { surface, hidden } })
  );
}

export type FabPos = { left: number; top: number };

export function readFabPosition(surface: string): FabPos | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = readWithLegacyFallback(newFabPosKey(surface), legacyFabPosKey(surface));
    if (!raw) return null;
    const p = JSON.parse(raw) as FabPos;
    if (typeof p.left !== 'number' || typeof p.top !== 'number') return null;
    return p;
  } catch {
    return null;
  }
}

export function writeFabPosition(surface: string, pos: FabPos): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(newFabPosKey(surface), JSON.stringify(pos));
}

export function clampFabPosition(
  pos: FabPos,
  fabSize: number,
  vw: number,
  vh: number,
  margin: number
): FabPos {
  return {
    left: Math.min(Math.max(margin, pos.left), vw - fabSize - margin),
    top: Math.min(Math.max(margin, pos.top), vh - fabSize - margin),
  };
}

/** Map pathname → surface id for header toggle (longest prefix wins). */
export function contextualAssistantSurfaceFromPathname(pathname: string | null): ContextualAssistantSurface | null {
  if (!pathname) return null;
  if (pathname === '/file-explorer' || pathname.startsWith('/file-explorer/')) {
    return 'file_explorer';
  }
  if (pathname.startsWith('/graph/visual-explorer')) {
    return 'graph_visual_explorer';
  }
  if (
    pathname === '/graph/edit-entities' ||
    pathname.startsWith('/graph/edit-entities/') ||
    pathname === '/graph/edit-relationships' ||
    pathname.startsWith('/graph/edit-relationships/') ||
    pathname === '/graph/edit-filters' ||
    pathname.startsWith('/graph/edit-filters/') ||
    pathname === '/graph/edit-transform' ||
    pathname.startsWith('/graph/edit-transform/')
  ) {
    return 'graph_edit_entities';
  }
  if (pathname.startsWith('/plugins/external-plugins/offline-map')) {
    return 'offline_map';
  }
  if (pathname.startsWith('/plugins/external-plugins/geo-location')) {
    return 'geo_location';
  }
  if (pathname === '/plugins/external-plugins/TTS' || pathname.startsWith('/plugins/external-plugins/TTS/')) {
    return 'tts_plugin';
  }
  if (pathname === '/messages' || pathname.startsWith('/messages/')) {
    return 'messages';
  }
  return null;
}

/** Surface for the current page — contextual id or `general` fallback for header/panel. */
export function resolveNativeAiChatSurface(pathname: string | null): NativeAiChatSurface {
  return contextualAssistantSurfaceFromPathname(pathname) ?? 'general';
}

export const surfaceFromPathname = contextualAssistantSurfaceFromPathname;
export function resolveContextualAssistantSurface(pathname: string | null): ContextualAssistantSurface {
  return contextualAssistantSurfaceFromPathname(pathname) ?? 'general';
}
