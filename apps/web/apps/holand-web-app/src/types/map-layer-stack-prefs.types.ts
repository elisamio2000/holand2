// ============================================
// Per-user unified map layers panel preferences (schema v1)
// Mirrors modules/plugins/map_explorer/layer_stack_prefs/tool.py
// ============================================

export interface LayerStackEntry {
  visible?: boolean;
  opacity?: number;
  /** Structural fields for non-catalog layer kinds (custom/raster/streetview/chat). */
  def?: {
    type?: 'raster' | 'geojson';
    name?: string;
    url?: string;
    /** IndexedDB key for personal layers (no server upload). */
    localId?: string;
    fileName?: string;
  };
  source?: string;
  type?: string;
  folders?: string[];
  name?: string;
  kind?: string;
  /** Chat layers carry a GeoJSON snapshot so they survive a page refresh. */
  geojson?: GeoJSON.FeatureCollection;
}

export interface LayerStackPrefs {
  version: number;
  /** Top-first z-order of unified layer ids (e.g. "catalog:<uuid>", "chat:<id>"). */
  order: string[];
  layers: Record<string, LayerStackEntry>;
}

export const EMPTY_LAYER_STACK_PREFS: LayerStackPrefs = {
  version: 1,
  order: [],
  layers: {},
};
