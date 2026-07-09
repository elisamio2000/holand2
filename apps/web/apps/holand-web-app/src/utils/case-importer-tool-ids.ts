// ============================================
// Case Importer — UI ↔ Backend tool ID mapping
// UI uses legacy dot notation (file.identify); backend uses snake_case (file_identify).
// ============================================

/** Legacy UI plugin IDs (plugin-selector / PluginId) → backend catalog IDs */
const UI_TO_BACKEND: Record<string, string> = {
  'file.identify': 'file_identify',
  'file.meta': 'file_meta',
  'file.secure': 'file_secure',
  'image.meta': 'image_meta',
  'image.faces': 'image_faces',
  'image.ocr': 'image_ocr',
  'image.describe': 'vision_info',
  'image.search': 'embed_image',
  'text.search': 'graph_extract',
  'face.search': 'analysis_face_cluster',
  'audio.transcribe': 'audio_transcribe',
  'audio.voiceprints': 'audio_voiceprints',
  'embed.face': 'embed_face',
  'embed.text': 'embed_text',
  'embed.imagetext': 'embed_imagetext',
  'analysis.geo_location': 'analysis_geo_location',
};

const BACKEND_TO_UI: Record<string, string> = Object.fromEntries(
  Object.entries(UI_TO_BACKEND).map(([ui, backend]) => [backend, ui])
);

/**
 * Convert a UI plugin ID to the backend tool catalog ID for API requests.
 * Unknown IDs are passed through unchanged (covers backend-only tools shown in settings).
 */
export function toBackendToolId(id: string): string {
  if (UI_TO_BACKEND[id]) return UI_TO_BACKEND[id];
  // Already backend format
  if (id.includes('_') && !id.includes('.')) return id;
  return id.replace(/\./g, '_');
}

/**
 * Convert a backend tool catalog ID to the legacy UI plugin ID for display/state.
 * Backend-only tools (embed_*, audio_voiceprints, …) stay as backend IDs.
 */
export function toUiToolId(id: string): string {
  if (BACKEND_TO_UI[id]) return BACKEND_TO_UI[id];
  if (id.includes('.') && !id.includes('_')) return id;
  return id;
}

/** Map UI allowlist to backend format for PUT/POST bodies. Preserves null/undefined. */
export function toBackendToolAllowlist(
  allowlist: string[] | null | undefined
): string[] | null | undefined {
  if (allowlist === null || allowlist === undefined) return allowlist;
  return allowlist.map(toBackendToolId);
}

/** Map backend allowlist to UI format for component state. Preserves null. */
export function toUiToolAllowlist(allowlist: string[] | null): string[] | null {
  if (allowlist === null) return null;
  return allowlist.map(toUiToolId);
}

/** Map tool_allowlist on outbound import/prefs request objects. */
export function mapRequestToolAllowlist<T extends { tool_allowlist?: string[] | null }>(
  request: T
): T {
  if (!('tool_allowlist' in request) || request.tool_allowlist === undefined) {
    return request;
  }
  return {
    ...request,
    tool_allowlist: toBackendToolAllowlist(request.tool_allowlist) ?? null,
  };
}
