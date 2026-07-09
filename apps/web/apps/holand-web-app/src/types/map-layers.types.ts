// Map catalog layer types (Storage /map/layers via map_explorer plugin tools)

export type MapLayerKind =
  | 'artifact_gps'
  | 'raster_xyz'
  | 'raster_sas'
  | 'raster_sas_sqlite'
  | 'raster_pmtiles'
  | 'raster_mbtiles'
  | 'raster_cog'
  | 'raster_wms'
  | 'raster_wmts'
  | 'raster_remote'
  | 'vector_geojson'
  | 'vector_pmtiles'
  | 'vector_mbtiles'
  | 'vector_flatgeobuf'
  | 'vector_geopackage'
  | 'vector_shapefile'
  | 'vector_kml'
  | 'vector_gpx'
  | 'streetview_folder'
  | 'streetview_tiled'
  | 'streetview_equirect'
  | 'session_draw'
  | string;

export interface MapCatalogLayer {
  id: string;
  name: string;
  layer_kind: MapLayerKind;
  owner_user_id?: string;
  source_type?: string;
  storage_root?: string | null;
  source_url?: string | null;
  source_config?: Record<string, unknown> | null;
  /** SAS sqlite role from tile sampling (detect/list enrichment). */
  sas_role?: 'satellite_imagery' | 'labels_overlay' | string | null;
  tile_ext?: string | null;
  enabled?: boolean;
  import_status?: string;
  /** Storage filesystem probe — false when tiles/PMTiles path is missing or empty. */
  data_available?: boolean;
  /** Panel / stack ordering from Storage catalog. */
  sort_order?: number;
  /** When import_status=kind_mismatch, detect_path result for storage_root. */
  detected_kind?: string | null;
  bounds?: Record<string, number> | number[] | null;
  min_zoom?: number | null;
  max_zoom?: number | null;
  created_at?: string;
  updated_at?: string;
}

export interface MapLayersListResponse {
  items: MapCatalogLayer[];
  total_count: number;
  limit?: number;
  offset?: number;
}
