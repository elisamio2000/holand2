// ============================================
// Native AI chat — header ↔ floating panel bridge
// ============================================

export const NATIVE_AI_CHAT_PANEL_STATE_EVENT = 'native-ai-chat:panel-state';
export const NATIVE_AI_CHAT_TOGGLE_EVENT = 'native-ai-chat:toggle-panel';
export const NATIVE_AI_CHAT_MINIMIZE_EVENT = 'native-ai-chat:minimize-panel';
/** @deprecated Use panel-state / toggle events */
export const NATIVE_AI_CHAT_VISIBILITY_EVENT = 'native-ai-chat:launcher-visibility';
export const NATIVE_AI_CHAT_OPEN_EVENT = 'native-ai-chat:open-panel';

export type NativeAiChatSurface =
  | 'general'
  | 'file_explorer'
  | 'offline_map'
  | 'geo_location'
  | 'tts_plugin'
  | 'graph_edit_entities'
  | 'graph_visual_explorer'
  | 'messages';

export type NativeAiChatAnchorRect = {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
};

export type NativeAiChatPanelStateDetail = {
  surface: string;
  open: boolean;
  fabPinned: boolean;
};

export function dispatchNativeAiChatPanelState(
  surface: string,
  open: boolean,
  fabPinned: boolean
): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent<NativeAiChatPanelStateDetail>(NATIVE_AI_CHAT_PANEL_STATE_EVENT, {
      detail: { surface, open, fabPinned },
    })
  );
}

export function requestNativeAiChatToggle(
  surface: NativeAiChatSurface,
  anchorRect?: NativeAiChatAnchorRect | DOMRect | null
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
    new CustomEvent(NATIVE_AI_CHAT_TOGGLE_EVENT, { detail: { surface, anchorRect: rect } })
  );
}

export function requestNativeAiChatMinimize(surface: NativeAiChatSurface): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(NATIVE_AI_CHAT_MINIMIZE_EVENT, { detail: { surface } })
  );
}

export function requestNativeAiChatOpen(
  surface: NativeAiChatSurface,
  anchorRect?: NativeAiChatAnchorRect | DOMRect | null
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
    new CustomEvent(NATIVE_AI_CHAT_OPEN_EVENT, { detail: { surface, anchorRect: rect } })
  );
}

const fabPinnedKey = (surface: string) => `nativeAiChat.fabPinned.${surface}`;
const hiddenKey = (surface: string) => `nativeAiChat.hidden.${surface}`;
const fabPosKey = (surface: string) => `nativeAiChat.fabPos.${surface}`;
const panelSizeKey = (surface: string) => `nativeAiChat.panelSize.${surface}`;

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
    const raw = window.localStorage.getItem(panelSizeKey(surface));
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
  window.localStorage.setItem(panelSizeKey(surface), JSON.stringify(clamped));
}

/** When true, the draggable FAB is shown while the panel is closed. */
export function readFabPinned(surface: string): boolean {
  if (typeof window === 'undefined') return false;
  const raw = window.localStorage.getItem(fabPinnedKey(surface));
  if (raw === '1') return true;
  if (raw === '0') return false;
  if (readLauncherHidden(surface)) return false;
  // Legacy installs that already had a saved FAB position keep the floating button
  if (readFabPosition(surface)) return true;
  return false;
}

export function writeFabPinned(surface: string, pinned: boolean): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(fabPinnedKey(surface), pinned ? '1' : '0');
  window.localStorage.removeItem(hiddenKey(surface));
}

/** @deprecated Legacy hide flag — migrated to fabPinned */
export function readLauncherHidden(surface: string): boolean {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(hiddenKey(surface)) === '1';
}

/** @deprecated */
export function writeLauncherHidden(surface: string, hidden: boolean): void {
  if (typeof window === 'undefined') return;
  if (hidden) window.localStorage.setItem(hiddenKey(surface), '1');
  else window.localStorage.removeItem(hiddenKey(surface));
  window.dispatchEvent(
    new CustomEvent(NATIVE_AI_CHAT_VISIBILITY_EVENT, { detail: { surface, hidden } })
  );
}

export type FabPos = { left: number; top: number };

export function readFabPosition(surface: string): FabPos | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(fabPosKey(surface));
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
  window.localStorage.setItem(fabPosKey(surface), JSON.stringify(pos));
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
export function surfaceFromPathname(pathname: string | null): NativeAiChatSurface | null {
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
  return surfaceFromPathname(pathname) ?? 'general';
}
