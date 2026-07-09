// ============================================
// MapCore — Reusable offline-capable MapLibre GL map component
// Shared base for geo-location and any future map features
// ============================================
'use client';

import { useEffect, useRef, useCallback, useState, forwardRef, useImperativeHandle } from 'react';
import maplibregl, { type Map as MapLibreMap, type LngLatLike, type FitBoundsOptions, type LngLatBoundsLike, type GeoJSONSource } from 'maplibre-gl';
import { Protocol } from 'pmtiles';
import 'maplibre-gl/dist/maplibre-gl.css';

import { createMapStyle, MAP_SOURCE_ID, SATELLITE_RASTER_LAYER_ID, LABELS_OVERLAY_RASTER_LAYER_ID, WORLD_SOURCE_ID, WORLD_FULL_SOURCE_ID, type MapTheme, type MapStyleOptions, type BasemapStackSlot } from './map-styles';
import { setActiveChatMap, reattachChatLayersToMap } from '@/app/(hydrogen)/map-chat/lib/executors';

// ==========================================
// GeoJSON Source & Layer IDs
// WHY exported: GeoMap (and future consumers) need layer IDs
// for queryRenderedFeatures (box-select, hit-testing).
// ==========================================
export const GEO_SOURCE_ID = 'geo-markers';
export const GEO_LAYER_CLUSTERS = 'geo-clusters';
export const GEO_LAYER_CLUSTER_COUNT = 'geo-cluster-count';
export const GEO_LAYER_UNCLUSTERED = 'geo-unclustered-point';

// Spider source/layers — used when overlapping markers share same coordinates
export const SPIDER_SOURCE_ID = 'geo-spider';
export const SPIDER_LAYER_LEGS = 'geo-spider-legs';
export const SPIDER_LAYER_POINTS = 'geo-spider-points';

// ==========================================
// Types
// ==========================================

export interface MapMarker {
  /** Unique ID for the marker */
  id: string;
  /** Longitude */
  lng: number;
  /** Latitude */
  lat: number;
  /** Optional popup HTML content */
  popupHtml?: string;
  /** Optional custom color (CSS color string) */
  color?: string;
  /** Whether this marker is selected/highlighted */
  selected?: boolean;
}

/**
 * Configuration for a user-supplied custom map layer.
 *
 * Stored in `customLayersRef` inside MapCore and re-applied after every
 * `setStyle()` call (basemap toggle, theme change, etc.) so the layer
 * survives style reloads.
 */
export interface CustomLayerConfig {
  /** Stable unique id — used as prefix for MapLibre source/layer IDs */
  id: string;
  /** Display name shown in the layers panel */
  name: string;
  /**
   * 'raster' — XYZ tile URL template (`{z}/{x}/{y}` pattern) or pmtiles:// blob URL
   * 'geojson' — URL pointing to a GeoJSON FeatureCollection, or use `data` for inline/file
   */
  type: 'raster' | 'geojson';
  /**
   * URL for the layer source.
   * - raster/XYZ: tile template e.g. `https://tile.server/{z}/{x}/{y}.png`
   * - raster/PMTiles file: `pmtiles://blob:http://...` (createObjectURL)
   * - geojson/URL: direct GeoJSON endpoint
   * - geojson/file: empty string (use `data` field instead)
   */
  url: string;
  /**
   * Inline GeoJSON FeatureCollection or Feature — used when the layer was loaded
   * from a local file. Takes precedence over `url` for geojson type.
   * Not set for URL-based layers.
   */
  data?: object;
  /**
   * Original filename when the layer was uploaded from a local file.
   * Used for display instead of the URL (which is empty or a blob URL).
   */
  fileName?: string;
  /** Whether the layer is currently visible */
  visible: boolean;
  /** Opacity 0–1 */
  opacity: number;
  /** Max zoom for XYZ raster sources (MapLibre overzooms above native tiles) */
  maxZoom?: number;
}

export interface MapCoreProps {
  /** PMTiles URL (without pmtiles:// prefix) — local path or HTTP URL */
  tilesUrl?: string;
  /** Map theme: 'light' or 'dark' */
  theme?: MapTheme;
  /** Initial center [lng, lat] — defaults to Middle East center */
  center?: [number, number];
  /** Initial zoom level — defaults to 5 */
  zoom?: number;
  /** Minimum zoom level */
  minZoom?: number;
  /** Maximum zoom level */
  maxZoom?: number;
  /** Array of markers to display */
  markers?: MapMarker[];
  /** Callback when a marker is clicked. Event carries modifier key state for multi-select. */
  onMarkerClick?: (marker: MapMarker, event?: { ctrlKey: boolean; shiftKey: boolean; metaKey: boolean }) => void;
  /**
   * Callback when a cluster is clicked with Ctrl/Shift key.
   * Returns array of marker IDs inside the cluster for multi-select.
   * If not provided, cluster clicks always zoom (default behavior).
   */
  onClusterSelect?: (markerIds: string[]) => void;
  /** Callback when the map view changes (pan/zoom) */
  onViewChange?: (center: [number, number], zoom: number) => void;
  /** Callback when map finishes loading */
  onMapLoad?: (map: MapLibreMap) => void;
  /**
   * Callback fired once the map is ready with the imperative handle.
   *
   * WHY: Next.js `dynamic()` wraps components in a LoadableComponent that does
   * NOT forward refs, so the standard `ref` prop is silently ignored. Using
   * `onReady` lets consumers obtain the MapCoreRef handle without needing the
   * ref to be forwarded through the dynamic wrapper.
   */
  onReady?: (handle: MapCoreRef) => void;
  /**
   * Enable terrain hillshading + 3D elevation exaggeration.
   *
   * WHY off by default: terrain requires fetching external DEM tiles (internet).
   * Toggle at runtime via `mapRef.current.setTerrain(enabled)`.
   */
  showTerrain?: boolean;
  /**
   * Override terrain DEM tile URL. Defaults to AWS Terrarium free tiles.
   * Set to a local tile server URL for fully offline terrain.
   */
  terrainUrl?: string;
  /**
   * World overview tiles URL (Protomaps Basemap schema, z0–z5).
   * When set, a second tile source is added to the style that provides global
   * coverage: ocean fill, country boundaries, and place labels at low zoom.
   *
   * Defaults to NEXT_PUBLIC_WORLD_TILES_URL env var, then derives from the
   * main tiles URL by replacing the filename with 'world-overview.pmtiles'.
   * Set to empty string ('') to explicitly disable world tiles.
   */
  worldTilesUrl?: string;
  /**
   * High-detail global tiles URL (world-full-z14.pmtiles, z0–z14).
   * When set, adds a second world source that activates at zoom 6+ globally.
   * Complements worldTilesUrl (overview, z0–5). Set to '' to disable.
   * Defaults to NEXT_PUBLIC_WORLD_FULL_TILES_URL env var.
   */
  worldFullTilesUrl?: string;
  /**
   * Satellite raster tile URL template (`{z}/{x}/{y}.jpg`).
   * When set, satellite imagery is shown below all vector layers (hybrid view).
   * Set to '' to explicitly disable. Defaults to NEXT_PUBLIC_SATELLITE_URL env var.
   * Download tiles with: scripts/download-satellite-modis.ps1
   */
  satelliteUrl?: string;
  /**
   * Glyph server URL template (`{fontstack}/{range}.pbf`).
   * Required for Arabic/Persian label rendering. Defaults to NEXT_PUBLIC_GLYPHS_URL
   * env var or '/api/tiles/fonts/{fontstack}/{range}.pbf'.
   * PBF files generated by: map-service/scripts/generate_glyphs.py
   */
  glyphsUrl?: string;
  /**
   * Enable spider overlay for co-located markers at max cluster zoom.
   * When false, cluster clicks at max zoom do nothing special.
   * @default true
   */
  spiderEnabled?: boolean;
  /** Callback fired when spider overlay opens (shows co-located markers). */
  onSpiderOpen?: (count: number) => void;
  /** Callback fired when spider overlay is cleared/closed. */
  onSpiderClose?: () => void;
  /** Whether to show navigation controls */
  showNavigation?: boolean;
  /** Whether to show scale control */
  showScale?: boolean;
  /** Additional CSS classes for the container */
  className?: string;
  /** Children rendered over the map (absolute positioned overlays) */
  children?: React.ReactNode;
}

export interface MapCoreRef {
  /** Get the underlying MapLibre map instance */
  getMap: () => MapLibreMap | null;
  /** Fly to a specific location with animation */
  flyTo: (center: [number, number], zoom?: number) => void;
  /** Fit the map to bounds */
  fitBounds: (bounds: LngLatBoundsLike, options?: FitBoundsOptions) => void;
  /** Set the map theme */
  setTheme: (theme: MapTheme) => void;
  /** Toggle terrain hillshade on/off at runtime (preserves current theme) */
  setTerrain: (enabled: boolean, terrainUrl?: string) => void;
  /**
   * Toggle satellite imagery on/off at runtime.
   * Pass a tile URL template to enable, or empty string to disable.
   */
  setSatellite: (satelliteUrl: string, maxZoom?: number) => void;
  /**
   * Toggle the transparent labels/roads overlay (SAS.Planet "both") rendered on
   * top of the satellite imagery. Pass a tile URL template to enable, or empty
   * string to disable.
   */
  setLabelsOverlay: (labelsUrl: string, maxZoom?: number) => void;
  /**
   * Show or hide regional roads/labels (line/symbol layers) without removing the
   * basemap source or satellite imagery underneath.
   */
  setVectorOverlay: (visible: boolean) => void;
  /**
   * Replace the world overview tile source at runtime.
   * Pass empty string to remove the world source from the style.
   */
  setWorldTiles: (worldTilesUrl: string) => void;
  /** Clear the spider overlay if one is currently shown. */
  clearSpider: () => void;
  /**
   * Programmatically spiderfy markers at a given center point.
   * Used to auto-spiderfy co-located selected markers from external callers.
   *
   * @param center - [lng, lat] center point for the spider
   * @param items - Array of marker data to display as spider legs
   */
  spiderfyAt: (center: [number, number], items: Array<{ id: string; color?: string; selected?: boolean }>) => void;
  /**
   * Add a user-supplied custom layer to the map and register it for
   * re-attachment after every style reload.
   * Idempotent — adding the same id twice is a no-op.
   */
  addCustomLayer: (config: CustomLayerConfig) => void;
  /**
   * Remove a user-supplied custom layer from the map and unregister it.
   * The layer will not be re-attached on the next style reload.
   */
  removeCustomLayer: (id: string) => void;
  /** Toggle visibility of a user-supplied custom layer without removing it. */
  setCustomLayerVisibility: (id: string, visible: boolean) => void;
  /** Set opacity (0–1) of a user-supplied custom layer at runtime. */
  setCustomLayerOpacity: (id: string, opacity: number) => void;
  /**
   * Reorder custom layers' z-stack. `orderedIds` is bottom-to-top; any registered
   * layer not listed is kept after the ordered ones. Raster custom layers are moved
   * via MapLibre `moveLayer` so the last id ends up on top (just below regional vector).
   */
  reorderCustomLayers: (orderedIds: string[]) => void;
  /** Update custom layer registry order without changing map z-index (used by unified stack). */
  syncCustomLayerRegistryOrder: (orderedIds: string[]) => void;
  /** MapLibre layer ids for the regional PMTiles vector stack (openmaptiles source). */
  getRegionalStyleLayerIds: () => string[];
  /** World + regional PMTiles MapLibre layers (basemap bundle), bottom-to-top. */
  getCatalogBasemapLayerIds: () => string[];
  /**
   * Apply a full z-order pass. `groups` is top-first (panel order); each entry is
   * the MapLibre layer ids for one unified row, moved as a block.
   */
  reorderStackLayerGroups: (groups: string[][]) => void;
  /** Return a snapshot of all registered custom layers and their current state. */
  getCustomLayers: () => CustomLayerConfig[];
  /**
   * Show or hide the active catalog basemap (world + regional PMTiles layers).
   * Uses layout visibility — no style reload.
   */
  setBaseMapVisible: (visible: boolean) => void;
  /** Set opacity (0–1) for regional PMTiles vector layers (e.g. catalog PMTiles basemap). */
  setRegionalStyleOpacity: (opacity: number) => void;
  /** Set opacity (0–1) for the satellite imagery raster layer. */
  setSatelliteOpacity: (opacity: number) => void;
  /** Set opacity (0–1) for the SAS labels/roads overlay raster layer. */
  setLabelsOverlayOpacity: (opacity: number) => void;
  /** Toggle satellite imagery visibility without rebuilding the style. */
  setSatelliteVisible: (visible: boolean) => void;
  /** Toggle SAS labels overlay visibility without rebuilding the style. */
  setLabelsOverlayVisible: (visible: boolean) => void;
  /**
   * Remember the active catalog PMTiles URL synchronously (before React prop round-trip).
   * Used so setSatellite/setLabelsOverlay style rebuilds keep regional vector tiles.
   */
  setRegionalPmtilesUrl: (url: string) => void;
  /** Rebuild map style from current refs (PMTiles + SAS slots). */
  reloadStyle: () => void;
  /**
   * Set the top-first render order of the basemap / satellite / labels-overlay
   * slots (from the unified panel) and rebuild the style. Each slot renders as one
   * contiguous block, so the panel z-order is honored without scrambling layers.
   */
  setBasemapStackSlots: (slotsTopFirst: BasemapStackSlot[]) => void;
  /**
   * All layer IDs that make up the vector basemap ("layer-vector" panel row) as
   * ONE opaque block: the background paper color + regional PMTiles (openmaptiles)
   * + world overview + world-full layers, in bottom-to-top style order.
   *
   * WHY the whole block (not just openmaptiles): country borders/names visible on
   * the map come from the WORLD tiles, and the beige land is the background layer.
   * They must stack together so the panel z-order treats the basemap uniformly
   * (e.g. all above satellite, or all below) instead of splitting it around imagery.
   */
  getVectorBasemapLayerIds: () => string[];
}

// ==========================================
// Custom Layer Helpers (module-level, no component state)
// ==========================================

/**
 * MapLibre source prefix used for all user-supplied custom layers.
 * Using a consistent prefix makes it easy to identify and guard against
 * accidental collision with other sources in the map style.
 */
const CUSTOM_SOURCE_PREFIX = 'user-layer-';

/**
 * Derive the MapLibre source ID for a custom layer.
 */
function customSourceId(layerId: string): string {
  return `${CUSTOM_SOURCE_PREFIX}${layerId}`;
}

/**
 * Derive all MapLibre layer IDs for a custom layer.
 *
 * Raster → ['user-layer-{id}-raster']
 * GeoJSON → ['user-layer-{id}-fill', 'user-layer-{id}-line', 'user-layer-{id}-circle']
 *
 * WHY three GeoJSON layers: GeoJSON can contain mixed geometry types. Three
 * filter-separated layers (Polygon / LineString / Point) ensure all geometry
 * types render correctly without a schema inspection step.
 */
function customLayerIds(layer: CustomLayerConfig): string[] {
  const src = customSourceId(layer.id);
  const base = src;
  if (layer.type === 'raster') return [`${base}-raster`];
  return [`${base}-fill`, `${base}-line`, `${base}-circle`];
}

/** Style-managed imagery slots driven by the unified layer panel. */
const PANEL_IMAGERY_LAYER_IDS = new Set([
  SATELLITE_RASTER_LAYER_ID,
  LABELS_OVERLAY_RASTER_LAYER_ID,
]);

function isBasemapStyleSource(source: unknown): boolean {
  if (typeof source !== 'string') return false;
  return (
    source === MAP_SOURCE_ID ||
    source === 'openmaptiles' ||
    source === WORLD_SOURCE_ID ||
    source === WORLD_FULL_SOURCE_ID
  );
}

/** Layers that must stay above user stack (markers, chat). */
function isProtectedTopLayerId(id: string): boolean {
  return (
    id.startsWith('geo-') ||
    id.startsWith('geo-spider') ||
    id.startsWith('user-layer-chat-')
  );
}

function collectCatalogBasemapLayerIds(map: MapLibreMap): string[] {
  const out: string[] = [];
  for (const layer of map.getStyle()?.layers ?? []) {
    if (layer.id === 'background') continue;
    if (PANEL_IMAGERY_LAYER_IDS.has(layer.id)) continue;
    if (layer.id.startsWith('user-layer-')) continue;
    if (isProtectedTopLayerId(layer.id)) continue;
    if ('source' in layer && isBasemapStyleSource(layer.source)) {
      out.push(layer.id);
    }
  }
  return out;
}

function findStackCeilingLayerId(map: MapLibreMap): string | undefined {
  for (const layer of map.getStyle()?.layers ?? []) {
    if (isProtectedTopLayerId(layer.id)) return layer.id;
  }
  return undefined;
}

/** Apply panel z-order (groups are top-first). Each group moves as one block. */
function applyStackLayerOrder(map: MapLibreMap, groups: string[][]): void {
  if (!groups.length) return;

  const bottomToTop: string[] = [];
  for (const group of [...groups].reverse()) {
    for (const layerId of group) {
      if (map.getLayer(layerId) && !bottomToTop.includes(layerId)) {
        bottomToTop.push(layerId);
      }
    }
  }
  if (!bottomToTop.length) return;

  const ceilingId = findStackCeilingLayerId(map);

  for (let i = 0; i < bottomToTop.length; i++) {
    const layerId = bottomToTop[i];
    const above = bottomToTop[i + 1];
    try {
      if (above && map.getLayer(above)) {
        map.moveLayer(layerId, above);
      } else if (ceilingId && map.getLayer(ceilingId)) {
        map.moveLayer(layerId, ceilingId);
      } else {
        map.moveLayer(layerId);
      }
    } catch (e) {
      console.warn('[MapCore] applyStackLayerOrder moveLayer:', e);
    }
  }
}

function applyRegionalVectorVisibility(map: MapLibreMap, visible: boolean): void {
  const vis = visible ? 'visible' : 'none';
  for (const layer of map.getStyle()?.layers ?? []) {
    if (!('source' in layer)) continue;
    if (!isBasemapStyleSource(layer.source)) continue;
    if (layer.type !== 'line' && layer.type !== 'symbol' && layer.type !== 'circle') continue;
    try {
      map.setLayoutProperty(layer.id, 'visibility', vis);
    } catch {
      // Layer may not support layout visibility.
    }
  }
}

/** Show/hide world + regional PMTiles layers together (panel visibility). */
function applyCatalogBasemapVisibility(map: MapLibreMap, visible: boolean): void {
  const vis = visible ? 'visible' : 'none';
  for (const layerId of collectCatalogBasemapLayerIds(map)) {
    try {
      map.setLayoutProperty(layerId, 'visibility', vis);
    } catch {
      // Layer may not support layout visibility.
    }
  }
  // Background "paper color" belongs to the vector basemap row — hide it with the
  // rest so turning the basemap off actually reveals satellite/empty canvas
  // instead of leaving an opaque beige fill covering everything below.
  try {
    if (map.getLayer('background')) {
      map.setLayoutProperty('background', 'visibility', vis);
    }
  } catch {
    // Background may not support layout visibility.
  }
}

function applyRegionalStyleOpacity(map: MapLibreMap, opacity: number): void {
  const op = Math.max(0, Math.min(1, opacity));
  for (const layer of map.getStyle()?.layers ?? []) {
    // The background "paper color" is part of the vector basemap block, so it
    // must fade with the same opacity — otherwise lowering the basemap opacity
    // can't reveal satellite imagery underneath (the beige would stay solid).
    if (layer.type === 'background') {
      try {
        map.setPaintProperty(layer.id, 'background-opacity', op);
      } catch {
        // Layer may omit the paint property.
      }
      continue;
    }
    if (!('source' in layer)) continue;
    if (!isBasemapStyleSource(layer.source)) continue;
    if (PANEL_IMAGERY_LAYER_IDS.has(layer.id)) continue;
    const id = layer.id;
    try {
      switch (layer.type) {
        case 'fill':
          map.setPaintProperty(id, 'fill-opacity', op);
          break;
        case 'line':
          map.setPaintProperty(id, 'line-opacity', op);
          break;
        case 'symbol':
          map.setPaintProperty(id, 'text-opacity', op);
          map.setPaintProperty(id, 'icon-opacity', op);
          map.setPaintProperty(id, 'text-halo-opacity', op);
          break;
        case 'circle':
          map.setPaintProperty(id, 'circle-opacity', op);
          break;
        case 'fill-extrusion':
          map.setPaintProperty(id, 'fill-extrusion-opacity', op);
          break;
        case 'raster':
          map.setPaintProperty(id, 'raster-opacity', op);
          break;
        default:
          break;
      }
    } catch {
      // Some layers omit the paint property.
    }
  }
}

function applySatelliteOpacity(map: MapLibreMap, opacity: number): void {
  const op = Math.max(0, Math.min(1, opacity));
  if (!map.getLayer(SATELLITE_RASTER_LAYER_ID)) return;
  try {
    map.setPaintProperty(SATELLITE_RASTER_LAYER_ID, 'raster-opacity', op);
  } catch {
    // Layer may not expose raster-opacity yet.
  }
}

function applySatelliteVisibility(map: MapLibreMap, visible: boolean): void {
  if (!map.getLayer(SATELLITE_RASTER_LAYER_ID)) return;
  try {
    map.setLayoutProperty(SATELLITE_RASTER_LAYER_ID, 'visibility', visible ? 'visible' : 'none');
  } catch {
    // Layer may not support layout visibility.
  }
}

function applyLabelsOverlayOpacity(map: MapLibreMap, opacity: number): void {
  const op = Math.max(0, Math.min(1, opacity));
  if (!map.getLayer(LABELS_OVERLAY_RASTER_LAYER_ID)) return;
  try {
    map.setPaintProperty(LABELS_OVERLAY_RASTER_LAYER_ID, 'raster-opacity', op);
  } catch {
    // Layer may not expose raster-opacity yet.
  }
}

function applyLabelsOverlayVisibility(map: MapLibreMap, visible: boolean): void {
  if (!map.getLayer(LABELS_OVERLAY_RASTER_LAYER_ID)) return;
  try {
    map.setLayoutProperty(LABELS_OVERLAY_RASTER_LAYER_ID, 'visibility', visible ? 'visible' : 'none');
  } catch {
    // Layer may not support layout visibility.
  }
}

/**
 * Re-attach every registered custom layer to `map`.
 * Idempotent — skips sources/layers that already exist.
 * Call this from the persistent `style.load` listener so custom layers
 * survive every `setStyle()` call (theme switch, satellite/terrain toggle).
 */
function reattachCustomLayers(map: MapLibreMap, customLayers: CustomLayerConfig[]): void {
  for (const layer of customLayers) {
    const srcId = customSourceId(layer.id);
    const vis = layer.visible ? 'visible' : 'none';
    const op = layer.opacity;

    // --- Source ---
    if (!map.getSource(srcId)) {
      try {
        if (layer.type === 'raster') {
          // PMTiles files uploaded locally use a pmtiles:// blob URL — the pmtiles Protocol
          // handler interprets these via `url` (TileJSON) not `tiles` (XYZ template).
          if (layer.url.startsWith('pmtiles://')) {
            map.addSource(srcId, { type: 'raster', url: layer.url, tileSize: 256 });
          } else {
            const src: maplibregl.RasterSourceSpecification = {
              type: 'raster',
              tiles: [layer.url],
              tileSize: 256,
            };
            if (layer.maxZoom != null) src.maxzoom = layer.maxZoom;
            map.addSource(srcId, src);
          }
        } else {
          // Use inline GeoJSON data when the layer was loaded from a local file;
          // fall back to URL for remote GeoJSON endpoints.
          map.addSource(srcId, {
            type: 'geojson',
            data: (layer.data ?? layer.url) as any,
          });
        }
      } catch (err) {
        console.warn('[MapCore] reattachCustomLayers addSource failed:', { id: layer.id, err });
        continue;
      }
    }

    // --- Layers ---
    if (layer.type === 'raster') {
      const lId = `${srcId}-raster`;
      if (!map.getLayer(lId)) {
        try {
          const ceilingId = findStackCeilingLayerId(map);
          map.addLayer({
            id: lId,
            type: 'raster',
            source: srcId,
            layout: { visibility: vis },
            paint: { 'raster-opacity': op },
          } as maplibregl.LayerSpecification, ceilingId);
        } catch (err) {
          console.warn('[MapCore] reattachCustomLayers addLayer raster failed:', { id: layer.id, err });
        }
      }
    } else {
      // Fill — polygons
      const fillId = `${srcId}-fill`;
      if (!map.getLayer(fillId)) {
        try {
          map.addLayer({
            id: fillId, type: 'fill', source: srcId,
            filter: ['==', '$type', 'Polygon'],
            layout: { visibility: vis },
            paint: { 'fill-color': '#4e36f5', 'fill-opacity': op * 0.35 },
          } as maplibregl.LayerSpecification);
        } catch (err) {
          console.warn('[MapCore] reattachCustomLayers addLayer fill failed:', { id: layer.id, err });
        }
      }
      // Line — lines + polygon outlines
      const lineId = `${srcId}-line`;
      if (!map.getLayer(lineId)) {
        try {
          map.addLayer({
            id: lineId, type: 'line', source: srcId,
            layout: { visibility: vis },
            paint: { 'line-color': '#4e36f5', 'line-width': 2, 'line-opacity': op },
          } as maplibregl.LayerSpecification);
        } catch (err) {
          console.warn('[MapCore] reattachCustomLayers addLayer line failed:', { id: layer.id, err });
        }
      }
      // Circle — points
      const circleId = `${srcId}-circle`;
      if (!map.getLayer(circleId)) {
        try {
          map.addLayer({
            id: circleId, type: 'circle', source: srcId,
            filter: ['==', '$type', 'Point'],
            layout: { visibility: vis },
            paint: {
              'circle-color': '#4e36f5',
              'circle-radius': 5,
              'circle-opacity': op,
              'circle-stroke-width': 1.5,
              'circle-stroke-color': 'rgba(255,255,255,0.9)',
            },
          } as maplibregl.LayerSpecification);
        } catch (err) {
          console.warn('[MapCore] reattachCustomLayers addLayer circle failed:', { id: layer.id, err });
        }
      }
    }
  }
}

// ==========================================
// PMTiles Protocol Registration (singleton)
// ==========================================

let protocolRegistered = false;

/**
 * Register PMTiles protocol with MapLibre GL, and set the RTL text plugin.
 * Only runs once globally (singleton pattern).
 *
 * WHY PMTiles: Must be registered before any map loads; re-registering causes errors.
 * WHY RTL plugin: MapLibre GL's `localIdeographFontFamily` only handles CJK characters.
 * Arabic and Persian (BiDi) text requires the mapbox-gl-rtl-text plugin to apply
 * the Unicode bidirectional algorithm and Arabic shaping. Without it, Persian/Arabic
 * characters appear in visual display order (reversed).
 *
 * The plugin is loaded as a web worker importScript from /public/, so it works fully
 * offline. `deferred: true` means it loads on first text rendering, not at startup.
 */
function registerPmtilesProtocol() {
  if (protocolRegistered) return;

  const protocol = new Protocol();
  maplibregl.addProtocol('pmtiles', protocol.tile);

  // Register RTL text plugin for Arabic/Persian label rendering.
  // Status guard prevents the "cannot be called multiple times" error
  // that would otherwise occur when multiple map instances initialize.
  if (maplibregl.getRTLTextPluginStatus() === 'unavailable') {
    maplibregl.setRTLTextPlugin(
      '/mapbox-gl-rtl-text.js',
      /* deferred */ true
    ).catch((err: unknown) => {
      console.warn('[MapCore] RTL text plugin failed to load:', err);
    });
    console.info('[MapCore] RTL text plugin registered (deferred)');
  }

  protocolRegistered = true;
  console.info('[MapCore] PMTiles protocol registered');
}

// ==========================================
// Default Configuration
// ==========================================

/** Default center: roughly center of Middle East coverage area */
const DEFAULT_CENTER: [number, number] = [51.3890, 32.0];
const DEFAULT_ZOOM = 5;
const DEFAULT_MIN_ZOOM = 0;
const DEFAULT_MAX_ZOOM = 18;

/**
 * Rewrite localhost tile URLs for cross-machine browser access.
 *
 * WHY: NEXT_PUBLIC_* URLs are baked into the client bundle. If a URL contains
 * localhost, remote browsers will point to themselves instead of the tile host.
 * This helper keeps protocol/port/path and replaces only the hostname.
 */
function resolveClientReachableUrl(url: string): string {
  if (typeof window === 'undefined') return url;
  try {
    const parsed = new URL(url, window.location.origin);
    const isLocalHost = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
    if (isLocalHost) {
      parsed.hostname = window.location.hostname;
    }
    // WHY restorePlaceholders: `new URL()` percent-encodes the literal
    // `{z}/{x}/{y}/{fontstack}/{range}` placeholders that MapLibre needs
    // verbatim to substitute tile coordinates. Without this, raster sources
    // (satellite, terrain) and glyph fetches request `%7Bz%7D` paths and 404.
    return restoreTileUrlPlaceholders(parsed.toString());
  } catch {
    return url;
  }
}

/**
 * Restore MapLibre tile/glyph URL placeholders after URL normalization.
 * `new URL()` percent-encodes `{` and `}`, but MapLibre requires the literal
 * `{z}`, `{x}`, `{y}`, `{fontstack}`, `{range}` tokens to substitute values.
 */
function restoreTileUrlPlaceholders(url: string): string {
  return url
    .replace(/%7B/gi, '{')
    .replace(/%7D/gi, '}');
}

/**
 * Resolve the regional PMTiles URL based on environment.
 *
 * Priority:
 * 1. Explicit prop value
 * 2. NEXT_PUBLIC_PMTILES_URL env var (legacy override)
 * 3. Empty — user must register basemap in catalog (no hardcoded default)
 */
function resolveTilesUrl(propUrl?: string): string {
  // Explicit prop (including '') — catalog basemap mode; do not fall back to env.
  if (propUrl !== undefined) {
    return propUrl ? resolveClientReachableUrl(propUrl) : '';
  }
  if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_PMTILES_URL) {
    return resolveClientReachableUrl(process.env.NEXT_PUBLIC_PMTILES_URL);
  }
  return '';
}

function isCatalogBasemapUrl(url: string): boolean {
  return (
    url.includes('/api/map-storage/') ||
    url.includes('/map/layers/')
  );
}

/**
 * Resolve the world overview tiles URL.
 *
 * Priority:
 * 1. Explicit prop value ('' means "disabled")
 * 2. NEXT_PUBLIC_WORLD_TILES_URL env var
 * 3. Derived from the main tiles URL (replaces filename with world-overview.pmtiles)
 * 4. Returns undefined when nothing configured → world source not added to style
 *
 * WHY derive from main URL: if you run the tile server at localhost:8765,
 * dropping world-overview.pmtiles in the same folder makes it auto-discoverable.
 */
function resolveWorldTilesUrl(propUrl?: string, mainTilesUrl?: string): string | undefined {
  if (propUrl === '') return undefined;
  if (propUrl) return resolveClientReachableUrl(propUrl);
  if (mainTilesUrl && isCatalogBasemapUrl(mainTilesUrl)) return undefined;

  if (typeof window !== 'undefined') {
    if (process.env.NEXT_PUBLIC_WORLD_TILES_URL) {
      return resolveClientReachableUrl(process.env.NEXT_PUBLIC_WORLD_TILES_URL);
    }
    if (mainTilesUrl) {
      return resolveClientReachableUrl(
        mainTilesUrl.replace(/[^/]+\.pmtiles$/i, 'world-overview.pmtiles')
      );
    }
  }
  return undefined;
}

/**
 * Resolve the world-full detailed tiles URL.
 *
 * Priority:
 * 1. Explicit prop value ('' means "disabled")
 * 2. NEXT_PUBLIC_WORLD_FULL_TILES_URL env var
 * 3. Returns undefined when nothing configured → world-full source not added
 */
function resolveWorldFullTilesUrl(propUrl?: string, mainTilesUrl?: string): string | undefined {
  if (propUrl === '') return undefined;
  if (propUrl) return resolveClientReachableUrl(propUrl);
  if (mainTilesUrl && isCatalogBasemapUrl(mainTilesUrl)) return undefined;
  if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_WORLD_FULL_TILES_URL) {
    return resolveClientReachableUrl(process.env.NEXT_PUBLIC_WORLD_FULL_TILES_URL);
  }
  return undefined;
}

/**
 * Resolve the satellite raster tile URL template.
 *
 * Priority:
 * 1. Explicit prop value ('' means "disabled")
 * 2. NEXT_PUBLIC_SATELLITE_URL env var
 * 3. Returns undefined when nothing configured → satellite source not added
 */
function resolveSatelliteUrl(propUrl?: string): string | undefined {
  if (propUrl === '') return undefined;
  if (propUrl) return resolveClientReachableUrl(propUrl);
  if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_SATELLITE_URL) {
    return resolveClientReachableUrl(process.env.NEXT_PUBLIC_SATELLITE_URL);
  }
  return undefined;
}

/**
 * Resolve the glyph server URL template.
 *
 * Priority:
 * 1. Explicit prop value ('' means "use library default / disable custom glyphs")
 * 2. NEXT_PUBLIC_GLYPHS_URL env var
 * 3. Falls back to '/api/tiles/fonts/{fontstack}/{range}.pbf' (tile proxy)
 *
 * WHY relative path default: the /api/tiles/ Next.js proxy forwards requests to
 * the tile server, so PBF files in map-service/tiles/fonts/ are always reachable
 * without exposing port 8765 to the client.
 */
function resolveGlyphsUrl(propUrl?: string, mainTilesUrl?: string): string {
  if (propUrl === '') return '';
  if (propUrl) return propUrl;
  if (mainTilesUrl && isCatalogBasemapUrl(mainTilesUrl)) {
    return 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf';
  }
  if (process.env.NEXT_PUBLIC_GLYPHS_URL) return process.env.NEXT_PUBLIC_GLYPHS_URL;
  return 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf';
}

// ==========================================
// Component
// ==========================================

/**
 * MapCore — Reusable offline-capable vector map component.
 *
 * Uses MapLibre GL JS with PMTiles for fully offline map rendering.
 * Generates tiles from OpenMapTiles schema (tilemaker output).
 *
 * Features:
 * - Offline-first: loads tiles from local PMTiles file
 * - Light/dark theme support with smooth switching
 * - Marker system with popups and selection state
 * - Navigation + scale controls
 * - Imperative API via ref (flyTo, fitBounds, setTheme)
 * - Designed as shared component for all map-related features
 *
 * @requires maplibre-gl — npm installed (NOT CDN)
 * @requires pmtiles — npm installed
 * @requires map-styles.ts — OpenMapTiles-compatible style definitions
 *
 * @example
 * ```tsx
 * <MapCore
 *   tilesUrl="/tiles/middle-east.pmtiles"
 *   theme="dark"
 *   center={[51.389, 35.689]}
 *   zoom={10}
 *   markers={[{ id: '1', lng: 51.389, lat: 35.689, popupHtml: '<b>Tehran</b>' }]}
 *   onMarkerClick={(m) => console.log('Clicked:', m.id)}
 * />
 * ```
 */
const MapCore = forwardRef<MapCoreRef, MapCoreProps>(function MapCore(
  {
    tilesUrl,
    theme = 'light',
    center = DEFAULT_CENTER,
    zoom = DEFAULT_ZOOM,
    minZoom = DEFAULT_MIN_ZOOM,
    maxZoom = DEFAULT_MAX_ZOOM,
    markers = [],
    onMarkerClick,
    onClusterSelect,
    onViewChange,
    onMapLoad,
    onReady,
    showTerrain = false,
    terrainUrl,
    worldTilesUrl,
    worldFullTilesUrl,
    satelliteUrl,
    glyphsUrl,
    spiderEnabled = true,
    onSpiderOpen,
    onSpiderClose,
    showNavigation = true,
    showScale = true,
    className,
    children,
  },
  ref
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  // WHY ref for onMarkerClick: Layer click handlers are registered once on map load.
  // Using a ref ensures the handler always calls the latest callback without
  // needing to re-register event listeners when the prop changes.
  const onMarkerClickRef = useRef(onMarkerClick);
  onMarkerClickRef.current = onMarkerClick;
  const onClusterSelectRef = useRef(onClusterSelect);
  onClusterSelectRef.current = onClusterSelect;
  // WHY refs for spider callbacks: same reason as onMarkerClickRef — event
  // handlers are registered once on map load, refs avoid stale closures.
  const spiderEnabledRef = useRef(spiderEnabled);
  spiderEnabledRef.current = spiderEnabled;
  const onSpiderOpenRef = useRef(onSpiderOpen);
  onSpiderOpenRef.current = onSpiderOpen;
  const onSpiderCloseRef = useRef(onSpiderClose);
  onSpiderCloseRef.current = onSpiderClose;
  // WHY ref for markers data: The theme-change handler needs to re-populate
  // the GeoJSON source after style reload. A ref avoids stale closure values.
  const markersDataRef = useRef<MapMarker[]>(markers);
  markersDataRef.current = markers;
  const themeRef = useRef<MapTheme>(theme);
  // WHY styleOptionsRef: keeps terrain/style options always current for use in callbacks
  // and event handlers that would otherwise capture stale closure values.
  // worldTilesUrl is resolved once and stays stable (derived from env at mount time).
  const resolvedMainUrl = resolveTilesUrl(tilesUrl);
  const resolvedWorldUrl = resolveWorldTilesUrl(worldTilesUrl, resolvedMainUrl);
  const resolvedWorldFullUrl = resolveWorldFullTilesUrl(worldFullTilesUrl, resolvedMainUrl);
  const resolvedSatelliteUrl = resolveSatelliteUrl(satelliteUrl);
  const resolvedGlyphsUrl = resolveGlyphsUrl(glyphsUrl, resolvedMainUrl);
  const styleOptionsRef = useRef<MapStyleOptions>({
    showTerrain,
    terrainUrl,
    worldTilesUrl: resolvedWorldUrl,
    worldFullTilesUrl: resolvedWorldFullUrl,
    satelliteUrl: resolvedSatelliteUrl,
    glyphsUrl: resolvedGlyphsUrl,
    catalogBasemapVisible: true,
  });
  const tilesUrlRef = useRef(tilesUrl);
  const worldTilesUrlRef = useRef(worldTilesUrl);
  const worldFullTilesUrlRef = useRef(worldFullTilesUrl);
  /** Last non-empty regional PMTiles URL — survives setSatellite style rebuilds before prop sync. */
  const lastRegionalPmtilesUrlRef = useRef('');
  /** Skip redundant map.setStyle() when world/regional tile URLs did not change. */
  const lastAppliedStyleKeyRef = useRef('');
  tilesUrlRef.current = tilesUrl;
  worldTilesUrlRef.current = worldTilesUrl;
  worldFullTilesUrlRef.current = worldFullTilesUrl;
  const resolvedMainForRef = resolveTilesUrl(tilesUrl);
  if (resolvedMainForRef) {
    lastRegionalPmtilesUrlRef.current = resolvedMainForRef;
  }
  styleOptionsRef.current = { ...styleOptionsRef.current, showTerrain, terrainUrl };
  // WHY stackGroupsRef: re-apply unified panel z-order after every style reload.
  const stackGroupsRef = useRef<string[][]>([]);
  // WHY selfRef: stores the imperative handle so onReady can deliver it once
  // the map loads — bypasses the dynamic() ref-forwarding gap.
  const selfRef = useRef<MapCoreRef | null>(null);
  // WHY clearSpiderRef: The clearSpider function is created inside map.on('load'),
  // but the imperative API (buildHandle) and spiderEnabled effect need it too.
  // Storing in a ref bridges the closure scope.
  const clearSpiderRef = useRef<() => void>(() => {});
  // WHY showSpiderRef: Same pattern — showSpider is defined inside map.on('load'),
  // but the imperative spiderfyAt method needs to call it from buildHandle().
  const showSpiderRef = useRef<(center: [number, number], leaves: GeoJSON.Feature[]) => void>(() => {});
  // WHY customLayersRef: persists user-supplied layers across setStyle() calls.
  // Stored as a ref (not state) so changes don't trigger a component re-render;
  // the map is updated imperatively. The ref always holds the current snapshot,
  // which the persistent `style.load` listener reads when re-attaching layers.
  const customLayersRef = useRef<CustomLayerConfig[]>([]);
  const mapReadyRef = useRef(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [tileError, setTileError] = useState(false);

  // Keep theme ref in sync
  themeRef.current = theme;

  // ==========================================
  // Imperative API
  // ==========================================

  /**
   * Build the MapCoreRef handle. Stored in both the React ref (for forwardRef consumers)
   * and selfRef (for onReady delivery after map load).
   *
   * WHY a factory function: selfRef is populated inside the map 'load' event so that
   * onReady() receives the same object as the React ref without duplicating the definitions.
   */
  function buildHandle(): MapCoreRef {
    /**
     * Apply current style options to the map AND re-add the GeoJSON marker
     * source + cluster layers once the new style finishes loading.
     *
     * WHY: `map.setStyle()` replaces the entire style object, which removes
     * every custom source/layer we added (markers, clusters, spider). Without
     * re-adding them after each basemap toggle, all visible markers vanish
     * permanently. We listen for the one-shot 'style.load' event so the
     * re-add happens at the earliest safe moment.
     */
    const applyStyleAndPreserveMarkers = () => {
      const map = mapRef.current;
      if (!map) return;
      const resolvedUrl =
        resolveTilesUrl(tilesUrlRef.current) || lastRegionalPmtilesUrlRef.current;
      const resolvedWorldUrl = resolveWorldTilesUrl(
        worldTilesUrlRef.current,
        resolvedUrl
      );
      const resolvedWorldFullUrl = resolveWorldFullTilesUrl(
        worldFullTilesUrlRef.current,
        resolvedUrl
      );
      styleOptionsRef.current = {
        ...styleOptionsRef.current,
        worldTilesUrl: resolvedWorldUrl,
        worldFullTilesUrl: resolvedWorldFullUrl,
      };
      const style = createMapStyle(resolvedUrl, themeRef.current, styleOptionsRef.current);
      map.setStyle(style);
      // WHY no `once` here: rapid toggles call setStyle() multiple times in
      // quick succession. The persistent `'style.load'` listener installed at
      // map init handles every reload reliably; queueing per-call once()
      // handlers can race when MapLibre interrupts a pending load.
    };

    return {
      getMap: () => mapRef.current,

      flyTo: (targetCenter: [number, number], targetZoom?: number) => {
        if (!mapRef.current) return;
        console.info('[MapCore] flyTo:', { center: targetCenter, zoom: targetZoom });
        mapRef.current.flyTo({
          center: targetCenter as LngLatLike,
          zoom: targetZoom ?? mapRef.current.getZoom(),
          duration: 1200,
        });
      },

      fitBounds: (bounds: LngLatBoundsLike, options?: FitBoundsOptions) => {
        if (!mapRef.current) return;
        console.info('[MapCore] fitBounds');
        mapRef.current.fitBounds(bounds, { padding: 40, ...options });
      },

      setTheme: (newTheme: MapTheme) => {
        if (!mapRef.current) return;
        themeRef.current = newTheme;
        applyStyleAndPreserveMarkers();
        console.info('[MapCore] Theme changed:', { theme: newTheme });
      },

      setTerrain: (enabled: boolean, url?: string) => {
        if (!mapRef.current) return;
        styleOptionsRef.current = {
          ...styleOptionsRef.current,
          showTerrain: enabled,
          terrainUrl: url ?? styleOptionsRef.current.terrainUrl,
        };
        applyStyleAndPreserveMarkers();
        console.info('[MapCore] Terrain toggled:', { enabled });
      },

      setSatellite: (url: string, maxZoom?: number) => {
        if (!mapRef.current) return;
        const newSatUrl = url === '' ? undefined : url;
        const prev = styleOptionsRef.current;
        if (
          prev.satelliteUrl === newSatUrl &&
          (newSatUrl ? prev.satelliteMaxZoom === maxZoom : true)
        ) {
          return;
        }
        styleOptionsRef.current = {
          ...styleOptionsRef.current,
          satelliteUrl: newSatUrl,
          satelliteMaxZoom: newSatUrl ? maxZoom : undefined,
          satelliteVisible: newSatUrl ? prev.satelliteVisible ?? true : false,
        };
        applyStyleAndPreserveMarkers();
        console.info('[MapCore] Satellite toggled:', { satelliteUrl: newSatUrl, maxZoom });
      },

      setLabelsOverlay: (url: string, maxZoom?: number) => {
        if (!mapRef.current) return;
        const newUrl = url === '' ? undefined : url;
        const prev = styleOptionsRef.current;
        if (
          prev.labelsOverlayUrl === newUrl &&
          (newUrl ? prev.labelsOverlayMaxZoom === maxZoom : true)
        ) {
          return;
        }
        styleOptionsRef.current = {
          ...styleOptionsRef.current,
          labelsOverlayUrl: newUrl,
          labelsOverlayMaxZoom: newUrl ? maxZoom : undefined,
          labelsOverlayVisible: newUrl ? prev.labelsOverlayVisible ?? true : false,
        };
        applyStyleAndPreserveMarkers();
        console.info('[MapCore] Labels overlay toggled:', { labelsOverlayUrl: newUrl, maxZoom });
      },

      setVectorOverlay: (visible: boolean) => {
        if (!mapRef.current) return;
        styleOptionsRef.current = {
          ...styleOptionsRef.current,
          hideRegionalVector: !visible,
        };
        applyRegionalVectorVisibility(mapRef.current, visible);
        console.info('[MapCore] Vector overlay:', { visible });
      },

      setWorldTiles: (url: string) => {
        if (!mapRef.current) return;
        const newWorldUrl = url === '' ? undefined : url;
        styleOptionsRef.current = { ...styleOptionsRef.current, worldTilesUrl: newWorldUrl };
        applyStyleAndPreserveMarkers();
        console.info('[MapCore] World tiles updated:', { worldTilesUrl: newWorldUrl });
      },

      clearSpider: () => {
        clearSpiderRef.current();
      },

      spiderfyAt: (center: [number, number], items: Array<{ id: string; color?: string; selected?: boolean }>) => {
        const features: GeoJSON.Feature[] = items.map((item) => ({
          type: 'Feature' as const,
          properties: {
            id: item.id,
            color: item.color || '#111111',
            selected: item.selected || false,
          },
          geometry: {
            type: 'Point' as const,
            coordinates: center,
          },
        }));
        showSpiderRef.current(center, features);
      },

      addCustomLayer: (config: CustomLayerConfig) => {
        // Idempotent — ignore if id already registered
        if (customLayersRef.current.some((l) => l.id === config.id)) return;
        customLayersRef.current = [...customLayersRef.current, config];
        const map = mapRef.current;
        if (map) reattachCustomLayers(map, customLayersRef.current);
        console.info('[MapCore] Custom layer added:', { id: config.id, name: config.name, type: config.type });
      },

      removeCustomLayer: (id: string) => {
        const map = mapRef.current;
        const layer = customLayersRef.current.find((l) => l.id === id);
        if (layer && map) {
          for (const lId of customLayerIds(layer)) {
            if (map.getLayer(lId)) {
              try { map.removeLayer(lId); } catch (e) { console.warn('[MapCore] removeCustomLayer removeLayer:', e); }
            }
          }
          const srcId = customSourceId(id);
          if (map.getSource(srcId)) {
            try { map.removeSource(srcId); } catch (e) { console.warn('[MapCore] removeCustomLayer removeSource:', e); }
          }
        }
        customLayersRef.current = customLayersRef.current.filter((l) => l.id !== id);
        console.info('[MapCore] Custom layer removed:', { id });
      },

      setCustomLayerVisibility: (id: string, visible: boolean) => {
        customLayersRef.current = customLayersRef.current.map((l) =>
          l.id === id ? { ...l, visible } : l
        );
        const map = mapRef.current;
        const layer = customLayersRef.current.find((l) => l.id === id);
        if (!map || !layer) return;
        const vis = visible ? 'visible' : 'none';
        for (const lId of customLayerIds(layer)) {
          if (map.getLayer(lId)) {
            try { map.setLayoutProperty(lId, 'visibility', vis); } catch {}
          }
        }
        console.info('[MapCore] Custom layer visibility:', { id, visible });
      },

      setCustomLayerOpacity: (id: string, opacity: number) => {
        customLayersRef.current = customLayersRef.current.map((l) =>
          l.id === id ? { ...l, opacity } : l
        );
        const map = mapRef.current;
        const layer = customLayersRef.current.find((l) => l.id === id);
        if (!map || !layer) return;
        const srcId = customSourceId(id);
        if (layer.type === 'raster') {
          const lId = `${srcId}-raster`;
          if (map.getLayer(lId)) { try { map.setPaintProperty(lId, 'raster-opacity', opacity); } catch {} }
        } else {
          const fillId = `${srcId}-fill`;
          const lineId = `${srcId}-line`;
          const circleId = `${srcId}-circle`;
          if (map.getLayer(fillId)) { try { map.setPaintProperty(fillId, 'fill-opacity', opacity * 0.35); } catch {} }
          if (map.getLayer(lineId)) { try { map.setPaintProperty(lineId, 'line-opacity', opacity); } catch {} }
          if (map.getLayer(circleId)) { try { map.setPaintProperty(circleId, 'circle-opacity', opacity); } catch {} }
        }
      },

        reorderCustomLayers: (orderedIds: string[]) => {
        const byId = new Map(customLayersRef.current.map((l) => [l.id, l]));
        const ordered: CustomLayerConfig[] = [];
        for (const id of orderedIds) {
          const l = byId.get(id);
          if (l) {
            ordered.push(l);
            byId.delete(id);
          }
        }
        for (const l of customLayersRef.current) {
          if (byId.has(l.id)) ordered.push(l);
        }
        customLayersRef.current = ordered;
        const map = mapRef.current;
        if (map && stackGroupsRef.current.length) {
          applyStackLayerOrder(map, stackGroupsRef.current);
        }
        console.info('[MapCore] Custom layers reordered:', { orderedIds });
      },

      syncCustomLayerRegistryOrder: (orderedIds: string[]) => {
        const byId = new Map(customLayersRef.current.map((l) => [l.id, l]));
        const ordered: CustomLayerConfig[] = [];
        for (const id of orderedIds) {
          const l = byId.get(id);
          if (l) {
            ordered.push(l);
            byId.delete(id);
          }
        }
        for (const l of customLayersRef.current) {
          if (byId.has(l.id)) ordered.push(l);
        }
        customLayersRef.current = ordered;
      },

      getRegionalStyleLayerIds: (): string[] => {
        const map = mapRef.current;
        if (!map) return [];
        const out: string[] = [];
        for (const layer of map.getStyle()?.layers ?? []) {
          if (
            'source' in layer &&
            (layer.source === MAP_SOURCE_ID || layer.source === 'openmaptiles')
          ) {
            out.push(layer.id);
          }
        }
        return out;
      },

      getCatalogBasemapLayerIds: (): string[] => {
        const map = mapRef.current;
        if (!map) return [];
        return collectCatalogBasemapLayerIds(map);
      },

      reorderStackLayerGroups: (groups: string[][]) => {
        stackGroupsRef.current = groups;
        const map = mapRef.current;
        if (!map) return;
        applyStackLayerOrder(map, groups);
      },

      getCustomLayers: () => [...customLayersRef.current],

      setBaseMapVisible: (visible: boolean) => {
        if (!mapRef.current) return;
        styleOptionsRef.current = {
          ...styleOptionsRef.current,
          catalogBasemapVisible: visible,
        };
        applyCatalogBasemapVisibility(mapRef.current, visible);
        console.info('[MapCore] Catalog basemap visibility:', { visible });
      },

      setRegionalStyleOpacity: (opacity: number) => {
        const op = Math.max(0, Math.min(1, opacity));
        styleOptionsRef.current = { ...styleOptionsRef.current, regionalOpacity: op };
        const map = mapRef.current;
        if (map) applyRegionalStyleOpacity(map, op);
      },

      setSatelliteOpacity: (opacity: number) => {
        const op = Math.max(0, Math.min(1, opacity));
        styleOptionsRef.current = { ...styleOptionsRef.current, satelliteOpacity: op };
        const map = mapRef.current;
        if (map) applySatelliteOpacity(map, op);
      },

      setLabelsOverlayOpacity: (opacity: number) => {
        const op = Math.max(0, Math.min(1, opacity));
        styleOptionsRef.current = { ...styleOptionsRef.current, labelsOverlayOpacity: op };
        const map = mapRef.current;
        if (map) applyLabelsOverlayOpacity(map, op);
      },

      setSatelliteVisible: (visible: boolean) => {
        styleOptionsRef.current = {
          ...styleOptionsRef.current,
          satelliteVisible: visible,
        };
        const map = mapRef.current;
        if (map) applySatelliteVisibility(map, visible);
        console.info('[MapCore] Satellite visibility:', { visible });
      },

      setLabelsOverlayVisible: (visible: boolean) => {
        styleOptionsRef.current = {
          ...styleOptionsRef.current,
          labelsOverlayVisible: visible,
        };
        const map = mapRef.current;
        if (map) applyLabelsOverlayVisibility(map, visible);
        console.info('[MapCore] Labels overlay visibility:', { visible });
      },

      setRegionalPmtilesUrl: (url: string) => {
        if (!url?.trim()) return;
        tilesUrlRef.current = url;
        const resolved = resolveTilesUrl(url);
        if (resolved) {
          lastRegionalPmtilesUrlRef.current = resolved;
        }
      },

      reloadStyle: () => {
        applyStyleAndPreserveMarkers();
      },
      setBasemapStackSlots: (slotsTopFirst: BasemapStackSlot[]) => {
        const prev = styleOptionsRef.current.basemapStackSlots ?? [];
        const same =
          prev.length === slotsTopFirst.length &&
          prev.every((s, i) => s === slotsTopFirst[i]);
        styleOptionsRef.current = {
          ...styleOptionsRef.current,
          basemapStackSlots: slotsTopFirst,
        };
        if (!same) applyStyleAndPreserveMarkers();
      },
      getVectorBasemapLayerIds: () => {
        const map = mapRef.current;
        if (!map) return [];
        const basemapSources = new Set<string>([
          MAP_SOURCE_ID,
          WORLD_SOURCE_ID,
          WORLD_FULL_SOURCE_ID,
        ]);
        const ids: string[] = [];
        for (const layer of map.getStyle()?.layers ?? []) {
          const src = (layer as { source?: string }).source;
          // Background paper color + every basemap-source layer = one opaque block.
          if (layer.type === 'background' || (src && basemapSources.has(src))) {
            ids.push(layer.id);
          }
        }
        return ids;
      },
    };
  }

  useImperativeHandle(ref, buildHandle);

  // Call onReady once map is loaded — delivers the handle via callback
  // so consumers using dynamic() don't need ref forwarding to work.
  useEffect(() => {
    if (isLoaded && onReady && selfRef.current) {
      onReady(selfRef.current);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded]);

  // WHY: When spiderEnabled is toggled off, clear any active spider overlay immediately.
  useEffect(() => {
    if (!spiderEnabled && isLoaded) {
      clearSpiderRef.current();
    }
  }, [spiderEnabled, isLoaded]);

  // ==========================================
  // Map Initialization
  // ==========================================

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    // Register PMTiles protocol (singleton)
    registerPmtilesProtocol();

    const resolvedUrl = resolveTilesUrl(tilesUrl);
    console.info('[MapCore] Initializing map:', { tilesUrl: resolvedUrl, theme, center, zoom });

    const style = createMapStyle(resolvedUrl, theme, styleOptionsRef.current);

    const map = new maplibregl.Map({
      container: containerRef.current,
      style,
      center: center as LngLatLike,
      zoom,
      minZoom,
      maxZoom,
      attributionControl: false,
      // WHY localIdeographFontFamily: Renders CJK characters using the browser's CSS
      // font stack instead of PBF glyph tiles. This avoids downloading CJK glyph files
      // offline. Vazirmatn is listed first so the browser uses it for Latin glyphs too.
      // NOTE: For full Arabic/Persian glyph support, generate Vazirmatn PBF files in
      // map-service/fonts/ and add a glyphs URL to the map style (see createMapStyle).
      localIdeographFontFamily: 'Vazirmatn, Inter, "Noto Sans", "Noto Naskh Arabic", "Arial Unicode MS", sans-serif',
      // WHY: Allow over-zoom beyond tile max zoom (14) for closer inspection.
      // MapLibre re-uses z14 data at higher zoom levels.
      maxTileCacheSize: 256,
      // WHY preserveDrawingBuffer: lets callers grab a PNG via canvas.toBlob().
      // Without this WebGL clears the back-buffer right after each paint, so
      // any out-of-band readPixels / toBlob returns a blank image. Map-chat
      // uses this for its "Save map as PNG" button.
      // @ts-ignore -- valid canvas attribute across maplibre-gl runtime versions
      preserveDrawingBuffer: true,
    });

    // Add controls
    if (showNavigation) {
      map.addControl(new maplibregl.NavigationControl(), 'bottom-right');
    }
    if (showScale) {
      map.addControl(new maplibregl.ScaleControl(), 'bottom-left');
    }
    // Attribution (compact)
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');

    // MapLibre GL 5.x bug workaround — useProgram crash during style transition
    // WHY: In 5.x, painter.useProgram() accesses `this.style.projection.shaderPreludeCode`
    // without a null guard. When setStyle() is called (terrain/satellite/theme toggle),
    // `style.projection` is briefly undefined while the new style initialises. If the rAF
    // fires in that window, MapLibre throws "can't access property shaderPreludeCode,
    // r is undefined" and Next.js shows its red error overlay.
    // FIX: Wrap _render with a try-catch. On failure we skip that single frame
    // (the style load will trigger a fresh repaint automatically).
    const origInternalRender = (map as unknown as { _render: (ts: number) => void })._render.bind(map);
    (map as unknown as { _render: (ts: number) => void })._render = function (ts: number) {
      try {
        origInternalRender(ts);
      } catch (err: unknown) {
        // Suppress shader-prelude errors that occur during style transitions.
        // All other errors are re-thrown.
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes('shaderPreludeCode') || msg.includes('shaderPrelude')) {
          console.warn('[MapCore] Suppressed MapLibre render error during style transition:', msg);
        } else {
          throw err;
        }
      }
    };

    // Events
    map.on('load', () => {
      console.info('[MapCore] Map loaded successfully');
      if (!mapReadyRef.current) {
        mapReadyRef.current = true;
        selfRef.current = buildHandle();
        setIsLoaded(true);
      }
      onMapLoad?.(map);

      // Add GeoJSON source + cluster layers with initial data
      addSourceAndLayers(map, markersDataRef.current);

      // ==========================================
      // Spider-fy helpers — spread co-located markers into a circle
      // when a cluster can't expand further (at max cluster zoom)
      // ==========================================

      /**
       * Remove any existing spider overlay from the map.
       */
      function clearSpider() {
        const hadSpider = !!map.getLayer(SPIDER_LAYER_POINTS);
        if (map.getLayer(SPIDER_LAYER_POINTS)) map.removeLayer(SPIDER_LAYER_POINTS);
        if (map.getLayer(SPIDER_LAYER_LEGS)) map.removeLayer(SPIDER_LAYER_LEGS);
        if (map.getSource(SPIDER_SOURCE_ID)) map.removeSource(SPIDER_SOURCE_ID);
        if (hadSpider) onSpiderCloseRef.current?.();
      }

      // Store clearSpider in ref so imperative API and effects can call it
      clearSpiderRef.current = clearSpider;
      // Store showSpider in ref so imperative spiderfyAt can call it
      showSpiderRef.current = showSpider;

      /**
       * Arrange leaves in a circle (≤8) or spiral (9+) around center and add to map.
       * Each leaf point is offset so co-located markers are individually clickable.
       *
       * Based on OverlappingMarkerSpiderfier pattern:
       * - Circle layout for small counts (evenly spaced on circumference)
       * - Spiral layout for larger counts (more space-efficient)
       * - Legs connecting center to each offset point
       * - Highlighted points with selection-aware styling
       */
      function showSpider(
        center: [number, number],
        leaves: GeoJSON.Feature[]
      ) {
        clearSpider();

        const count = leaves.length;
        if (count === 0) return;

        // WHY 0.0003: ~33m offset at equator — larger than before (was 0.00015)
        // to give more visual separation at zoom 16+. This makes individual
        // spider points easier to click and distinguish.
        const baseRadius = 0.0003;

        const features: GeoJSON.Feature[] = [];
        const lineFeatures: GeoJSON.Feature[] = [];

        // WHY circleSpiralSwitchover at 9: Based on OMS default.
        // Circle is cleaner for small counts, spiral avoids overlap for larger sets.
        const useSpiralLayout = count > 8;

        for (let i = 0; i < count; i++) {
          let offsetLng: number;
          let offsetLat: number;

          if (useSpiralLayout) {
            // Spiral layout — each point is further out along an Archimedean spiral
            const spiralLengthFactor = 4;
            const spiralLengthStart = baseRadius * 0.6;
            const angle = i * (Math.PI * 2) / 6; // 6 points per revolution
            const legLength = spiralLengthStart + i * baseRadius * spiralLengthFactor / count;
            offsetLng = center[0] + legLength * Math.cos(angle);
            offsetLat = center[1] + legLength * Math.sin(angle);
          } else {
            // Circle layout — evenly spaced on circumference
            const angle = (2 * Math.PI * i) / count - Math.PI / 2;
            const radius = count <= 3 ? baseRadius * 0.7 : baseRadius;
            offsetLng = center[0] + radius * Math.cos(angle);
            offsetLat = center[1] + radius * Math.sin(angle);
          }

          const props = leaves[i].properties || {};
          features.push({
            type: 'Feature',
            properties: {
              id: props.id,
              color: props.color || '#111111',
              selected: props.selected || false,
            },
            geometry: { type: 'Point', coordinates: [offsetLng, offsetLat] },
          });
          // Leg line from center to offset
          lineFeatures.push({
            type: 'Feature',
            properties: {
              color: props.color || '#888888',
            },
            geometry: {
              type: 'LineString',
              coordinates: [center, [offsetLng, offsetLat]],
            },
          });
        }

        const allFeatures = [...lineFeatures, ...features];
        map.addSource(SPIDER_SOURCE_ID, {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: allFeatures },
        });

        // Thin lines connecting center to each offset point — colored to match marker
        map.addLayer({
          id: SPIDER_LAYER_LEGS,
          type: 'line',
          source: SPIDER_SOURCE_ID,
          filter: ['==', '$type', 'LineString'],
          paint: {
            'line-color': ['get', 'color'],
            'line-width': 1.5,
            'line-opacity': 0.5,
            'line-dasharray': [2, 2],
          },
        });

        // Offset point circles — larger and more prominent than unclustered points
        // WHY larger (radius 9/7): Spider points need to be easy to click on individually,
        // and visually distinct from regular unclustered marker dots.
        map.addLayer({
          id: SPIDER_LAYER_POINTS,
          type: 'circle',
          source: SPIDER_SOURCE_ID,
          filter: ['==', '$type', 'Point'],
          paint: {
            'circle-color': [
              'case',
              ['==', ['get', 'selected'], true], '#4e36f5',
              ['get', 'color'],
            ],
            'circle-radius': ['case', ['==', ['get', 'selected'], true], 9, 7],
            'circle-stroke-width': 2.5,
            'circle-stroke-color': 'rgba(255,255,255,0.95)',
          },
        });

        console.info('[MapCore] Spider shown:', { count, center });
        onSpiderOpenRef.current?.(count);
      }

      // Clear spider when user clicks elsewhere on the map or pans away
      map.on('click', (e) => {
        const spiderFeatures = map.getLayer(SPIDER_LAYER_POINTS)
          ? map.queryRenderedFeatures(e.point, { layers: [SPIDER_LAYER_POINTS] })
          : [];
        const clusterFeatures = map.queryRenderedFeatures(e.point, { layers: [GEO_LAYER_CLUSTERS] });
        const unclusteredFeatures = map.queryRenderedFeatures(e.point, { layers: [GEO_LAYER_UNCLUSTERED] });
        // Only clear spider if user clicked on empty space (not on any interactive feature)
        if (spiderFeatures.length === 0 && clusterFeatures.length === 0 && unclusteredFeatures.length === 0) {
          clearSpider();
        }
      });

      // Spider point click → forward to onMarkerClick
      map.on('click', SPIDER_LAYER_POINTS, (e) => {
        if (!e.features?.length) return;
        const props = e.features[0].properties;
        const coords = (e.features[0].geometry as GeoJSON.Point).coordinates;
        const marker: MapMarker = {
          id: String(props?.id ?? ''),
          lng: coords[0],
          lat: coords[1],
          color: String(props?.color ?? ''),
          selected: props?.selected === true || props?.selected === 'true',
        };
        onMarkerClickRef.current?.(marker, {
          ctrlKey: e.originalEvent.ctrlKey,
          shiftKey: e.originalEvent.shiftKey,
          metaKey: e.originalEvent.metaKey,
        });
      });

      map.on('mouseenter', SPIDER_LAYER_POINTS, () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', SPIDER_LAYER_POINTS, () => { map.getCanvas().style.cursor = ''; });

      // ==========================================
      // Layer Click Handlers (registered once, persist through style changes)
      // WHY once: MapLibre stores delegated ('click', 'layer-id') listeners
      // on the map object. They survive setStyle() and fire again when the
      // layer is re-added with the same ID.
      // ==========================================

      // Cluster click → zoom to expand OR spiderfy if at max zoom OR select if Ctrl/Shift+Click
      map.on('click', GEO_LAYER_CLUSTERS, (e) => {
        const features = map.queryRenderedFeatures(e.point, { layers: [GEO_LAYER_CLUSTERS] });
        if (!features.length) return;
        const clusterId = features[0].properties?.cluster_id as number;
        const source = map.getSource(GEO_SOURCE_ID) as GeoJSONSource;

        // WHY cluster selection: When user Ctrl/Shift/Meta+clicks on a cluster at high zoom,
        // they want to select all markers inside it (e.g., 150 files in Tehran) without
        // zooming to z14+ and clicking individually. This enables fast geographic region selection.
        const hasModifier = e.originalEvent.ctrlKey || e.originalEvent.shiftKey || e.originalEvent.metaKey;
        if (hasModifier && onClusterSelectRef.current) {
          // Fetch all marker IDs from this cluster (up to 10,000 points)
          const pointCount = features[0].properties?.point_count as number;
          source.getClusterLeaves(clusterId, pointCount || 10000, 0).then((leaves) => {
            const markerIds = leaves.map((leaf) => String(leaf.properties?.id ?? '')).filter(Boolean);
            console.info('[MapCore] Cluster select:', { clusterId, markerIds: markerIds.length });
            onClusterSelectRef.current?.(markerIds);
          }).catch((err: unknown) => {
            console.warn('[MapCore] getClusterLeaves failed for selection:', err);
          });
          return; // Skip zoom/spiderfy when selecting
        }

        source.getClusterExpansionZoom(clusterId).then((expansionZoom) => {
          const coords = (features[0].geometry as GeoJSON.Point).coordinates as [number, number];
          // WHY >= 14: clusterMaxZoom is 14. If expansion zoom is at or beyond
          // that, zooming further won't break the cluster — instead, spiderfy
          // the overlapping points into a circle pattern.
          if (expansionZoom >= 14 && spiderEnabledRef.current) {
            source.getClusterLeaves(clusterId, 100, 0).then((leaves) => {
              showSpider(coords, leaves);
              // Also zoom close enough to see the spider clearly
              if (map.getZoom() < 15) {
                map.easeTo({ center: coords, zoom: 16 });
              }
            }).catch((err: unknown) => {
              console.warn('[MapCore] getClusterLeaves failed:', err);
            });
          } else if (expansionZoom >= 14) {
            // Spider disabled — just zoom closer to see individual unclustered points
            clearSpider();
            map.easeTo({ center: coords, zoom: 16 });
          } else {
            clearSpider();
            map.easeTo({ center: coords, zoom: expansionZoom });
          }
        }).catch((err: unknown) => {
          console.warn('[MapCore] Cluster expansion zoom failed:', err);
        });
      });

      // Unclustered point click → forward to onMarkerClick with modifier keys
      map.on('click', GEO_LAYER_UNCLUSTERED, (e) => {
        if (!e.features?.length) return;
        const props = e.features[0].properties;
        const coords = (e.features[0].geometry as GeoJSON.Point).coordinates;
        const marker: MapMarker = {
          id: String(props?.id ?? ''),
          lng: coords[0],
          lat: coords[1],
          color: String(props?.color ?? ''),
          selected: props?.selected === true || props?.selected === 'true',
        };
        onMarkerClickRef.current?.(marker, {
          ctrlKey: e.originalEvent.ctrlKey,
          shiftKey: e.originalEvent.shiftKey,
          metaKey: e.originalEvent.metaKey,
        });
      });

      // Cursor changes for interactive layers
      map.on('mouseenter', GEO_LAYER_CLUSTERS, () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', GEO_LAYER_CLUSTERS, () => { map.getCanvas().style.cursor = ''; });
      map.on('mouseenter', GEO_LAYER_UNCLUSTERED, () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', GEO_LAYER_UNCLUSTERED, () => { map.getCanvas().style.cursor = ''; });
    });

    map.on('moveend', () => {
      const mapCenter = map.getCenter();
      const mapZoom = map.getZoom();
      onViewChange?.([mapCenter.lng, mapCenter.lat], mapZoom);
    });

    map.on('error', (e: { error?: { message?: string } }) => {
      const msg = e.error?.message || '';
      // Suppress individual tile 404s (expected when offline tiles don't cover area)
      if (msg.includes('404') || msg.includes('tile')) return;
      // Detect PMTiles connection failure (tile server not running)
      if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('ECONNREFUSED')) {
        console.error('[MapCore] Tile server unreachable:', msg);
        setTileError(true);
        return;
      }
      console.error('[MapCore] Map error:', e);
    });

    mapRef.current = map;

    // Persistent re-attach listener — fires on EVERY style.load (initial
    // mount + every setStyle call: theme switch, satellite/terrain toggle,
    // world-tiles change). Idempotent guards inside the helpers prevent
    // double-add. WHY persistent (vs `map.once` per setStyle call): rapid
    // user toggles queue multiple `once` handlers that can race when
    // MapLibre interrupts a still-loading style; a single durable listener
    // is always called for the FINAL loaded style with no race.
    map.on('style.load', () => {
      if (!mapReadyRef.current) {
        mapReadyRef.current = true;
        selfRef.current = buildHandle();
        setIsLoaded(true);
      }
      addSourceAndLayers(map, markersDataRef.current);
      reattachChatLayersToMap(map);
      reattachCustomLayers(map, customLayersRef.current);
      const regionalOp = styleOptionsRef.current.regionalOpacity;
      if (regionalOp != null && regionalOp < 1) {
        applyRegionalStyleOpacity(map, regionalOp);
      }
      const satOp = styleOptionsRef.current.satelliteOpacity;
      if (satOp != null && satOp < 1) {
        applySatelliteOpacity(map, satOp);
      }
      const labelsOp = styleOptionsRef.current.labelsOverlayOpacity;
      if (labelsOp != null && labelsOp < 1) {
        applyLabelsOverlayOpacity(map, labelsOp);
      }
      if (styleOptionsRef.current.satelliteVisible === false) {
        applySatelliteVisibility(map, false);
      }
      if (styleOptionsRef.current.labelsOverlayVisible === false) {
        applyLabelsOverlayVisibility(map, false);
      }
      if (stackGroupsRef.current.length) {
        applyStackLayerOrder(map, stackGroupsRef.current);
      }
      const regionalUrl =
        resolveTilesUrl(tilesUrlRef.current) || lastRegionalPmtilesUrlRef.current;
      const userHidden = styleOptionsRef.current.catalogBasemapVisible === false;
      const basemapVis = Boolean(regionalUrl?.trim()) && !userHidden;
      applyCatalogBasemapVisibility(map, basemapVis);
      if (styleOptionsRef.current.hideRegionalVector) {
        applyRegionalVectorVisibility(map, false);
      }
    });

    // Register THIS map as the active chat-layer host. Triggers an immediate
    // reattach so any chat layers carried over from a previous page mount
    // become visible on this fresh map. Cleared on unmount below.
    map.once('load', () => setActiveChatMap(map));

    // Cleanup on unmount
    return () => {
      console.info('[MapCore] Cleaning up map');
      setActiveChatMap(null);
      map.remove();
      mapRef.current = null;
      mapReadyRef.current = false;
      setIsLoaded(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only init once

  // ==========================================
  // Theme Switching
  // ==========================================

  useEffect(() => {
    if (!mapRef.current || !isLoaded) return;

    const resolvedUrl =
      resolveTilesUrl(tilesUrl) || lastRegionalPmtilesUrlRef.current;
    const resolvedWorldUrl = resolveWorldTilesUrl(worldTilesUrl, resolvedUrl);
    const resolvedWorldFullUrl = resolveWorldFullTilesUrl(worldFullTilesUrl, resolvedUrl);
    const styleKey = [
      resolvedUrl,
      resolvedWorldUrl ?? '',
      resolvedWorldFullUrl ?? '',
      theme,
      JSON.stringify(styleOptionsRef.current.basemapStackSlots ?? []),
    ].join('|');
    if (styleKey === lastAppliedStyleKeyRef.current) return;
    lastAppliedStyleKeyRef.current = styleKey;
    styleOptionsRef.current = {
      ...styleOptionsRef.current,
      worldTilesUrl: resolvedWorldUrl,
      worldFullTilesUrl: resolvedWorldFullUrl,
    };
    const style = createMapStyle(resolvedUrl, theme, styleOptionsRef.current);
    const map = mapRef.current;
    map.setStyle(style);
    console.info('[MapCore] Style updated:', {
      theme,
      terrain: styleOptionsRef.current.showTerrain,
      world: Boolean(resolvedWorldUrl),
      worldFull: Boolean(resolvedWorldFullUrl),
    });

    // Re-attach is handled by the persistent `style.load` listener installed
    // at map init — no per-call timeout needed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme, tilesUrl, worldTilesUrl, worldFullTilesUrl, isLoaded]);

  // ==========================================
  // GeoJSON Source & Clustering Layer Management
  // WHY GeoJSON source over DOM markers: DOM markers are individual HTML
  // elements — each one triggers layout/paint on every frame. At 100+ points
  // the browser jank becomes noticeable. MapLibre's GeoJSON source renders
  // all points in a single WebGL draw call and uses Supercluster (KD-tree,
  // O(n log n)) for automatic clustering. This handles 100K+ points smoothly.
  // ==========================================

  /**
   * Convert MapMarker array to a GeoJSON FeatureCollection.
   * Properties stored on each feature enable data-driven styling
   * (color per file-type, ring on selected markers).
   */
  const markersToGeoJson = useCallback((data: MapMarker[]): GeoJSON.FeatureCollection => {
    return {
      type: 'FeatureCollection',
      features: data.map((m) => ({
        type: 'Feature' as const,
        properties: {
          id: m.id,
          color: m.color || '#111111',
          selected: !!m.selected,
          popupHtml: m.popupHtml || '',
        },
        geometry: {
          type: 'Point' as const,
          coordinates: [m.lng, m.lat],
        },
      })),
    };
  }, []);

  /**
   * Add the GeoJSON source (with clustering) and three rendering layers.
   * Safe to call multiple times — skips if source already exists.
   */
  const addSourceAndLayers = useCallback((map: MapLibreMap, data: MapMarker[]) => {
    if (map.getSource(GEO_SOURCE_ID)) return;

    map.addSource(GEO_SOURCE_ID, {
      type: 'geojson',
      data: markersToGeoJson(data),
      cluster: true,
      clusterMaxZoom: 14,
      clusterRadius: 50,
    });

    // Layer 1: Cluster circles — size and color step with point_count
    map.addLayer({
      id: GEO_LAYER_CLUSTERS,
      type: 'circle',
      source: GEO_SOURCE_ID,
      filter: ['has', 'point_count'],
      paint: {
        'circle-color': [
          'step', ['get', 'point_count'],
          '#51bbd6', 10,
          '#f1f075', 50,
          '#f28cb1',
        ],
        'circle-radius': [
          'step', ['get', 'point_count'],
          18, 10, 24, 50, 30,
        ],
        'circle-stroke-width': 2,
        'circle-stroke-color': 'rgba(255,255,255,0.8)',
      },
    });

    // Layer 2: Cluster count label
    map.addLayer({
      id: GEO_LAYER_CLUSTER_COUNT,
      type: 'symbol',
      source: GEO_SOURCE_ID,
      filter: ['has', 'point_count'],
      layout: {
        'text-field': '{point_count_abbreviated}',
        'text-font': ['Noto Sans Regular'],
        'text-size': 12,
      },
      paint: {
        'text-color': '#333333',
      },
    });

    // Layer 3: Individual (unclustered) point circles
    // WHY data-driven styling: 'color' and 'selected' properties on each
    // feature let us vary appearance per-point without re-creating layers.
    map.addLayer({
      id: GEO_LAYER_UNCLUSTERED,
      type: 'circle',
      source: GEO_SOURCE_ID,
      filter: ['!', ['has', 'point_count']],
      paint: {
        'circle-color': [
          'case',
          ['==', ['get', 'selected'], true], '#4e36f5',
          ['get', 'color'],
        ],
        'circle-radius': ['case', ['==', ['get', 'selected'], true], 8, 6],
        'circle-stroke-width': ['case', ['==', ['get', 'selected'], true], 3, 2],
        'circle-stroke-color': 'rgba(255,255,255,0.9)',
      },
    });

    console.info('[MapCore] GeoJSON source + cluster layers added');
  }, [markersToGeoJson]);

  /**
   * Update the GeoJSON source data without re-creating layers.
   * This is the hot path — called on every selection change / filter apply.
   */
  const updateGeoJsonData = useCallback((map: MapLibreMap, data: MapMarker[]) => {
    const source = map.getSource(GEO_SOURCE_ID) as GeoJSONSource | undefined;
    if (!source) return;
    source.setData(markersToGeoJson(data));
  }, [markersToGeoJson]);

  // Update source data when markers change
  useEffect(() => {
    if (!mapRef.current || !isLoaded) return;
    const source = mapRef.current.getSource(GEO_SOURCE_ID) as GeoJSONSource | undefined;
    if (source) {
      source.setData(markersToGeoJson(markers));
      if (markers.length > 0) {
        console.info('[MapCore] GeoJSON data updated:', { count: markers.length });
      }
    }
  }, [markers, isLoaded, markersToGeoJson]);

  // ==========================================
  // Render
  // ==========================================

  return (
    <div className={`relative h-full w-full ${className ?? ''}`}>
      {/* Map container */}
      <div ref={containerRef} className="h-full w-full" />

      {/* Loading overlay */}
      {!isLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-100">
          <div className="text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-primary" />
            <p className="mt-3 text-sm text-gray-500">Loading map...</p>
          </div>
        </div>
      )}

      {/* Tile error banner */}
      {tileError && (
        <div className="absolute left-3 right-3 top-3 z-20 rounded-lg border border-dashed border-orange-300 bg-orange-50 px-4 py-3 dark:border-orange-700 dark:bg-orange-950/80">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 text-lg">⚠️</span>
            <div>
              <p className="text-sm font-medium text-orange-700 dark:text-orange-300">
                نقشه پایه بارگذاری نشد
              </p>
              <p className="mt-0.5 text-xs text-orange-600 dark:text-orange-400">
                در پنل «لایه‌های کاتالوگ» مسیر فایل PMTiles را ثبت کنید، یا اتصال Storage را بررسی کنید.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Child overlays (controls, panels, etc.) */}
      {children}
    </div>
  );
});

MapCore.displayName = 'MapCore';
export default MapCore;
