// ============================================
// Map — Shared map module barrel exports
// Exposes MapCore component and utilities for consumers.
// WHY barrel: All map layer IDs, source IDs, types, and components
// should be imported from '@/app/shared/map' — never from the
// internal files directly. This ensures a single public API surface.
// ============================================

// Component
export { default as MapCore } from './map-core';

// Types
export type { MapCoreProps, MapCoreRef, MapMarker, CustomLayerConfig } from './map-core';
export type { MapTheme, MapStyleOptions, BasemapStackSlot } from './map-styles';

// GeoJSON layer & source IDs (used by geo-location plugin for event binding)
export {
  GEO_SOURCE_ID,
  GEO_LAYER_CLUSTERS,
  GEO_LAYER_CLUSTER_COUNT,
  GEO_LAYER_UNCLUSTERED,
  SPIDER_SOURCE_ID,
  SPIDER_LAYER_LEGS,
  SPIDER_LAYER_POINTS,
} from './map-core';

// Map style utilities & source/layer constants
export {
  createMapStyle,
  getLightColors,
  getDarkColors,
  MAP_SOURCE_ID,
  TERRAIN_SOURCE_ID,
  TERRAIN_TILES_URL,
  WORLD_SOURCE_ID,
  WORLD_FULL_SOURCE_ID,
  SATELLITE_SOURCE_ID,
  SATELLITE_RASTER_LAYER_ID,
  LABELS_OVERLAY_RASTER_LAYER_ID,
} from './map-styles';
