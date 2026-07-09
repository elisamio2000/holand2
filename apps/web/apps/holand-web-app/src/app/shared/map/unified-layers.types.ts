// ============================================
// Unified layer model — one flat list across every map layer source
// (basemap / satellite / catalog / custom / raster / streetview / chat)
// ============================================

import type { SasTileRole } from '@/lib/map-storage-url';

export type UnifiedLayerSource =
  | 'basemap'
  | 'vector-overlay'
  | 'satellite'
  | 'catalog'
  | 'catalog-basemap'
  | 'custom'
  | 'streetview'
  | 'chat';

/** Unified z-order stack — every layer participates in one user-controlled list. */
export type ReorderGroup = 'stack' | null;

/** Colored dot beside the layer name — scope / availability hint. */
export type LayerScopeDot = 'global-ok' | 'global-blocked' | 'personal' | 'ai';

export interface UnifiedLayerItem {
  /** Stable unified id, unique across all sources (source-prefixed). */
  id: string;
  /** Underlying source id (catalog uuid, custom id, chat id, folder path, …). */
  rawId: string;
  name: string;
  source: UnifiedLayerSource;
  /** Short human label for the type badge. */
  kindLabel: string;
  visible: boolean;
  /** 0–1 when the layer supports opacity; undefined otherwise. */
  opacity?: number;
  canReorder: boolean;
  canOpacity: boolean;
  canDelete: boolean;
  /** Reorder group; items only swap within their own group. */
  reorderGroup: ReorderGroup;
  /** Scope indicator dot color + tooltip. */
  scopeDot: LayerScopeDot;
  /** Layer whose PMTiles bundle is bound to the MapLibre style source. */
  isStylePmtilesSource?: boolean;
  /** Storage catalog layer_kind (vector_pmtiles, raster_sas, …). */
  layerKind?: string;
  /** SAS SQLite tile role — drives MapLibre layer id for z-order / opacity. */
  catalogSasRole?: SasTileRole;
}
