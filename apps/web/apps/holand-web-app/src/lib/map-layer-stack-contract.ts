/**
 * Layer stack prefs contract â€” keep in sync with Holand:
 * modules/plugins/map_explorer/layer_stack_prefs/contract.json
 * modules/plugins/map_explorer/layer_stack_prefs/tool.json (user_pref_binding)
 */

export const LAYER_STACK_TOOL_ID = 'plugin_map_explorer_layer_stack_prefs';

export const LAYER_STACK_SCHEMA_VERSION = 2;

export const SAVE_DEBOUNCE_MS = 500;

export const DEFAULT_CATALOG_OPACITY = 0.85;

export const LAYER_KEY = {
  catalog: (id: string) => `catalog:${id}`,
  custom: (id: string) => `custom:${id}`,
  raster: (id: string) => `raster:${id}`,
  chat: (id: string) => `chat:${id}`,
  streetview: 'sys:streetview',
  vectorOverlay: 'sys:vector-overlay',
} as const;

export function parseLayerKey(key: string): { prefix: string; id: string } | null {
  const idx = key.indexOf(':');
  if (idx <= 0) return null;
  return { prefix: key.slice(0, idx), id: key.slice(idx + 1) };
}

