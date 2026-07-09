// ============================================
// Map Styles — OpenMapTiles-compatible style definitions
// Provides high-quality light & dark themes for MapCore
// Inspired by Organic Maps / OSM Carto for visual quality
// ============================================

import type { StyleSpecification, LayerSpecification, SourceSpecification } from 'maplibre-gl';

// ==========================================
// Theme Color Palettes
// ==========================================

/**
 * Light theme colors — Organic Maps inspired daylight palette.
 * Rich earth tones, clear water, and high-contrast road hierarchy.
 */
const LIGHT_COLORS = {
  // Base
  background: '#f5f1eb',
  // Water
  water: '#aad3df',
  waterway: '#aad3df',
  water_outline: '#9cc4d5',
  // Landcover
  landcover_grass: '#cdebb0',
  landcover_wood: '#add19e',
  landcover_sand: '#f5e9c6',
  landcover_farmland: '#eef0d5',
  landcover_scrub: '#c8d7ab',
  landcover_ice: '#ddecec',
  // Landuse
  landuse_park: '#c8facc',
  landuse_residential: '#e8e0d8',
  landuse_commercial: '#f2dad9',
  landuse_industrial: '#ebdbe8',
  landuse_hospital: '#f0d9d9',
  landuse_school: '#f0e8d8',
  landuse_cemetery: '#aacbaf',
  landuse_military: '#e8d8d8',
  // Building
  building: '#d9d0c9',
  building_outline: '#b9b0a9',
  building_extrusion: '#cec5be',
  // Boundaries
  boundary_country: '#9e7fb0',
  boundary_state: '#b8a0c8',
  boundary_disputed: '#cc6677',
  // Roads — Organic Maps style hierarchy
  road_motorway: '#e892a2',
  road_motorway_casing: '#dc2a67',
  road_trunk: '#f9b29c',
  road_trunk_casing: '#c84e2f',
  road_primary: '#fcd6a4',
  road_primary_casing: '#c38a27',
  road_secondary: '#f7fabf',
  road_secondary_casing: '#9eae57',
  road_tertiary: '#ffffff',
  road_tertiary_casing: '#c8c8c8',
  road_minor: '#ffffff',
  road_minor_casing: '#d0d0d0',
  road_path: '#d4a76a',
  // Rail
  rail: '#999999',
  rail_dash: '#ffffff',
  // Labels
  label_primary: '#2b2b2b',
  label_secondary: '#555555',
  label_water: '#4d80b3',
  label_road: '#4a4a4a',
  label_road_halo: '#ffffff',
  // POI
  poi: '#734a08',
  poi_halo: '#ffffff',
  // Aeroway
  aeroway: '#c8c0c0',
  aeroway_runway: '#bbc3c9',
  // Hillshade / Terrain relief
  hillshade_shadow: '#5a4a28',
  hillshade_highlight: '#fdfbf5',
  hillshade_accent: '#8a6a30',
  // Enhanced water layers
  ocean_deep: '#85c4d6',
  water_glacier: '#d8eeee',
  waterway_canal: '#52bcd4',
} as const;

/**
 * Dark theme colors — deep blue night palette.
 * Controlled contrast, easy on the eyes in low-light.
 */
const DARK_COLORS = {
  // Base
  background: '#16213e',
  // Water
  water: '#0a1e3a',
  waterway: '#0a1e3a',
  water_outline: '#0d2648',
  // Landcover
  landcover_grass: '#1a3320',
  landcover_wood: '#14291a',
  landcover_sand: '#2c2818',
  landcover_farmland: '#1e2a14',
  landcover_scrub: '#1e2b18',
  landcover_ice: '#1a2535',
  // Landuse
  landuse_park: '#1a3322',
  landuse_residential: '#1e1e36',
  landuse_commercial: '#2a1e2e',
  landuse_industrial: '#1e1c2c',
  landuse_hospital: '#2a1c1c',
  landuse_school: '#2a2418',
  landuse_cemetery: '#1a2a1e',
  landuse_military: '#2a2030',
  // Building
  building: '#283048',
  building_outline: '#3a4260',
  building_extrusion: '#323a55',
  // Boundaries
  boundary_country: '#7050a0',
  boundary_state: '#504080',
  boundary_disputed: '#884455',
  // Roads
  road_motorway: '#803050',
  road_motorway_casing: '#601838',
  road_trunk: '#804830',
  road_trunk_casing: '#603018',
  road_primary: '#806830',
  road_primary_casing: '#604818',
  road_secondary: '#505830',
  road_secondary_casing: '#383e18',
  road_tertiary: '#3a3a5a',
  road_tertiary_casing: '#28283e',
  road_minor: '#30304a',
  road_minor_casing: '#222238',
  road_path: '#584830',
  // Rail
  rail: '#404060',
  rail_dash: '#1a1a2e',
  // Labels
  label_primary: '#d4d4e0',
  label_secondary: '#9898b0',
  label_water: '#406888',
  label_road: '#8888a0',
  label_road_halo: '#16213e',
  // POI
  poi: '#b09060',
  poi_halo: '#16213e',
  // Aeroway
  aeroway: '#28283e',
  aeroway_runway: '#2e3048',
  // Hillshade / Terrain relief
  hillshade_shadow: '#080810',
  hillshade_highlight: '#505878',
  hillshade_accent: '#1c1c3a',
  // Enhanced water layers
  ocean_deep: '#061524',
  water_glacier: '#0e1c28',
  waterway_canal: '#083048',
} as const;

// WHY Record<keyof ...>: Both LIGHT_COLORS and DARK_COLORS use `as const`
// which gives each property a literal type (e.g. "#f5f1eb"). Using `typeof LIGHT_COLORS`
// directly would reject DARK_COLORS because its literals differ. Mapping to `string`
// makes the parameter accept either palette.
type ThemeColors = Record<keyof typeof LIGHT_COLORS, string>;

// ==========================================
// Terrain / Hillshade Configuration
// ==========================================

/** Source ID for the terrain raster-dem source */
export const TERRAIN_SOURCE_ID = 'terrain-dem';

/**
 * Free global terrain tiles in Terrarium PNG format from AWS Open Data Program.
 * Zoom 0–15, globally available. Requires internet access.
 *
 * WHY Terrarium: More widely available than Mapbox RGB; natively supported by MapLibre.
 * For fully offline deployment, replace with a local PMTiles/tile-server URL.
 *
 * @see https://aws.amazon.com/public-datasets/terrain/
 */
export const TERRAIN_TILES_URL =
  'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';

/** Source ID used for the regional OpenMapTiles vector tile source */
export const MAP_SOURCE_ID = 'openmaptiles';

/** Insert hybrid raster imagery below the first regional fill (roads/labels stay on top). */
export const HYBRID_IMAGERY_BEFORE_LAYER_IDS = [
  'landcover_grass',
  'landcover_wood',
  'landuse_residential',
  'water',
] as const;

/**
 * Source ID for the world PMTiles source (Protomaps Basemap schema).
 * World tiles provide full global coverage with progressive detail:
 *   - world-full-z14.pmtiles (63 GB) = full detail z0–z14 (roads, buildings, POIs)
 *   - world-overview.pmtiles (14 MB) = lightweight z0–z5 (borders, labels only)
 */
export const WORLD_SOURCE_ID = 'world-overview';

/**
 * Source ID for the high-detail global tiles (world-full-z14.pmtiles, z0–z14).
 * Used as a complement to WORLD_SOURCE_ID: overview handles z0–z5 context,
 * world-full activates at z6+ to provide detailed streets/POIs worldwide.
 * Set NEXT_PUBLIC_WORLD_FULL_TILES_URL to enable this source.
 */
export const WORLD_FULL_SOURCE_ID = 'world-full';

/** Source ID for the satellite raster imagery source */
export const SATELLITE_SOURCE_ID = 'satellite';
export const SATELLITE_RASTER_LAYER_ID = 'satellite-raster';
export const LABELS_OVERLAY_RASTER_LAYER_ID = 'labels-overlay-raster';

/** Source ID for the transparent labels/roads overlay raster source */
export const LABELS_OVERLAY_SOURCE_ID = 'labels-overlay';

/** Regional fill layers that sit below hybrid satellite imagery (roads/labels stay above). */
export const REGIONAL_HYBRID_BASE_FILL_RE = /^(water|landcover|landuse|park)/;

/** @deprecated use isOpaqueMapLayer — all fill layers hide satellite when opaque. */
export function isRegionalHybridBaseFillLayer(id: string, type: string | undefined): boolean {
  return isOpaqueMapLayer({ type } as LayerSpecification);
}

/** Opaque vector layers that hide satellite imagery underneath. */
export function isOpaqueMapLayer(layer: LayerSpecification): boolean {
  return layer.type === 'fill' || layer.type === 'fill-extrusion';
}

/**
 * Options for createMapStyle — controls optional layer groups.
 */
export interface MapStyleOptions {
  /**
   * Enable terrain hillshading + 3D surface exaggeration.
   * Requires internet access unless terrainUrl points to a local server.
   */
  showTerrain?: boolean;
  /**
   * Override terrain DEM tile URL. Defaults to TERRAIN_TILES_URL (AWS free tiles).
   * Set to a local tile server URL for fully offline terrain.
   */
  terrainUrl?: string;
  /**
   * World overview tiles URL (Protomaps Basemap schema, z0–z5).
   * When provided, a world-overview source is added to the style so oceans,
   * country borders, and place labels render globally at low zoom levels.
   *
   * WHY separate from main tiles: regional PMTiles only cover their area.
   * At zoom = 7 the rest of the globe is blank without world overview tiles.
   *
   * Generate/download with: scripts/download-world-tiles.ps1
   * Default tile server: http://localhost:8765/world-overview.pmtiles
   */
  worldTilesUrl?: string;
  /**
   * High-detail global tiles URL (world-full-z14.pmtiles, Protomaps schema, z0–z14).
   * When provided, a second world source activates at zoom 6+ to provide detailed
   * streets, buildings, and POIs everywhere globally (complements worldTilesUrl
   * which handles z0–z5 overview). This is the 63GB full-globe file.
   *
   * WHY separate from worldTilesUrl: overview tiles are small (14MB) for fast startup.
   * Enable world-full only when the large file is available locally.
   *
   * Set NEXT_PUBLIC_WORLD_FULL_TILES_URL env var or pass this option directly.
   * Download with: scripts/download-world-full-urban.ps1
   */
  worldFullTilesUrl?: string;
  /**
   * Satellite raster tile URL template — `{z}/{x}/{y}.jpg` format.
   * When provided, a raster satellite imagery layer is placed between the
   * background and all vector layers, giving a satellite + label hybrid view.
   *
   * Source: NASA GIBS MODIS (~120 MB, z0–z9, 250 m/pixel).
   * Download with: scripts/download-satellite-modis.ps1
   * Set NEXT_PUBLIC_SATELLITE_URL env var or pass this option directly.
   */
  satelliteUrl?: string;
  /**
   * Maximum zoom level for the satellite raster source. Defaults to 20.
   * SAS.Planet has data up to z20; set to 2 for legacy NASA MODIS data (z0–z2 only).
   */
  satelliteMaxZoom?: number;
  /**
   * Transparent raster labels/roads overlay tile URL — `{z}/{x}/{y}.png`.
   * Rendered ABOVE everything (satellite + vector) so place names and roads
   * stay readable on top of satellite imagery. Used for the SAS.Planet "both"
   * overlay which is pixel-aligned with the satellite imagery.
   */
  labelsOverlayUrl?: string;
  /** Maximum zoom for the labels overlay raster source. Defaults to 19. */
  labelsOverlayMaxZoom?: number;
  /**
   * Glyph server URL template — `{fontstack}/{range}.pbf` format.
   * Required for Arabic/Persian and other non-Latin scripts to render correctly.
   * Defaults to '/api/tiles/fonts/{fontstack}/{range}.pbf' (served via tile proxy).
   * PBF files generated by: map-service/scripts/generate_glyphs.py
   */
  glyphsUrl?: string;
  /**
   * When true, the regional PMTiles vector source and all its derived layers
   * (roads, buildings, labels, etc.) are omitted from the style.
   * Useful when the user wants to view only their custom / satellite layers
   * without the base map clutter. Background + world tiles + satellite are
   * still rendered so the canvas is never blank.
   */
  hideBaseMap?: boolean;
  /**
   * When false, hide regional line/symbol layers only (roads, labels) while keeping
   * fills and basemap source — used for “vector overlay off” over satellite imagery.
   * Distinct from hideBaseMap which removes the entire regional source.
   */
  hideRegionalVector?: boolean;
  /**
   * Satellite imagery visible together with regional PMTiles basemap — splits fills
   * below imagery and roads/labels above, with translucent base fills.
   */
  hybridImagery?: boolean;
  /** Opacity for regional base fills (water/landcover) in hybrid mode (0–1). */
  hybridFillOpacity?: number;
  /** Opacity 0–1 for regional PMTiles vector layers (openmaptiles source). */
  regionalOpacity?: number;
  /** Opacity 0–1 for the satellite imagery raster layer. */
  satelliteOpacity?: number;
  /** Opacity 0–1 for the SAS labels/roads overlay raster layer. */
  labelsOverlayOpacity?: number;
  /** Runtime layout visibility for satellite imagery (panel toggle). */
  satelliteVisible?: boolean;
  /** Runtime layout visibility for SAS labels overlay (panel toggle). */
  labelsOverlayVisible?: boolean;
  /** Runtime layout visibility for world + regional PMTiles (panel toggle). */
  catalogBasemapVisible?: boolean;
  /**
   * Top-first render order of the three reorderable basemap slots, driven by the
   * unified layers panel. Each is rendered as one contiguous block so the panel
   * z-order is honored without ever splitting/scrambling the vector basemap.
   * Omitted slots fall back to the default order ('satellite' < 'basemap' < 'labelsOverlay').
   */
  basemapStackSlots?: BasemapStackSlot[];
}

/** Reorderable basemap render slots (the unified panel controls their order). */
export type BasemapStackSlot = 'basemap' | 'satellite' | 'labelsOverlay';

// ==========================================
// Layer Factory Functions
// ==========================================

/**
 * Build world overview layers using the Protomaps Basemap schema.
 *
 * Build comprehensive world layers using the Protomaps Basemap schema.
 *
 * These layers provide full global coverage with progressive detail:
 *   z0–z3: earth, water, country borders, continent/country/capital labels
 *   z4–z7: + state borders, major cities, seas, glaciers, forests, highways
 *   z8–z10: + landuse, waterways, major/medium roads, towns, transit
 *   z10–z14: + buildings, minor roads, villages, POIs
 *
 * Returns two arrays: `base` (fills/lines) and `labels` (symbols).
 * Base layers are inserted AFTER background and BEFORE regional content.
 * Label layers are inserted AFTER regional content for maximum visibility.
 * In areas covered by regional tiles, regional detail renders on top of
 * world base layers, and label collision detection prevents duplication.
 *
 * WHY Protomaps schema: World tiles use `pmtiles extract` from Protomaps CDN
 * builds, which use the Protomaps Basemap schema. Source layers:
 *   earth, water, natural, landuse, physical_line, roads, buildings,
 *   transit, boundaries, places, pois
 * Properties: `kind`, `kind_detail` (Protomaps/Planetiler Basemap schema — no pmap: prefix)
 *
 * @param worldSourceId - World source ID (WORLD_SOURCE_ID)
 * @param colors - Theme color palette
 * @returns { base, labels } — base layers (fill/line) and label layers (symbol)
 */
function buildWorldLayers(worldSourceId: string, colors: ThemeColors): {
  base: LayerSpecification[];
  labels: LayerSpecification[];
} {
  const base: LayerSpecification[] = [
    // ========================================
    // WORLD — Protomaps Basemap schema (full detail)
    // ========================================

    // ----------------------------------------
    // Earth (landmass fill)
    // ----------------------------------------
    {
      id: 'world_earth',
      type: 'fill',
      source: worldSourceId,
      'source-layer': 'earth',
      paint: { 'fill-color': colors.background },
    },

    // ----------------------------------------
    // Water (oceans, lakes — polygon fill only)
    // ----------------------------------------
    {
      id: 'world_water',
      type: 'fill',
      source: worldSourceId,
      'source-layer': 'water',
      // WHY exclude river/canal/stream/ditch/drain: In Protomaps Basemap schema, these
      // are stored as narrow elongated polygons in the 'water' layer. Rendering them as
      // fill produces chunky angular blue shapes at higher zoom levels. They are already
      // rendered correctly as line layers by world_waterway_river and world_waterway_stream.
      filter: ['!', ['match', ['get', 'kind'], ['river', 'canal', 'stream', 'ditch', 'drain'], true, false]],
      paint: {
        'fill-color': colors.ocean_deep,
        'fill-antialias': true,
      },
    },

    // ----------------------------------------
    // Natural land cover
    // ----------------------------------------
    {
      id: 'world_natural_glacier',
      type: 'fill',
      source: worldSourceId,
      // Protomaps Basemap uses 'landcover' (not 'natural') for land cover features
      'source-layer': 'landcover',
      filter: ['==', ['get', 'kind'], 'glacier'],
      minzoom: 4,
      paint: {
        'fill-color': colors.landcover_ice,
        'fill-opacity': ['interpolate', ['linear'], ['zoom'], 4, 0.3, 8, 0.6],
      },
    },
    {
      id: 'world_natural_wood',
      type: 'fill',
      source: worldSourceId,
      'source-layer': 'landcover',
      filter: ['==', ['get', 'kind'], 'wood'],
      minzoom: 5,
      paint: {
        'fill-color': colors.landcover_wood,
        'fill-opacity': ['interpolate', ['linear'], ['zoom'], 5, 0.2, 8, 0.5, 12, 0.7],
      },
    },
    {
      id: 'world_natural_scrub',
      type: 'fill',
      source: worldSourceId,
      'source-layer': 'landcover',
      filter: ['==', ['get', 'kind'], 'scrub'],
      minzoom: 7,
      paint: {
        'fill-color': colors.landcover_scrub,
        'fill-opacity': ['interpolate', ['linear'], ['zoom'], 7, 0.2, 10, 0.5],
      },
    },
    {
      id: 'world_natural_sand',
      type: 'fill',
      source: worldSourceId,
      'source-layer': 'landcover',
      filter: ['match', ['get', 'kind'], ['sand', 'beach'], true, false],
      minzoom: 7,
      paint: {
        'fill-color': colors.landcover_sand,
        'fill-opacity': ['interpolate', ['linear'], ['zoom'], 7, 0.3, 10, 0.6],
      },
    },
    {
      id: 'world_natural_wetland',
      type: 'fill',
      source: worldSourceId,
      'source-layer': 'landcover',
      filter: ['==', ['get', 'kind'], 'wetland'],
      minzoom: 8,
      paint: {
        'fill-color': colors.landcover_grass,
        'fill-opacity': 0.4,
      },
    },
    {
      id: 'world_natural_grassland',
      type: 'fill',
      source: worldSourceId,
      'source-layer': 'landcover',
      filter: ['==', ['get', 'kind'], 'grassland'],
      minzoom: 9,
      paint: {
        'fill-color': colors.landcover_grass,
        'fill-opacity': ['interpolate', ['linear'], ['zoom'], 9, 0.2, 12, 0.4],
      },
    },

    // ----------------------------------------
    // Landuse
    // ----------------------------------------
    {
      id: 'world_landuse_farmland',
      type: 'fill',
      source: worldSourceId,
      'source-layer': 'landuse',
      filter: ['match', ['get', 'kind'], ['farmland', 'meadow', 'allotments', 'village_green'], true, false],
      minzoom: 8,
      paint: {
        'fill-color': colors.landcover_farmland,
        'fill-opacity': ['interpolate', ['linear'], ['zoom'], 8, 0.2, 11, 0.5],
      },
    },
    {
      id: 'world_landuse_park',
      type: 'fill',
      source: worldSourceId,
      'source-layer': 'landuse',
      filter: ['match', ['get', 'kind'], ['park', 'garden', 'recreation_ground', 'zoo', 'pitch', 'playground'], true, false],
      minzoom: 8,
      paint: {
        'fill-color': colors.landuse_park,
        'fill-opacity': ['interpolate', ['linear'], ['zoom'], 8, 0.3, 12, 0.6],
      },
    },
    {
      id: 'world_landuse_residential',
      type: 'fill',
      source: worldSourceId,
      'source-layer': 'landuse',
      filter: ['==', ['get', 'kind'], 'residential'],
      minzoom: 9,
      paint: {
        'fill-color': colors.landuse_residential,
        'fill-opacity': ['interpolate', ['linear'], ['zoom'], 9, 0.1, 12, 0.3],
      },
    },
    {
      id: 'world_landuse_commercial',
      type: 'fill',
      source: worldSourceId,
      'source-layer': 'landuse',
      filter: ['==', ['get', 'kind'], 'commercial'],
      minzoom: 10,
      paint: {
        'fill-color': colors.landuse_commercial,
        'fill-opacity': 0.4,
      },
    },
    {
      id: 'world_landuse_industrial',
      type: 'fill',
      source: worldSourceId,
      'source-layer': 'landuse',
      filter: ['==', ['get', 'kind'], 'industrial'],
      minzoom: 10,
      paint: {
        'fill-color': colors.landuse_industrial,
        'fill-opacity': 0.4,
      },
    },
    {
      id: 'world_landuse_hospital',
      type: 'fill',
      source: worldSourceId,
      'source-layer': 'landuse',
      filter: ['==', ['get', 'kind'], 'hospital'],
      minzoom: 12,
      paint: {
        'fill-color': colors.landuse_hospital,
        'fill-opacity': 0.4,
      },
    },
    {
      id: 'world_landuse_school',
      type: 'fill',
      source: worldSourceId,
      'source-layer': 'landuse',
      filter: ['match', ['get', 'kind'], ['school', 'university'], true, false],
      minzoom: 12,
      paint: {
        'fill-color': colors.landuse_school,
        'fill-opacity': 0.4,
      },
    },
    {
      id: 'world_landuse_cemetery',
      type: 'fill',
      source: worldSourceId,
      'source-layer': 'landuse',
      filter: ['==', ['get', 'kind'], 'cemetery'],
      minzoom: 12,
      paint: {
        'fill-color': colors.landuse_cemetery,
        'fill-opacity': 0.5,
      },
    },
    {
      id: 'world_landuse_military',
      type: 'fill',
      source: worldSourceId,
      'source-layer': 'landuse',
      filter: ['==', ['get', 'kind'], 'military'],
      minzoom: 10,
      paint: {
        'fill-color': colors.landuse_military,
        'fill-opacity': 0.3,
      },
    },

    // ----------------------------------------
    // Waterways (physical_line — rivers, streams, canals)
    // ----------------------------------------
    {
      id: 'world_waterway_river',
      type: 'line',
      source: worldSourceId,
      // Protomaps Basemap: waterways (rivers, canals) are in the 'water' layer
      'source-layer': 'water',
      filter: ['match', ['get', 'kind'], ['river', 'canal'], true, false],
      minzoom: 6,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': colors.waterway,
        'line-width': ['interpolate', ['linear'], ['zoom'], 6, 0.5, 10, 1.5, 14, 3],
        'line-opacity': ['interpolate', ['linear'], ['zoom'], 6, 0.3, 9, 0.7, 12, 1],
      },
    },
    {
      id: 'world_waterway_stream',
      type: 'line',
      source: worldSourceId,
      'source-layer': 'water',
      filter: ['match', ['get', 'kind'], ['stream', 'ditch', 'drain'], true, false],
      minzoom: 11,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': colors.waterway,
        'line-width': ['interpolate', ['linear'], ['zoom'], 11, 0.3, 14, 1],
        'line-opacity': 0.6,
      },
    },

    // ----------------------------------------
    // Boundaries
    // ----------------------------------------
    {
      id: 'world_boundary_country',
      type: 'line',
      source: worldSourceId,
      'source-layer': 'boundaries',
      // WHY kind=='country': Protomaps Basemap schema uses kind/kind_detail in boundaries
      // layer, not pmap:min_admin_level. 'country' = admin_level 2 (national borders).
      filter: ['==', ['get', 'kind'], 'country'],
      layout: { 'line-join': 'round' },
      paint: {
        'line-color': colors.boundary_country,
        'line-width': ['interpolate', ['linear'], ['zoom'], 0, 0.3, 3, 0.8, 5, 1.5, 8, 2.5, 12, 3],
        'line-opacity': 0.8,
      },
    },
    {
      id: 'world_boundary_state',
      type: 'line',
      source: worldSourceId,
      'source-layer': 'boundaries',
      // 'region' = admin_level 4 (state/province borders)
      filter: ['==', ['get', 'kind'], 'region'],
      minzoom: 4,
      layout: { 'line-join': 'round' },
      paint: {
        'line-color': colors.boundary_state,
        'line-width': ['interpolate', ['linear'], ['zoom'], 4, 0.3, 8, 0.8, 12, 1.2],
        'line-opacity': 0.5,
        'line-dasharray': [3, 2],
      },
    },

    // ----------------------------------------
    // Buildings (flat footprint + 3D extrusion)
    // ----------------------------------------
    {
      id: 'world_building',
      type: 'fill',
      source: worldSourceId,
      'source-layer': 'buildings',
      minzoom: 13,
      paint: {
        'fill-color': colors.building,
        'fill-opacity': ['interpolate', ['linear'], ['zoom'], 13, 0.3, 15, 0.6],
        'fill-outline-color': colors.building_outline,
      },
    },
    {
      // WHY fill-extrusion: Protomaps Basemap 'buildings' layer carries 'height' and
      // 'min_height' (in metres). fill-extrusion turns those into 3D blocks starting
      // at zoom 15 so the effect fades in naturally as the user zooms in.
      // NOTE: Protomaps uses 'height'/'min_height', not OpenMapTiles 'render_height'.
      id: 'world_building_3d',
      type: 'fill-extrusion',
      source: worldSourceId,
      'source-layer': 'buildings',
      minzoom: 15,
      paint: {
        'fill-extrusion-color': colors.building_extrusion,
        'fill-extrusion-height': ['interpolate', ['linear'], ['zoom'],
          15, 0,
          16, ['coalesce', ['get', 'height'], 5],
        ],
        'fill-extrusion-base': ['coalesce', ['get', 'min_height'], 0],
        'fill-extrusion-opacity': ['interpolate', ['linear'], ['zoom'], 15, 0, 16, 0.5, 18, 0.7],
      },
    },

    // ----------------------------------------
    // Roads — casings (wide outline underneath for halo effect)
    // WHY casing+fill: creates visual hierarchy (motorway > primary > minor)
    // ----------------------------------------
    {
      id: 'world_road_highway_casing',
      type: 'line',
      source: worldSourceId,
      'source-layer': 'roads',
      filter: ['==', ['get', 'kind'], 'highway'],
      minzoom: 5,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': colors.road_motorway_casing,
        'line-width': ['interpolate', ['exponential', 1.5], ['zoom'], 5, 1, 8, 2, 12, 5, 14, 10],
        'line-opacity': ['interpolate', ['linear'], ['zoom'], 5, 0.3, 7, 0.7, 10, 1],
      },
    },
    {
      id: 'world_road_major_casing',
      type: 'line',
      source: worldSourceId,
      'source-layer': 'roads',
      filter: ['==', ['get', 'kind'], 'major_road'],
      minzoom: 8,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': colors.road_primary_casing,
        'line-width': ['interpolate', ['exponential', 1.5], ['zoom'], 8, 1, 12, 3, 14, 7],
        'line-opacity': ['interpolate', ['linear'], ['zoom'], 8, 0.3, 10, 0.7],
      },
    },
    {
      id: 'world_road_medium_casing',
      type: 'line',
      source: worldSourceId,
      'source-layer': 'roads',
      filter: ['==', ['get', 'kind'], 'medium_road'],
      minzoom: 10,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': colors.road_tertiary_casing,
        'line-width': ['interpolate', ['exponential', 1.5], ['zoom'], 10, 0.5, 12, 2, 14, 5],
      },
    },
    {
      id: 'world_road_minor_casing',
      type: 'line',
      source: worldSourceId,
      'source-layer': 'roads',
      filter: ['==', ['get', 'kind'], 'minor_road'],
      minzoom: 12,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': colors.road_minor_casing,
        'line-width': ['interpolate', ['exponential', 1.5], ['zoom'], 12, 0.5, 14, 3],
      },
    },

    // ----------------------------------------
    // Roads — fills (narrower colored line on top of casing)
    // ----------------------------------------
    {
      id: 'world_road_highway',
      type: 'line',
      source: worldSourceId,
      'source-layer': 'roads',
      filter: ['==', ['get', 'kind'], 'highway'],
      minzoom: 5,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': colors.road_motorway,
        'line-width': ['interpolate', ['exponential', 1.5], ['zoom'], 5, 0.5, 8, 1.2, 12, 3.5, 14, 8],
        'line-opacity': ['interpolate', ['linear'], ['zoom'], 5, 0.3, 7, 0.7, 10, 1],
      },
    },
    {
      id: 'world_road_major',
      type: 'line',
      source: worldSourceId,
      'source-layer': 'roads',
      filter: ['==', ['get', 'kind'], 'major_road'],
      minzoom: 8,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': colors.road_primary,
        'line-width': ['interpolate', ['exponential', 1.5], ['zoom'], 8, 0.5, 12, 2, 14, 5],
        'line-opacity': ['interpolate', ['linear'], ['zoom'], 8, 0.3, 10, 0.7],
      },
    },
    {
      id: 'world_road_medium',
      type: 'line',
      source: worldSourceId,
      'source-layer': 'roads',
      filter: ['==', ['get', 'kind'], 'medium_road'],
      minzoom: 10,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': colors.road_tertiary,
        'line-width': ['interpolate', ['exponential', 1.5], ['zoom'], 10, 0.3, 12, 1.5, 14, 3.5],
      },
    },
    {
      id: 'world_road_minor',
      type: 'line',
      source: worldSourceId,
      'source-layer': 'roads',
      filter: ['==', ['get', 'kind'], 'minor_road'],
      minzoom: 12,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': colors.road_minor,
        'line-width': ['interpolate', ['exponential', 1.5], ['zoom'], 12, 0.3, 14, 2],
      },
    },
    {
      id: 'world_road_path',
      type: 'line',
      source: worldSourceId,
      'source-layer': 'roads',
      filter: ['==', ['get', 'kind'], 'other'],
      minzoom: 14,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': colors.road_path,
        'line-width': 1,
        'line-dasharray': [2, 1],
      },
    },

    // ----------------------------------------
    // Transit (railways)
    // ----------------------------------------
    {
      id: 'world_transit_rail',
      type: 'line',
      source: worldSourceId,
      // Railways are in the 'roads' layer in Protomaps Basemap (no separate transit layer)
      'source-layer': 'roads',
      filter: ['match', ['get', 'kind'], ['rail', 'narrow_gauge'], true, false],
      minzoom: 9,
      layout: { 'line-join': 'round' },
      paint: {
        'line-color': colors.rail,
        'line-width': ['interpolate', ['linear'], ['zoom'], 9, 0.5, 12, 1.5, 14, 2],
        'line-opacity': ['interpolate', ['linear'], ['zoom'], 9, 0.3, 11, 0.6],
      },
    },
    {
      id: 'world_transit_rail_dash',
      type: 'line',
      source: worldSourceId,
      'source-layer': 'roads',
      filter: ['match', ['get', 'kind'], ['rail', 'narrow_gauge'], true, false],
      minzoom: 9,
      layout: { 'line-join': 'round' },
      paint: {
        'line-color': colors.rail_dash,
        'line-width': ['interpolate', ['linear'], ['zoom'], 9, 0.3, 12, 1, 14, 1.5],
        'line-dasharray': [3, 3],
        'line-opacity': ['interpolate', ['linear'], ['zoom'], 9, 0.3, 11, 0.6],
      },
    },
    {
      id: 'world_transit_subway',
      type: 'line',
      source: worldSourceId,
      'source-layer': 'roads',
      filter: ['match', ['get', 'kind'], ['subway', 'light_rail', 'tram'], true, false],
      minzoom: 11,
      layout: { 'line-join': 'round' },
      paint: {
        'line-color': colors.rail,
        'line-width': ['interpolate', ['linear'], ['zoom'], 11, 0.5, 14, 1.5],
        'line-dasharray': [2, 2],
        'line-opacity': 0.5,
      },
    },
  ] as LayerSpecification[];

  // ========================================
  // Labels — placed on top of all layers (including regional content)
  // so they remain visible globally. MapLibre symbol collision detection
  // prevents duplication with regional labels in overlapping areas.
  // ========================================
  const labels: LayerSpecification[] = [
    // ----------------------------------------
    // Water labels
    // ----------------------------------------
    {
      id: 'world_label_ocean',
      type: 'symbol',
      source: worldSourceId,
      'source-layer': 'places',
      filter: ['==', ['get', 'kind'], 'ocean'],
      layout: {
        'text-field': ['coalesce', ['get', 'name:en'], ['get', 'name']],
        'text-size': ['interpolate', ['linear'], ['zoom'], 1, 11, 4, 18, 8, 22],
        // Noto Sans Regular for water labels style (italic not in glyph stack)
        'text-font': ['Noto Sans Regular'],
        'text-max-width': 9,
        'text-letter-spacing': 0.2,
        'text-transform': 'uppercase',
      },
      paint: {
        'text-color': colors.label_water,
        'text-halo-color': colors.ocean_deep,
        'text-halo-width': 2,
      },
    },
    {
      id: 'world_label_sea',
      type: 'symbol',
      source: worldSourceId,
      'source-layer': 'places',
      filter: ['match', ['get', 'kind'], ['sea', 'bay', 'strait', 'gulf'], true, false],
      minzoom: 2,
      layout: {
        'text-field': ['coalesce', ['get', 'name:en'], ['get', 'name']],
        'text-size': ['interpolate', ['linear'], ['zoom'], 2, 9, 5, 13, 8, 16],
        'text-font': ['Noto Sans Regular'],
        'text-max-width': 8,
        'text-letter-spacing': 0.1,
      },
      paint: {
        'text-color': colors.label_water,
        'text-halo-color': colors.ocean_deep,
        'text-halo-width': 1.5,
      },
    },
    // world_label_water_name removed: Protomaps Basemap has no 'physical_line' layer
    // and the 'water' layer has no 'name' field. River line labels are unavailable
    // in this tile schema. Use regional OpenMapTiles tiles for waterway names.

    // ----------------------------------------
    // Continent labels (z0–z3)
    // ----------------------------------------
    {
      id: 'world_label_continent',
      type: 'symbol',
      source: worldSourceId,
      'source-layer': 'places',
      filter: ['==', ['get', 'kind'], 'continent'],
      maxzoom: 3,
      layout: {
        'text-field': ['coalesce', ['get', 'name:en'], ['get', 'name']],
        'text-size': ['interpolate', ['linear'], ['zoom'], 0, 10, 2, 14],
        'text-font': ['Noto Sans Regular'],
        'text-max-width': 12,
        'text-letter-spacing': 0.15,
      },
      paint: {
        'text-color': colors.label_secondary,
        'text-halo-color': colors.background,
        'text-halo-width': 2,
      },
    },

    // ----------------------------------------
    // Country labels
    // ----------------------------------------
    {
      id: 'world_label_country',
      type: 'symbol',
      source: worldSourceId,
      'source-layer': 'places',
      filter: ['==', ['get', 'kind'], 'country'],
      layout: {
        'text-field': ['coalesce', ['get', 'name:en'], ['get', 'name']],
        'text-size': ['interpolate', ['linear'], ['zoom'], 1, 9, 3, 12, 5, 15, 8, 18],
        'text-font': ['Noto Sans Bold'],
        'text-max-width': 10,
        'text-transform': 'uppercase',
        'text-letter-spacing': 0.1,
        'text-allow-overlap': false,
        'text-padding': 5,
      },
      paint: {
        'text-color': colors.label_primary,
        'text-halo-color': colors.background,
        'text-halo-width': 2,
      },
    },

    // ----------------------------------------
    // State / province labels
    // ----------------------------------------
    {
      id: 'world_label_state',
      type: 'symbol',
      source: worldSourceId,
      'source-layer': 'places',
      filter: ['==', ['get', 'kind'], 'state'],
      minzoom: 5,
      layout: {
        'text-field': ['coalesce', ['get', 'name:en'], ['get', 'name']],
        'text-size': ['interpolate', ['linear'], ['zoom'], 5, 8, 8, 11, 12, 14],
        'text-font': ['Noto Sans Regular'],
        'text-max-width': 10,
        'text-letter-spacing': 0.05,
        'text-allow-overlap': false,
        'text-padding': 3,
      },
      paint: {
        'text-color': colors.label_secondary,
        'text-halo-color': colors.background,
        'text-halo-width': 1.5,
        'text-opacity': ['interpolate', ['linear'], ['zoom'], 5, 0.5, 8, 0.8],
      },
    },

    // ----------------------------------------
    // Place labels — progressive disclosure by kind
    // ----------------------------------------
    {
      id: 'world_label_capital',
      type: 'symbol',
      source: worldSourceId,
      'source-layer': 'places',
      filter: ['match', ['get', 'kind'], ['country_capital', 'state_capital'], true, false],
      minzoom: 3,
      layout: {
        'text-field': ['coalesce', ['get', 'name:en'], ['get', 'name']],
        'text-size': ['interpolate', ['linear'], ['zoom'], 3, 9, 6, 13, 10, 16, 14, 18],
        'text-font': ['Noto Sans Bold'],
        'text-max-width': 8,
        'text-allow-overlap': false,
        'text-padding': 3,
      },
      paint: {
        'text-color': colors.label_primary,
        'text-halo-color': colors.background,
        'text-halo-width': 2,
      },
    },
    {
      id: 'world_label_city',
      type: 'symbol',
      source: worldSourceId,
      'source-layer': 'places',
      filter: ['==', ['get', 'kind'], 'city'],
      minzoom: 4,
      layout: {
        'text-field': ['coalesce', ['get', 'name:en'], ['get', 'name']],
        'text-size': ['interpolate', ['linear'], ['zoom'], 4, 8, 7, 12, 10, 15, 14, 17],
        'text-font': ['Noto Sans Regular'],
        'text-max-width': 8,
        'text-allow-overlap': false,
        'text-padding': 3,
      },
      paint: {
        'text-color': colors.label_primary,
        'text-halo-color': colors.background,
        'text-halo-width': 1.5,
      },
    },
    {
      id: 'world_label_town',
      type: 'symbol',
      source: worldSourceId,
      'source-layer': 'places',
      filter: ['==', ['get', 'kind'], 'town'],
      minzoom: 7,
      layout: {
        'text-field': ['coalesce', ['get', 'name:en'], ['get', 'name']],
        'text-size': ['interpolate', ['linear'], ['zoom'], 7, 8, 10, 11, 14, 14],
        'text-font': ['Noto Sans Regular'],
        'text-max-width': 8,
        'text-allow-overlap': false,
        'text-padding': 2,
      },
      paint: {
        'text-color': colors.label_primary,
        'text-halo-color': colors.background,
        'text-halo-width': 1.5,
      },
    },
    {
      id: 'world_label_village',
      type: 'symbol',
      source: worldSourceId,
      'source-layer': 'places',
      filter: ['match', ['get', 'kind'], ['village', 'hamlet'], true, false],
      minzoom: 10,
      layout: {
        'text-field': ['coalesce', ['get', 'name:en'], ['get', 'name']],
        'text-size': ['interpolate', ['linear'], ['zoom'], 10, 8, 14, 12],
        'text-font': ['Noto Sans Regular'],
        'text-max-width': 8,
        'text-allow-overlap': false,
        'text-padding': 2,
      },
      paint: {
        'text-color': colors.label_secondary,
        'text-halo-color': colors.background,
        'text-halo-width': 1,
      },
    },
    {
      id: 'world_label_suburb',
      type: 'symbol',
      source: worldSourceId,
      'source-layer': 'places',
      filter: ['match', ['get', 'kind'], ['suburb', 'neighbourhood'], true, false],
      minzoom: 12,
      layout: {
        'text-field': ['coalesce', ['get', 'name:en'], ['get', 'name']],
        'text-size': ['interpolate', ['linear'], ['zoom'], 12, 8, 14, 11],
        'text-font': ['Noto Sans Regular'],
        'text-max-width': 8,
        'text-transform': 'uppercase',
        'text-letter-spacing': 0.05,
      },
      paint: {
        'text-color': colors.label_secondary,
        'text-halo-color': colors.background,
        'text-halo-width': 1,
        'text-opacity': 0.7,
      },
    },

    // ----------------------------------------
    // Road labels
    // ----------------------------------------
    {
      id: 'world_label_road_major',
      type: 'symbol',
      source: worldSourceId,
      'source-layer': 'roads',
      filter: ['all',
        ['match', ['get', 'kind'], ['highway', 'major_road'], true, false],
        ['has', 'name'],
      ],
      minzoom: 10,
      layout: {
        'text-field': ['coalesce', ['get', 'name:en'], ['get', 'name']],
        'text-size': ['interpolate', ['linear'], ['zoom'], 10, 8, 14, 12],
        'text-font': ['Noto Sans Regular'],
        'symbol-placement': 'line',
        'text-max-angle': 30,
        'text-padding': 5,
      },
      paint: {
        'text-color': colors.label_road,
        'text-halo-color': colors.label_road_halo,
        'text-halo-width': 2,
      },
    },
    {
      id: 'world_label_road_minor',
      type: 'symbol',
      source: worldSourceId,
      'source-layer': 'roads',
      filter: ['all',
        ['match', ['get', 'kind'], ['medium_road', 'minor_road'], true, false],
        ['has', 'name'],
      ],
      minzoom: 13,
      layout: {
        'text-field': ['coalesce', ['get', 'name:en'], ['get', 'name']],
        'text-size': ['interpolate', ['linear'], ['zoom'], 13, 8, 14, 10],
        'text-font': ['Noto Sans Regular'],
        'symbol-placement': 'line',
        'text-max-angle': 30,
        'text-padding': 5,
      },
      paint: {
        'text-color': colors.label_road,
        'text-halo-color': colors.label_road_halo,
        'text-halo-width': 1.5,
      },
    },

    // ----------------------------------------
    // POI labels (high zoom only)
    // ----------------------------------------
    {
      id: 'world_label_poi',
      type: 'symbol',
      source: worldSourceId,
      'source-layer': 'pois',
      filter: ['has', 'name'],
      minzoom: 14,
      layout: {
        'text-field': ['coalesce', ['get', 'name:en'], ['get', 'name']],
        'text-size': 10,
        'text-font': ['Noto Sans Regular'],
        'text-max-width': 8,
        'text-allow-overlap': false,
        'text-padding': 3,
        'text-offset': [0, 0.8],
        'text-anchor': 'top',
      },
      paint: {
        'text-color': colors.poi,
        'text-halo-color': colors.poi_halo,
        'text-halo-width': 1,
      },
    },
  ] as LayerSpecification[];

  return { base, labels };
}

/**
 * Layer ordering follows Organic Maps / OSM Carto pattern:
 * background ? water ? landcover ? landuse ? park ? buildings ?
 * transportation (casing ? fill) ? labels (roads ? water ? places)
 *
 * Key improvements over basic styles:
 * - Proper road casings with line-cap/join for rounded intersections
 * - Farmland, hospital, school, cemetery landuse differentiation
 * - Building 3D extrusion at high zoom
 * - Bridge/tunnel detection for roads
 * - Smooth zoom transitions with interpolation
 * - Path/cycleway layers for pedestrian navigation
 * - Better label hierarchy with priority ordering
 *
 * @param sourceId - Vector tile source ID (e.g. 'openmaptiles')
 * @param colors - Theme color palette
 * @returns Array of MapLibre layer specifications
 */
function buildLayers(sourceId: string, colors: ThemeColors, options?: MapStyleOptions): LayerSpecification[] {
  // Terrain hillshade layer — placed after background, before all fill layers.
  // Water/fill layers render on top so ocean & lake surfaces appear flat (hillshade hidden under water).
  // illumination-direction 315° = standard northwest sun angle used in cartography.
  const terrainLayers: LayerSpecification[] = options?.showTerrain ? [{
    id: 'terrain_hillshade',
    type: 'hillshade' as const,
    source: TERRAIN_SOURCE_ID,
    paint: {
      'hillshade-shadow-color': colors.hillshade_shadow,
      'hillshade-highlight-color': colors.hillshade_highlight,
      'hillshade-accent-color': colors.hillshade_accent,
      'hillshade-illumination-direction': 315,
      'hillshade-illumination-anchor': 'viewport' as const,
      'hillshade-exaggeration': 0.35,
    },
  }] : [];

  return [
    // ========================================
    // 1. Background
    // ========================================
    {
      id: 'background',
      type: 'background',
      paint: { 'background-color': colors.background },
    },

    // Terrain hillshade renders after background; water/fill layers cover it so oceans & lakes stay flat.
    ...terrainLayers,

    // ========================================
    // 2. Water — Oceans, Seas, Glaciers, Lakes, Rivers
    // Ordered: ocean tint ? general water ? glacier tint ? waterways
    // WHY separate ocean layer: Natural Earth z0–5 data uses class='ocean' for world sea/ocean polygons.
    // A deeper blue visually communicates depth and clearly distinguishes open ocean from land.
    // ========================================
    {
      // Open ocean & seas — derived from Natural Earth at z0–5. Richer/deeper blue.
      id: 'water_ocean',
      type: 'fill',
      source: sourceId,
      'source-layer': 'water',
      filter: ['==', 'class', 'ocean'],
      paint: {
        'fill-color': colors.ocean_deep,
        'fill-antialias': true,
      },
    },
    {
      // Lakes, rivers, reservoirs, ponds, docks — all non-ocean, non-glacier water.
      id: 'water',
      type: 'fill',
      source: sourceId,
      'source-layer': 'water',
      filter: ['all',
        ['!=', 'class', 'ocean'],
        ['!=', 'class', 'glacier'],
        ['!=', 'class', 'ice'],
      ],
      paint: {
        'fill-color': colors.water,
        'fill-antialias': true,
        'fill-outline-color': colors.water_outline,
      },
    },
    {
      // Glaciers and ice caps — bluish-white, high opacity.
      id: 'water_glacier',
      type: 'fill',
      source: sourceId,
      'source-layer': 'water',
      filter: ['any', ['==', 'class', 'glacier'], ['==', 'class', 'ice']],
      paint: {
        'fill-color': colors.water_glacier,
        'fill-antialias': true,
        'fill-opacity': 0.9,
      },
    },
    {
      // Rivers, streams, drains, ditches (canals handled separately below)
      id: 'waterway',
      type: 'line',
      source: sourceId,
      'source-layer': 'waterway',
      filter: ['!=', 'class', 'canal'],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': colors.waterway,
        'line-width': ['interpolate', ['exponential', 1.5], ['zoom'],
          6, 0.3, 10, 1, 14, 3, 18, 8],
        'line-opacity': 0.8,
      },
    },
    {
      // Canals — wider line, distinct color, visible from zoom 8
      id: 'waterway_canal',
      type: 'line',
      source: sourceId,
      'source-layer': 'waterway',
      filter: ['==', 'class', 'canal'],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': colors.waterway_canal,
        'line-width': ['interpolate', ['exponential', 1.5], ['zoom'],
          8, 0.5, 12, 2, 16, 5],
        'line-opacity': 0.85,
      },
      minzoom: 8,
    },

    // ========================================
    // 3. Landcover
    // ========================================
    {
      id: 'landcover_grass',
      type: 'fill',
      source: sourceId,
      'source-layer': 'landcover',
      filter: ['==', 'class', 'grass'],
      paint: {
        'fill-color': colors.landcover_grass,
        'fill-opacity': ['interpolate', ['linear'], ['zoom'], 4, 0.3, 8, 0.6],
      },
    },
    {
      id: 'landcover_wood',
      type: 'fill',
      source: sourceId,
      'source-layer': 'landcover',
      filter: ['==', 'class', 'wood'],
      paint: {
        'fill-color': colors.landcover_wood,
        'fill-opacity': ['interpolate', ['linear'], ['zoom'], 4, 0.3, 8, 0.65],
      },
    },
    {
      id: 'landcover_sand',
      type: 'fill',
      source: sourceId,
      'source-layer': 'landcover',
      filter: ['==', 'class', 'sand'],
      paint: {
        'fill-color': colors.landcover_sand,
        'fill-opacity': 0.5,
      },
    },
    {
      id: 'landcover_farmland',
      type: 'fill',
      source: sourceId,
      'source-layer': 'landcover',
      filter: ['==', 'class', 'farmland'],
      paint: {
        'fill-color': colors.landcover_farmland,
        'fill-opacity': ['interpolate', ['linear'], ['zoom'], 6, 0.2, 10, 0.5],
      },
    },
    {
      id: 'landcover_scrub',
      type: 'fill',
      source: sourceId,
      'source-layer': 'landcover',
      filter: ['==', 'class', 'scrub'],
      paint: {
        'fill-color': colors.landcover_scrub,
        'fill-opacity': 0.4,
      },
    },
    {
      id: 'landcover_ice',
      type: 'fill',
      source: sourceId,
      'source-layer': 'landcover',
      filter: ['==', 'class', 'ice'],
      paint: {
        'fill-color': colors.landcover_ice,
        'fill-opacity': 0.8,
      },
    },

    // ========================================
    // 4. Landuse
    // ========================================
    {
      id: 'landuse_residential',
      type: 'fill',
      source: sourceId,
      'source-layer': 'landuse',
      filter: ['==', 'class', 'residential'],
      paint: {
        'fill-color': colors.landuse_residential,
        'fill-opacity': ['interpolate', ['linear'], ['zoom'], 8, 0.1, 12, 0.4],
      },
      minzoom: 8,
    },
    {
      id: 'landuse_park',
      type: 'fill',
      source: sourceId,
      'source-layer': 'landuse',
      filter: ['any', ['==', 'class', 'park'], ['==', 'class', 'recreation_ground']],
      paint: {
        'fill-color': colors.landuse_park,
        'fill-opacity': 0.5,
      },
    },
    {
      id: 'landuse_cemetery',
      type: 'fill',
      source: sourceId,
      'source-layer': 'landuse',
      filter: ['==', 'class', 'cemetery'],
      paint: {
        'fill-color': colors.landuse_cemetery,
        'fill-opacity': 0.4,
      },
      minzoom: 10,
    },
    {
      id: 'landuse_hospital',
      type: 'fill',
      source: sourceId,
      'source-layer': 'landuse',
      filter: ['==', 'class', 'hospital'],
      paint: {
        'fill-color': colors.landuse_hospital,
        'fill-opacity': 0.3,
      },
      minzoom: 11,
    },
    {
      id: 'landuse_school',
      type: 'fill',
      source: sourceId,
      'source-layer': 'landuse',
      filter: ['any', ['==', 'class', 'school'], ['==', 'class', 'university']],
      paint: {
        'fill-color': colors.landuse_school,
        'fill-opacity': 0.3,
      },
      minzoom: 11,
    },
    {
      id: 'landuse_commercial',
      type: 'fill',
      source: sourceId,
      'source-layer': 'landuse',
      filter: ['any', ['==', 'class', 'commercial'], ['==', 'class', 'retail']],
      paint: {
        'fill-color': colors.landuse_commercial,
        'fill-opacity': 0.3,
      },
      minzoom: 10,
    },
    {
      id: 'landuse_industrial',
      type: 'fill',
      source: sourceId,
      'source-layer': 'landuse',
      filter: ['==', 'class', 'industrial'],
      paint: {
        'fill-color': colors.landuse_industrial,
        'fill-opacity': 0.3,
      },
      minzoom: 10,
    },
    {
      id: 'landuse_military',
      type: 'fill',
      source: sourceId,
      'source-layer': 'landuse',
      filter: ['==', 'class', 'military'],
      paint: {
        'fill-color': colors.landuse_military,
        'fill-opacity': 0.2,
      },
      minzoom: 8,
    },

    // ========================================
    // 5. Park (separate source-layer)
    // ========================================
    {
      id: 'park_fill',
      type: 'fill',
      source: sourceId,
      'source-layer': 'park',
      paint: {
        'fill-color': colors.landuse_park,
        'fill-opacity': 0.3,
      },
    },

    // ========================================
    // 6. Aeroway
    // ========================================
    {
      id: 'aeroway_fill',
      type: 'fill',
      source: sourceId,
      'source-layer': 'aeroway',
      filter: ['==', '$type', 'Polygon'],
      paint: {
        'fill-color': colors.aeroway,
        'fill-opacity': 0.4,
      },
      minzoom: 11,
    },
    {
      id: 'aeroway_runway',
      type: 'line',
      source: sourceId,
      'source-layer': 'aeroway',
      filter: ['all', ['==', '$type', 'LineString'], ['==', 'class', 'runway']],
      paint: {
        'line-color': colors.aeroway_runway,
        'line-width': ['interpolate', ['linear'], ['zoom'], 11, 3, 14, 12, 18, 30],
      },
      minzoom: 10,
    },
    {
      id: 'aeroway_taxiway',
      type: 'line',
      source: sourceId,
      'source-layer': 'aeroway',
      filter: ['all', ['==', '$type', 'LineString'], ['==', 'class', 'taxiway']],
      paint: {
        'line-color': colors.aeroway_runway,
        'line-width': ['interpolate', ['linear'], ['zoom'], 12, 1, 14, 4, 18, 10],
      },
      minzoom: 12,
    },

    // ========================================
    // 7. Boundaries
    // ========================================
    {
      id: 'boundary_country',
      type: 'line',
      source: sourceId,
      'source-layer': 'boundary',
      filter: ['==', 'admin_level', 2],
      layout: { 'line-join': 'round' },
      paint: {
        'line-color': colors.boundary_country,
        'line-width': ['interpolate', ['linear'], ['zoom'], 1, 0.8, 4, 1.5, 8, 2.5, 14, 4],
        'line-dasharray': [4, 2],
        'line-opacity': 0.7,
      },
    },
    {
      id: 'boundary_state',
      type: 'line',
      source: sourceId,
      'source-layer': 'boundary',
      filter: ['==', 'admin_level', 4],
      layout: { 'line-join': 'round' },
      paint: {
        'line-color': colors.boundary_state,
        'line-width': ['interpolate', ['linear'], ['zoom'], 4, 0.3, 8, 0.8, 14, 1.5],
        'line-dasharray': [3, 2],
        'line-opacity': 0.5,
      },
      minzoom: 4,
    },

    // ========================================
    // 8. Buildings
    // ========================================
    {
      id: 'building',
      type: 'fill',
      source: sourceId,
      'source-layer': 'building',
      paint: {
        'fill-color': colors.building,
        'fill-outline-color': colors.building_outline,
        'fill-opacity': ['interpolate', ['linear'], ['zoom'], 13, 0.2, 15, 0.6, 17, 0.85],
      },
      minzoom: 13,
    },
    // WHY: 3D building extrusion gives depth similar to Organic Maps at high zoom
    {
      id: 'building_3d',
      type: 'fill-extrusion',
      source: sourceId,
      'source-layer': 'building',
      paint: {
        'fill-extrusion-color': colors.building_extrusion,
        'fill-extrusion-height': ['interpolate', ['linear'], ['zoom'],
          15, 0,
          16, ['*', ['coalesce', ['get', 'render_height'], 5], 1],
        ],
        'fill-extrusion-base': 0,
        'fill-extrusion-opacity': ['interpolate', ['linear'], ['zoom'], 15, 0, 16, 0.5, 18, 0.7],
      },
      minzoom: 15,
    },

    // ========================================
    // 9. Transportation — Casings (drawn first, under fills)
    // WHY: Casing + fill pattern creates the proper road outline effect
    // seen in Organic Maps and OSM Carto renderers.
    // ========================================

    // --- Tunnel casings (dashed) ---
    {
      id: 'tunnel_motorway_casing',
      type: 'line',
      source: sourceId,
      'source-layer': 'transportation',
      filter: ['all', ['==', 'class', 'motorway'], ['==', 'brunnel', 'tunnel']],
      layout: { 'line-cap': 'butt', 'line-join': 'miter' },
      paint: {
        'line-color': colors.road_motorway_casing,
        'line-width': ['interpolate', ['exponential', 1.5], ['zoom'], 5, 0.8, 10, 3, 14, 10, 18, 28],
        'line-dasharray': [0.5, 0.25],
        'line-opacity': 0.5,
      },
      minzoom: 5,
    },

    // --- Regular road casings ---
    {
      id: 'road_motorway_casing',
      type: 'line',
      source: sourceId,
      'source-layer': 'transportation',
      filter: ['all', ['==', 'class', 'motorway'], ['!=', 'brunnel', 'tunnel']],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': colors.road_motorway_casing,
        'line-width': ['interpolate', ['exponential', 1.5], ['zoom'], 5, 0.8, 10, 3, 14, 10, 18, 28],
      },
      minzoom: 5,
    },
    {
      id: 'road_trunk_casing',
      type: 'line',
      source: sourceId,
      'source-layer': 'transportation',
      filter: ['all', ['==', 'class', 'trunk'], ['!=', 'brunnel', 'tunnel']],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': colors.road_trunk_casing,
        'line-width': ['interpolate', ['exponential', 1.5], ['zoom'], 6, 0.6, 10, 2.5, 14, 8, 18, 24],
      },
      minzoom: 6,
    },
    {
      id: 'road_primary_casing',
      type: 'line',
      source: sourceId,
      'source-layer': 'transportation',
      filter: ['all', ['==', 'class', 'primary'], ['!=', 'brunnel', 'tunnel']],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': colors.road_primary_casing,
        'line-width': ['interpolate', ['exponential', 1.5], ['zoom'], 7, 0.5, 10, 2, 14, 7, 18, 20],
      },
      minzoom: 7,
    },
    {
      id: 'road_secondary_casing',
      type: 'line',
      source: sourceId,
      'source-layer': 'transportation',
      filter: ['all', ['==', 'class', 'secondary'], ['!=', 'brunnel', 'tunnel']],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': colors.road_secondary_casing,
        'line-width': ['interpolate', ['exponential', 1.5], ['zoom'], 8, 0.5, 14, 5, 18, 16],
      },
      minzoom: 8,
    },
    {
      id: 'road_tertiary_casing',
      type: 'line',
      source: sourceId,
      'source-layer': 'transportation',
      filter: ['all', ['==', 'class', 'tertiary'], ['!=', 'brunnel', 'tunnel']],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': colors.road_tertiary_casing,
        'line-width': ['interpolate', ['exponential', 1.5], ['zoom'], 9, 0.4, 14, 4, 18, 14],
      },
      minzoom: 9,
    },
    {
      id: 'road_minor_casing',
      type: 'line',
      source: sourceId,
      'source-layer': 'transportation',
      filter: ['any', ['==', 'class', 'minor'], ['==', 'class', 'service']],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': colors.road_minor_casing,
        'line-width': ['interpolate', ['exponential', 1.5], ['zoom'], 12, 0.5, 14, 3, 18, 10],
      },
      minzoom: 12,
    },

    // ========================================
    // 10. Transportation — Fill layers (drawn over casings)
    // ========================================

    // --- Tunnel fills (slightly transparent) ---
    {
      id: 'tunnel_motorway_fill',
      type: 'line',
      source: sourceId,
      'source-layer': 'transportation',
      filter: ['all', ['==', 'class', 'motorway'], ['==', 'brunnel', 'tunnel']],
      layout: { 'line-cap': 'butt', 'line-join': 'miter' },
      paint: {
        'line-color': colors.road_motorway,
        'line-width': ['interpolate', ['exponential', 1.5], ['zoom'], 5, 0.4, 10, 2, 14, 8, 18, 24],
        'line-opacity': 0.6,
      },
      minzoom: 5,
    },

    // --- Regular road fills ---
    {
      id: 'road_minor_fill',
      type: 'line',
      source: sourceId,
      'source-layer': 'transportation',
      filter: ['any', ['==', 'class', 'minor'], ['==', 'class', 'service']],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': colors.road_minor,
        'line-width': ['interpolate', ['exponential', 1.5], ['zoom'], 12, 0.3, 14, 2, 18, 8],
      },
      minzoom: 12,
    },
    {
      id: 'road_tertiary_fill',
      type: 'line',
      source: sourceId,
      'source-layer': 'transportation',
      filter: ['all', ['==', 'class', 'tertiary'], ['!=', 'brunnel', 'tunnel']],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': colors.road_tertiary,
        'line-width': ['interpolate', ['exponential', 1.5], ['zoom'], 9, 0.2, 14, 3, 18, 12],
      },
      minzoom: 9,
    },
    {
      id: 'road_secondary_fill',
      type: 'line',
      source: sourceId,
      'source-layer': 'transportation',
      filter: ['all', ['==', 'class', 'secondary'], ['!=', 'brunnel', 'tunnel']],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': colors.road_secondary,
        'line-width': ['interpolate', ['exponential', 1.5], ['zoom'], 8, 0.3, 14, 4, 18, 14],
      },
      minzoom: 8,
    },
    {
      id: 'road_primary_fill',
      type: 'line',
      source: sourceId,
      'source-layer': 'transportation',
      filter: ['all', ['==', 'class', 'primary'], ['!=', 'brunnel', 'tunnel']],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': colors.road_primary,
        'line-width': ['interpolate', ['exponential', 1.5], ['zoom'], 7, 0.3, 10, 1.5, 14, 5.5, 18, 18],
      },
      minzoom: 7,
    },
    {
      id: 'road_trunk_fill',
      type: 'line',
      source: sourceId,
      'source-layer': 'transportation',
      filter: ['all', ['==', 'class', 'trunk'], ['!=', 'brunnel', 'tunnel']],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': colors.road_trunk,
        'line-width': ['interpolate', ['exponential', 1.5], ['zoom'], 6, 0.4, 10, 2, 14, 6.5, 18, 22],
      },
      minzoom: 6,
    },
    {
      id: 'road_motorway_fill',
      type: 'line',
      source: sourceId,
      'source-layer': 'transportation',
      filter: ['all', ['==', 'class', 'motorway'], ['!=', 'brunnel', 'tunnel']],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': colors.road_motorway,
        'line-width': ['interpolate', ['exponential', 1.5], ['zoom'], 5, 0.4, 10, 2, 14, 8, 18, 24],
      },
      minzoom: 5,
    },

    // --- Bridge overlay (thicker casing for bridge emphasis) ---
    {
      id: 'bridge_major_casing',
      type: 'line',
      source: sourceId,
      'source-layer': 'transportation',
      filter: ['all',
        ['==', 'brunnel', 'bridge'],
        ['any', ['==', 'class', 'motorway'], ['==', 'class', 'trunk'], ['==', 'class', 'primary']],
      ],
      layout: { 'line-cap': 'butt', 'line-join': 'miter' },
      paint: {
        'line-color': colors.building_outline,
        'line-width': ['interpolate', ['exponential', 1.5], ['zoom'], 10, 3.5, 14, 12, 18, 30],
        'line-opacity': 0.6,
      },
      minzoom: 10,
    },

    // --- Path / Cycleway / Track ---
    {
      id: 'road_path',
      type: 'line',
      source: sourceId,
      'source-layer': 'transportation',
      filter: ['any', ['==', 'class', 'path'], ['==', 'class', 'track']],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': colors.road_path,
        'line-width': ['interpolate', ['linear'], ['zoom'], 13, 0.5, 16, 1.5, 18, 3],
        'line-dasharray': [2, 1],
        'line-opacity': 0.6,
      },
      minzoom: 13,
    },

    // --- Railway ---
    {
      id: 'rail_casing',
      type: 'line',
      source: sourceId,
      'source-layer': 'transportation',
      filter: ['==', 'class', 'rail'],
      paint: {
        'line-color': colors.rail,
        'line-width': ['interpolate', ['linear'], ['zoom'], 9, 1, 14, 2.5, 18, 5],
      },
      minzoom: 9,
    },
    {
      id: 'rail_dash',
      type: 'line',
      source: sourceId,
      'source-layer': 'transportation',
      filter: ['==', 'class', 'rail'],
      paint: {
        'line-color': colors.rail_dash,
        'line-width': ['interpolate', ['linear'], ['zoom'], 9, 0.6, 14, 1.5, 18, 3],
        'line-dasharray': [3, 3],
      },
      minzoom: 9,
    },

    // ========================================
    // 11. Labels — Transportation names
    // ========================================
    {
      id: 'road_label_major',
      type: 'symbol',
      source: sourceId,
      'source-layer': 'transportation_name',
      filter: ['any',
        ['==', 'class', 'motorway'],
        ['==', 'class', 'trunk'],
        ['==', 'class', 'primary'],
      ],
      layout: {
        'text-field': ['coalesce', ['get', 'name:latin'], ['get', 'name']],
        'text-size': ['interpolate', ['linear'], ['zoom'], 10, 9, 14, 13, 18, 16],
        'text-font': ['Noto Sans Bold'],
        'symbol-placement': 'line',
        'text-rotation-alignment': 'map',
        'text-max-angle': 30,
        'text-padding': 4,
      },
      paint: {
        'text-color': colors.label_road,
        'text-halo-color': colors.label_road_halo,
        'text-halo-width': 2,
      },
      minzoom: 11,
    },
    {
      id: 'road_label_minor',
      type: 'symbol',
      source: sourceId,
      'source-layer': 'transportation_name',
      filter: ['any',
        ['==', 'class', 'secondary'],
        ['==', 'class', 'tertiary'],
      ],
      layout: {
        'text-field': ['coalesce', ['get', 'name:latin'], ['get', 'name']],
        'text-size': ['interpolate', ['linear'], ['zoom'], 12, 8, 14, 11, 18, 14],
        'text-font': ['Noto Sans Regular'],
        'symbol-placement': 'line',
        'text-rotation-alignment': 'map',
        'text-max-angle': 30,
        'text-padding': 4,
      },
      paint: {
        'text-color': colors.label_road,
        'text-halo-color': colors.label_road_halo,
        'text-halo-width': 1.5,
      },
      minzoom: 13,
    },

    // ========================================
    // 12. Labels — Water
    // ========================================
    {
      // Ocean names — large uppercase, visible globally from zoom 1.
      // WHY uppercase: standard cartographic convention for major water bodies.
      id: 'water_name_ocean',
      type: 'symbol',
      source: sourceId,
      'source-layer': 'water_name',
      filter: ['==', 'class', 'ocean'],
      layout: {
        'text-field': ['coalesce', ['get', 'name:latin'], ['get', 'name']],
        'text-size': ['interpolate', ['linear'], ['zoom'], 1, 12, 4, 20, 6, 26],
        'text-font': ['Noto Sans Regular'],
        'text-max-width': 9,
        'text-letter-spacing': 0.2,
        'text-transform': 'uppercase',
      },
      paint: {
        'text-color': colors.label_water,
        'text-halo-color': colors.ocean_deep,
        'text-halo-width': 2,
      },
      minzoom: 1,
    },
    {
      // Seas, gulfs, bays, straits, channels, lagoons — medium labels from zoom 3.
      id: 'water_name_sea',
      type: 'symbol',
      source: sourceId,
      'source-layer': 'water_name',
      filter: ['in', 'class', 'sea', 'gulf', 'bay', 'strait', 'channel', 'lagoon'],
      layout: {
        'text-field': ['coalesce', ['get', 'name:latin'], ['get', 'name']],
        'text-size': ['interpolate', ['linear'], ['zoom'], 3, 10, 6, 14, 10, 18],
        'text-font': ['Noto Sans Regular'],
        'text-max-width': 8,
        'text-letter-spacing': 0.1,
      },
      paint: {
        'text-color': colors.label_water,
        'text-halo-color': colors.ocean_deep,
        'text-halo-width': 1.5,
      },
      minzoom: 3,
    },
    {
      // Lakes, rivers, canals, reservoirs — smaller labels at higher zoom.
      id: 'water_name',
      type: 'symbol',
      source: sourceId,
      'source-layer': 'water_name',
      filter: ['!in', 'class', 'ocean', 'sea', 'gulf', 'bay', 'strait', 'channel', 'lagoon'],
      layout: {
        'text-field': ['coalesce', ['get', 'name:latin'], ['get', 'name']],
        'text-size': ['interpolate', ['linear'], ['zoom'], 6, 10, 14, 14],
        'text-font': ['Noto Sans Regular'],
        'text-max-width': 6,
        'text-letter-spacing': 0.05,
      },
      paint: {
        'text-color': colors.label_water,
        'text-halo-color': colors.water,
        'text-halo-width': 1,
      },
      minzoom: 6,
    },

    // ========================================
    // 13. Labels — Park
    // ========================================
    {
      id: 'park_label',
      type: 'symbol',
      source: sourceId,
      'source-layer': 'park',
      filter: ['has', 'name'],
      layout: {
        'text-field': ['coalesce', ['get', 'name:latin'], ['get', 'name']],
        'text-size': 11,
        'text-font': ['Noto Sans Regular'],
        'text-max-width': 8,
      },
      paint: {
        'text-color': colors.landuse_park,
        'text-halo-color': colors.background,
        'text-halo-width': 1,
      },
      minzoom: 12,
    },

    // ========================================
    // 14. Labels — POI
    // ========================================
    {
      id: 'poi',
      type: 'symbol',
      source: sourceId,
      'source-layer': 'poi',
      filter: ['<=', 'rank', 2],
      layout: {
        'text-field': ['coalesce', ['get', 'name:latin'], ['get', 'name']],
        'text-size': 10,
        'text-font': ['Noto Sans Regular'],
        'text-offset': [0, 0.6],
        'text-anchor': 'top',
        'text-max-width': 7,
        'text-optional': true,
      },
      paint: {
        'text-color': colors.poi,
        'text-halo-color': colors.poi_halo,
        'text-halo-width': 1.2,
      },
      minzoom: 14,
    },

    // ========================================
    // 15. Labels — Mountain peak
    // ========================================
    {
      id: 'mountain_peak',
      type: 'symbol',
      source: sourceId,
      'source-layer': 'mountain_peak',
      filter: ['all', ['has', 'name'], ['<=', 'rank', 3]],
      layout: {
        'text-field': ['coalesce', ['get', 'name:latin'], ['get', 'name']],
        'text-size': 10,
        'text-font': ['Noto Sans Regular'],
        'text-offset': [0, 0.5],
        'text-anchor': 'top',
      },
      paint: {
        'text-color': colors.label_secondary,
        'text-halo-color': colors.background,
        'text-halo-width': 1,
      },
      minzoom: 10,
    },

    // ========================================
    // 16. Labels — Aerodrome
    // ========================================
    {
      id: 'aerodrome_label',
      type: 'symbol',
      source: sourceId,
      'source-layer': 'aerodrome_label',
      layout: {
        'text-field': ['coalesce', ['get', 'name:latin'], ['get', 'name']],
        'text-size': 10,
        'text-font': ['Noto Sans Regular'],
        'text-max-width': 8,
      },
      paint: {
        'text-color': colors.label_secondary,
        'text-halo-color': colors.background,
        'text-halo-width': 1.2,
      },
      minzoom: 10,
    },

    // ========================================
    // 17. Labels — Places (hierarchy: country ? capital ? city ? town ? village)
    // WHY ordering matters: Larger places render first and take priority
    // in label collision, exactly like Organic Maps behavior.
    // ========================================
    {
      id: 'place_country',
      type: 'symbol',
      source: sourceId,
      'source-layer': 'place',
      filter: ['==', 'class', 'country'],
      layout: {
        'text-field': ['coalesce', ['get', 'name:latin'], ['get', 'name']],
        'text-size': ['interpolate', ['linear'], ['zoom'], 2, 10, 5, 18, 8, 22],
        'text-font': ['Noto Sans Bold'],
        'text-max-width': 10,
        'text-transform': 'uppercase',
        'text-letter-spacing': 0.12,
        'text-allow-overlap': false,
        'text-padding': 8,
      },
      paint: {
        'text-color': colors.label_primary,
        'text-halo-color': colors.background,
        'text-halo-width': 2.5,
      },
      minzoom: 1,
      maxzoom: 8,
    },
    {
      id: 'place_capital',
      type: 'symbol',
      source: sourceId,
      'source-layer': 'place',
      filter: ['all', ['==', 'class', 'city'], ['has', 'capital']],
      layout: {
        'text-field': ['coalesce', ['get', 'name:latin'], ['get', 'name']],
        'text-size': ['interpolate', ['linear'], ['zoom'], 3, 12, 6, 16, 10, 22, 14, 26],
        'text-font': ['Noto Sans Bold'],
        'text-max-width': 10,
        'text-letter-spacing': 0.05,
        'text-padding': 6,
      },
      paint: {
        'text-color': colors.label_primary,
        'text-halo-color': colors.background,
        'text-halo-width': 2.5,
      },
      minzoom: 3,
    },
    {
      id: 'place_city',
      type: 'symbol',
      source: sourceId,
      'source-layer': 'place',
      filter: ['all', ['==', 'class', 'city'], ['!has', 'capital']],
      layout: {
        'text-field': ['coalesce', ['get', 'name:latin'], ['get', 'name']],
        'text-size': ['interpolate', ['linear'], ['zoom'], 4, 10, 8, 16, 12, 20],
        'text-font': ['Noto Sans Bold'],
        'text-max-width': 10,
        'text-padding': 4,
      },
      paint: {
        'text-color': colors.label_primary,
        'text-halo-color': colors.background,
        'text-halo-width': 2,
      },
      minzoom: 4,
    },
    {
      id: 'place_town',
      type: 'symbol',
      source: sourceId,
      'source-layer': 'place',
      filter: ['==', 'class', 'town'],
      layout: {
        'text-field': ['coalesce', ['get', 'name:latin'], ['get', 'name']],
        'text-size': ['interpolate', ['linear'], ['zoom'], 7, 10, 12, 14, 16, 18],
        'text-font': ['Noto Sans Regular'],
        'text-max-width': 8,
      },
      paint: {
        'text-color': colors.label_primary,
        'text-halo-color': colors.background,
        'text-halo-width': 1.5,
      },
      minzoom: 7,
    },
    {
      id: 'place_village',
      type: 'symbol',
      source: sourceId,
      'source-layer': 'place',
      filter: ['==', 'class', 'village'],
      layout: {
        'text-field': ['coalesce', ['get', 'name:latin'], ['get', 'name']],
        'text-size': ['interpolate', ['linear'], ['zoom'], 10, 9, 14, 12],
        'text-font': ['Noto Sans Regular'],
        'text-max-width': 8,
      },
      paint: {
        'text-color': colors.label_secondary,
        'text-halo-color': colors.background,
        'text-halo-width': 1.2,
      },
      minzoom: 10,
    },
    {
      id: 'place_suburb',
      type: 'symbol',
      source: sourceId,
      'source-layer': 'place',
      filter: ['any', ['==', 'class', 'suburb'], ['==', 'class', 'neighbourhood']],
      layout: {
        'text-field': ['coalesce', ['get', 'name:latin'], ['get', 'name']],
        'text-size': ['interpolate', ['linear'], ['zoom'], 12, 9, 16, 13],
        'text-font': ['Noto Sans Regular'],
        'text-max-width': 7,
        'text-transform': 'uppercase',
        'text-letter-spacing': 0.08,
      },
      paint: {
        'text-color': colors.label_secondary,
        'text-halo-color': colors.background,
        'text-halo-width': 1,
        'text-opacity': 0.7,
      },
      minzoom: 12,
    },

    // ========================================
    // 18. Housenumber (high zoom only)
    // ========================================
    {
      id: 'housenumber',
      type: 'symbol',
      source: sourceId,
      'source-layer': 'housenumber',
      layout: {
        'text-field': '{housenumber}',
        'text-size': 9,
        'text-font': ['Noto Sans Regular'],
      },
      paint: {
        'text-color': colors.label_secondary,
        'text-halo-color': colors.background,
        'text-halo-width': 0.8,
        'text-opacity': 0.6,
      },
      minzoom: 17,
    },
  ] as LayerSpecification[];
}

// ==========================================
// Public API: Style Generators
// ==========================================

/**
 * Generate a complete MapLibre style for a PMTiles URL.
 *
 * When `options.worldTilesUrl` is provided, a world-overview source (Protomaps
 * Basemap schema) is added alongside the regional OpenMapTiles source.
 * World layers render at z0–z7 and hide beyond that so the regional detail tiles
 * seamlessly take over.
 *
 * @param pmtilesUrl - Regional tiles URL (without pmtiles:// prefix)
 * @param theme - 'light' or 'dark'
 * @param options - Optional feature flags (terrain, world tiles)
 * @returns Complete MapLibre StyleSpecification
 *
 * @example
 * ```ts
 * const style = createMapStyle(
 *   'http://localhost:8765/middle-east.pmtiles',
 *   'dark',
 *   { worldTilesUrl: 'http://localhost:8765/world-overview.pmtiles' }
 * );
 * map.setStyle(style);
 * ```
 */
/**
 * Assemble the bottom→top layer stack as three independent slots whose order is
 * decided by the unified panel (Photoshop model):
 *
 *  - 'basemap'       → background + world + world-full + regional, as ONE
 *                      contiguous block with a fixed, correct internal order
 *                      (fills below borders below roads below labels). This block
 *                      is NEVER split — so borders/labels never get hidden by a
 *                      sibling fill, and opacity applies uniformly to the whole row.
 *  - 'satellite'     → SAS satellite imagery raster (opaque photo).
 *  - 'labelsOverlay' → SAS transparent labels/roads raster.
 *
 * `slotOrder` is TOP-FIRST (index 0 renders on top). When a slot is absent from
 * the list it falls back to the default order so nothing disappears.
 */
function buildStyleLayerStack(input: {
  backgroundLayer: LayerSpecification;
  worldBase: LayerSpecification[];
  worldFullBase: LayerSpecification[];
  satelliteLayers: LayerSpecification[];
  regionalContent: LayerSpecification[];
  worldLabels: LayerSpecification[];
  worldFullLabels: LayerSpecification[];
  labelsOverlayLayers: LayerSpecification[];
  slotOrder?: BasemapStackSlot[];
}): LayerSpecification[] {
  const {
    backgroundLayer,
    worldBase,
    worldFullBase,
    satelliteLayers,
    regionalContent,
    worldLabels,
    worldFullLabels,
    labelsOverlayLayers,
    slotOrder,
  } = input;

  // The vector basemap as ONE contiguous, correctly-ordered block.
  const basemapBlock: LayerSpecification[] = [
    backgroundLayer,
    ...worldBase,
    ...worldFullBase,
    ...regionalContent,
    ...worldLabels,
    ...worldFullLabels,
  ];

  const blocks: Record<BasemapStackSlot, LayerSpecification[]> = {
    basemap: basemapBlock,
    satellite: satelliteLayers,
    labelsOverlay: labelsOverlayLayers,
  };

  // Default bottom→top: satellite photo at the very bottom, vector basemap on top
  // of it, transparent SAS labels on top of everything.
  const defaultBottomToTop: BasemapStackSlot[] = ['satellite', 'basemap', 'labelsOverlay'];

  // slotOrder is top-first → reverse to bottom-to-top. Append any missing slots in
  // their default position so a slot omitted from the panel never vanishes.
  let bottomToTop: BasemapStackSlot[];
  if (slotOrder && slotOrder.length) {
    const fromPanel = [...slotOrder].reverse();
    bottomToTop = [
      ...defaultBottomToTop.filter((s) => !fromPanel.includes(s)),
      ...fromPanel,
    ];
  } else {
    bottomToTop = defaultBottomToTop;
  }

  return bottomToTop.flatMap((slot) => blocks[slot]);
}

export function createMapStyle(
  pmtilesUrl: string,
  theme: 'light' | 'dark' = 'light',
  options?: MapStyleOptions
): StyleSpecification {
  const colors = theme === 'dark' ? DARK_COLORS : LIGHT_COLORS;
  const terrainTilesUrl = options?.terrainUrl ?? TERRAIN_TILES_URL;
  const hasRegionalBasemap = Boolean(pmtilesUrl?.trim()) && !options?.hideBaseMap;

  const sources: Record<string, SourceSpecification> = {
    // Skip regional PMTiles source when base map is hidden or not configured.
    ...(hasRegionalBasemap ? {
      [MAP_SOURCE_ID]: {
        type: 'vector',
        url: `pmtiles://${pmtilesUrl}`,
        attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a>',
      },
    } : {}),
    // Terrain DEM source — only added when terrain is enabled.
    // WHY Terrarium: free globally, zoom 0–15, natively supported by MapLibre.
    // For offline use, set options.terrainUrl to a local tile server URL.
    ...(options?.showTerrain ? {
      [TERRAIN_SOURCE_ID]: {
        type: 'raster-dem' as const,
        tiles: [terrainTilesUrl],
        tileSize: 256,
        // WHY maxzoom 10: local terrain-dem dataset only contains z0–z10 PNGs.
        // MapLibre will overzoom from z10 tiles instead of requesting 404s.
        maxzoom: 10,
        encoding: 'terrarium' as const,
        attribution: '© <a href="https://aws.amazon.com/public-datasets/terrain">AWS Elevation Tiles</a>',
      },
    } : {}),
    // World tiles source — Protomaps Basemap schema.
    // WHY no explicit maxzoom: the PMTiles header declares its own zoom range.
    // world-overview.pmtiles ? z0–z5, world-full-z14.pmtiles ? z0–z14.
    ...(options?.worldTilesUrl ? {
      [WORLD_SOURCE_ID]: {
        type: 'vector' as const,
        url: `pmtiles://${options.worldTilesUrl}`,
        attribution: '© <a href="https://protomaps.com">Protomaps</a> © <a href="https://openstreetmap.org">OpenStreetMap</a>',
      } as SourceSpecification,
    } : {}),
    // Satellite raster source — JPEG tiles served from local tile server.
    // Placed in style but rendered first (below all vector layers) so vector
    // roads, labels, and boundaries remain readable on top.
    ...(options?.satelliteUrl ? {
      [SATELLITE_SOURCE_ID]: {
        type: 'raster' as const,
        tiles: [options.satelliteUrl],
        tileSize: 256,
        minzoom: 0,
        // WHY 19: SAS.Planet stores tiles one zoom above standard XYZ.
        // The highest available zoom in SAS.Planet is z20, which serves
        // standard z19 tiles. Above z19 MapLibre overzooms the z19 tiles.
        maxzoom: options?.satelliteMaxZoom ?? 19,
        attribution: '© SAS.Planet',
      } as SourceSpecification,
    } : {}),
    // Labels/roads overlay — transparent PNG raster (SAS.Planet "both" cache).
    // Drawn on top of everything so names/roads stay readable over satellite.
    ...(options?.labelsOverlayUrl ? {
      [LABELS_OVERLAY_SOURCE_ID]: {
        type: 'raster' as const,
        tiles: [options.labelsOverlayUrl],
        tileSize: 256,
        minzoom: 0,
        maxzoom: options?.labelsOverlayMaxZoom ?? 19,
        attribution: '© SAS.Planet',
      } as SourceSpecification,
    } : {}),
    // World-full source — detailed global coverage at zoom 6–14.
    // Complements world-overview (z0–5). Layers from this source have minzoom 6
    // so they activate only when zoomed in, with no visual overlap with overview.
    ...(options?.worldFullTilesUrl ? {
      [WORLD_FULL_SOURCE_ID]: {
        type: 'vector' as const,
        url: `pmtiles://${options.worldFullTilesUrl}`,
        attribution: '© <a href="https://protomaps.com">Protomaps</a> © <a href="https://openstreetmap.org">OpenStreetMap</a>',
      } as SourceSpecification,
    } : {}),
  };

  // Regional layers — full OpenMapTiles detail.
  // Extract background (first layer) so world overview layers slot in after it.
  // WHY conditional: when hideBaseMap is true the MAP_SOURCE_ID source is not added
  // to the sources map, so we must also skip all layers that reference it to prevent
  // MapLibre "source not found" errors. The background layer has no source reference
  // so it is always included (gives the canvas a solid base color).
  const regionalLayers = buildLayers(MAP_SOURCE_ID, colors, options);
  const [backgroundLayer, ...contentLayers] = regionalLayers;
  const activeContentLayers = hasRegionalBasemap ? contentLayers : [];

  // World layers (Protomaps schema — full detail z0–z14).
  // BASE layers (fills, lines) sit between background and regional content:
  //   regional fills/roads render on top wherever they have coverage.
  // LABEL layers sit AFTER regional content so world labels remain visible
  //   globally; MapLibre symbol collision prevents duplication in overlap areas.
  const worldResult = options?.worldTilesUrl
    ? buildWorldLayers(WORLD_SOURCE_ID, colors)
    : { base: [], labels: [] };

  // World-full layers: same schema but activates at zoom 6+ to provide global
  // detail without duplicating world-overview at low zoom levels.
  // WHY minzoom 6: world-overview covers z0–5; full-detail takes over at z6.
  // WHY 'wf_'/'wfl_' prefix on IDs: MapLibre requires all layer IDs to be unique.
  const worldFullResult = options?.worldFullTilesUrl
    ? (() => {
        const r = buildWorldLayers(WORLD_FULL_SOURCE_ID, colors);
        // Remap source to world-full and enforce minzoom 6
        const applyFull = (layer: LayerSpecification, idPrefix: string): LayerSpecification =>
          ({ ...layer, id: idPrefix + layer.id, minzoom: Math.max((layer.minzoom ?? 0), 6) } as LayerSpecification);
        return {
          base: r.base.map(l => applyFull(l, 'wf_')),
          labels: r.labels.map(l => applyFull(l, 'wfl_')),
        };
      })()
    : { base: [], labels: [] };

  // Satellite imagery — bottom of the stack (above background only). Catalog
  // PMTiles basemap + world companions always render on top so zoom never
  // lets imagery replace vector tiles.
  const satelliteLayers: LayerSpecification[] = options?.satelliteUrl ? [
    {
      id: SATELLITE_RASTER_LAYER_ID,
      type: 'raster',
      source: SATELLITE_SOURCE_ID,
      paint: {
        'raster-opacity': options?.satelliteOpacity ?? 1.0,
        'raster-saturation': -0.1,
        'raster-brightness-max': 0.92,
      },
    } as LayerSpecification,
  ] : [];

  // Transparent labels/roads overlay — sits on TOP of all other layers so
  // place names and roads remain readable over satellite imagery.
  const labelsOverlayLayers: LayerSpecification[] = options?.labelsOverlayUrl ? [
    {
      id: LABELS_OVERLAY_RASTER_LAYER_ID,
      type: 'raster',
      source: LABELS_OVERLAY_SOURCE_ID,
      paint: { 'raster-opacity': options?.labelsOverlayOpacity ?? 1.0 },
    } as LayerSpecification,
  ] : [];

  const style: StyleSpecification = {
    version: 8,
    // Glyph server URL — required for Arabic/Persian (and all non-Latin) label rendering.
    // The {fontstack}/{range}.pbf template is how MapLibre fetches SDF glyph PBFs on demand.
    // WHY /api/tiles/fonts/: the tile proxy at /api/tiles/ already proxies to map-service/tiles/
    // so PBF files under map-service/tiles/fonts/ are automatically reachable.
    glyphs: options?.glyphsUrl || 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
    sources,
    // Layer stack (bottom → top).
    // Hybrid rule: when satellite imagery is present, regional OPAQUE fills
    // (water/landcover/landuse) drop BELOW the imagery so the photo shows through,
    // while regional roads/labels/borders stay ABOVE it for readability. Without
    // satellite, the regional layers render as one normal block.
    layers: buildStyleLayerStack({
      backgroundLayer,
      worldBase: worldResult.base,
      worldFullBase: worldFullResult.base,
      satelliteLayers,
      regionalContent: activeContentLayers,
      worldLabels: worldResult.labels,
      worldFullLabels: worldFullResult.labels,
      labelsOverlayLayers,
      slotOrder: options?.basemapStackSlots,
    }),
    // terrain: 3D surface exaggeration. exaggeration=1.2 makes mountains visible without distortion.
    ...(options?.showTerrain ? {
      terrain: {
        source: TERRAIN_SOURCE_ID,
        exaggeration: 1.2,
      },
    } : {}),
  };

  return style;
}

/**
 * Get light theme colors (for external use such as marker styling).
 */
export function getLightColors() {
  return { ...LIGHT_COLORS };
}

/**
 * Get dark theme colors (for external use such as marker styling).
 */
export function getDarkColors() {
  return { ...DARK_COLORS };
}

export type MapTheme = 'light' | 'dark';

