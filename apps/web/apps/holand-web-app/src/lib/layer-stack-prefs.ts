/**
 * Pure helpers for layer stack prefs load/apply (testable, no React).
 */

import type { MapCoreRef, CustomLayerConfig } from '@/app/shared/map';
import type { RasterLayer, RasterSourceType } from '@/app/shared/map/raster-layers-panel';
import type { MapCatalogLayer } from '@/types/map-layers.types';
import type { LayerStackEntry, LayerStackPrefs } from '@/types/map-layer-stack-prefs.types';
import {
  DEFAULT_CATALOG_OPACITY,
  LAYER_KEY,
  LAYER_STACK_SCHEMA_VERSION,
  parseLayerKey,
} from '@/lib/map-layer-stack-contract';
import { compareCatalogStackOrder } from '@/lib/map-storage-url';

export interface ApplyLayerStackPrefsInput {
  prefs: LayerStackPrefs;
  mapHandle: MapCoreRef | null;
  customLayers: CustomLayerConfig[];
  rasterLayers: RasterLayer[];
  onCustomLayersChange: (layers: CustomLayerConfig[]) => void;
  onRasterLayersChange: (layers: RasterLayer[]) => void;
  onStreetViewFoldersChange: (folders: string[]) => void;
  onShowStreetViewChange: (visible: boolean) => void;
}

/** Restore custom / raster / streetview layers from saved prefs. */
export function applyLayerStackPrefs(input: ApplyLayerStackPrefsInput): void {
  const { prefs } = input;
  const layers = prefs.layers ?? {};

  for (const [key, entry] of Object.entries(layers)) {
    if (!entry || typeof entry !== 'object') continue;
    const parsed = parseLayerKey(key);
    if (!parsed) continue;

    if (parsed.prefix === 'custom') {
      restoreCustomLayer(input, parsed.id, entry);
      continue;
    }

    if (parsed.prefix === 'raster') {
      restoreRasterLayer(input, parsed.id, entry);
      continue;
    }

    if (key === LAYER_KEY.streetview) {
      const folders = Array.isArray(entry.folders)
        ? entry.folders.filter((f): f is string => typeof f === 'string')
        : [];
      if (folders.length) input.onStreetViewFoldersChange(folders);
      if (typeof entry.visible === 'boolean') input.onShowStreetViewChange(entry.visible);
    }
  }
}

function restoreCustomLayer(
  input: ApplyLayerStackPrefsInput,
  id: string,
  entry: LayerStackEntry
): void {
  const def = entry.def;
  if (!def || typeof def !== 'object') return;
  const type = def.type === 'raster' || def.type === 'geojson' ? def.type : null;
  const url = typeof def.url === 'string' ? def.url : '';
  if (!type || !url.trim()) return;

  const name = typeof def.name === 'string' && def.name.trim() ? def.name : id;
  const layer: CustomLayerConfig = {
    id,
    name,
    type,
    url,
    visible: entry.visible !== false,
    opacity: typeof entry.opacity === 'number' ? entry.opacity : 1,
  };

  const existing = input.customLayers.find((l) => l.id === id);
  const next = existing
    ? input.customLayers.map((l) => (l.id === id ? { ...l, ...layer } : l))
    : [...input.customLayers, layer];
  input.onCustomLayersChange(next);

  if (input.mapHandle) {
    const onMap = input.mapHandle.getCustomLayers().find((l) => l.id === id);
    if (!onMap) input.mapHandle.addCustomLayer(layer);
    else {
      input.mapHandle.setCustomLayerVisibility(id, layer.visible);
      if (typeof layer.opacity === 'number') {
        input.mapHandle.setCustomLayerOpacity(id, layer.opacity);
      }
    }
  }
}

function restoreRasterLayer(
  input: ApplyLayerStackPrefsInput,
  id: string,
  entry: LayerStackEntry
): void {
  const source = typeof entry.source === 'string' ? entry.source : '';
  if (!source.trim()) return;
  const type: RasterSourceType = entry.type === 'xyz' ? 'xyz' : 'sas';
  const layer: RasterLayer = {
    id,
    name: id,
    type,
    source,
    visible: entry.visible !== false,
  };
  const existing = input.rasterLayers.find((r) => r.id === id);
  const next = existing
    ? input.rasterLayers.map((r) => (r.id === id ? { ...r, ...layer } : r))
    : [...input.rasterLayers, layer];
  input.onRasterLayersChange(next);
}

export interface BuildDefaultOrderInput {
  catalogLayers: MapCatalogLayer[];
  currentUserId: string;
  customLayerIds: string[];
  rasterLayerIds: string[];
  chatLayerIds: string[];
  hasStreetView: boolean;
  hasVectorOverlay: boolean;
}

/**
 * Default z-order when prefs.order is empty:
 * personal catalog (by sort_order desc) → global catalog → custom/chat → sys layers.
 */
export function buildDefaultOrder(input: BuildDefaultOrderInput): string[] {
  const personal: MapCatalogLayer[] = [];
  const global: MapCatalogLayer[] = [];

  for (const layer of input.catalogLayers) {
    if (
      input.currentUserId &&
      layer.owner_user_id &&
      layer.owner_user_id === input.currentUserId
    ) {
      personal.push(layer);
    } else {
      global.push(layer);
    }
  }

  const byStack = (a: MapCatalogLayer, b: MapCatalogLayer) => compareCatalogStackOrder(a, b);

  const catalogIds = [
    ...personal.sort(byStack).map((l) => LAYER_KEY.catalog(l.id)),
    ...global.sort(byStack).map((l) => LAYER_KEY.catalog(l.id)),
  ];

  const middle = [
    ...input.customLayerIds.map((id) => LAYER_KEY.custom(id)),
    ...input.chatLayerIds.map((id) => LAYER_KEY.chat(id)),
    ...input.rasterLayerIds.map((id) => LAYER_KEY.raster(id)),
  ];

  const sys: string[] = [];
  if (input.hasStreetView) sys.push(LAYER_KEY.streetview);
  if (input.hasVectorOverlay) sys.push(LAYER_KEY.vectorOverlay);

  return [...catalogIds, ...middle, ...sys];
}

export function emptyLayerStackPrefs(): LayerStackPrefs {
  return { version: LAYER_STACK_SCHEMA_VERSION, order: [], layers: {} };
}
